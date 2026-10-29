"""Unit and end-to-end tests for the optional image-to-3D pipeline (scripts/image-to-3d/).

No network, no Blender, no gradio_client: the Hugging Face client is replaced by a fake that is
driven by a recorded copy of the real TRELLIS API schema (tests/fixtures/image-to-3d/trellis-info.json).
"""
from __future__ import annotations

import contextlib
import io
import json
import os
import shutil
import struct
import sys
import tempfile
import types
import unittest
import urllib.error
import zlib
from pathlib import Path
from unittest import mock

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "image-to-3d"))
FIXTURE = ROOT / "tests" / "fixtures" / "image-to-3d" / "trellis-info.json"

import generate_3d as g3d  # noqa: E402
import image_to_glb as i2g  # noqa: E402
import process_mesh as pm  # noqa: E402

# Assembled at run time so this file itself does not trip the package secret scan.
FAKE_TOKEN = "hf_" + "AbCdEf0123" * 3
APPROVAL = 'user, 2026-10-29, "yes, send lamp.png to trellis-community/TRELLIS"'
SPACE = "trellis-community/TRELLIS"


def tempdir(testcase: unittest.TestCase, prefix: str) -> Path:
    path = Path(tempfile.mkdtemp(prefix=prefix))
    testcase.addCleanup(lambda: shutil.rmtree(path, ignore_errors=True))
    return path


# --------------------------------------------------------------------------------------------
# Builders
# --------------------------------------------------------------------------------------------
def png_bytes(w: int = 256, h: int = 256, color_type: int = 2) -> bytes:
    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)
    channels = {2: 3, 6: 4}[color_type]
    raw = (b"\x00" + b"\x7f" * (w * channels)) * h
    return (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, color_type, 0, 0, 0))
            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b""))


def jpeg_bytes(w: int = 300, h: int = 200) -> bytes:
    app0 = b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 17, 8, h, w, 3) + b"\x01\x22\x00\x02\x11\x01\x03\x11\x01"
    return b"\xff\xd8" + app0 + sof + b"\xff\xd9"


def webp_bytes(w: int = 640, h: int = 480, alpha: bool = True) -> bytes:
    payload = (b"VP8X" + struct.pack("<I", 10) + bytes([0x10 if alpha else 0]) + b"\x00\x00\x00"
               + (w - 1).to_bytes(3, "little") + (h - 1).to_bytes(3, "little"))
    return b"RIFF" + struct.pack("<I", 4 + len(payload)) + b"WEBP" + payload


def glb_bytes(doc: dict | None = None) -> bytes:
    doc = doc or {
        "asset": {"version": "2.0"},
        "meshes": [{"primitives": [{"attributes": {"POSITION": 0}, "indices": 1}]}],
        "accessors": [{"count": 8, "min": [-1, -1, -1], "max": [1, 1, 1]}, {"count": 36}],
        "materials": [{}], "textures": [{}], "images": [{}], "nodes": [{}],
    }
    js = json.dumps(doc).encode()
    js += b" " * ((4 - len(js) % 4) % 4)
    body = struct.pack("<II", len(js), 0x4E4F534A) + js
    return b"glTF" + struct.pack("<II", 2, 12 + len(body)) + body


class FakeJob:
    def __init__(self, fn, never_done: bool = False):
        self._fn, self._never, self.polls, self.cancelled = fn, never_done, 0, False

    def done(self) -> bool:
        if self._never:
            return False
        self.polls += 1
        return self.polls > 1

    def result(self, timeout=None):
        return self._fn()

    def cancel(self) -> bool:
        self.cancelled = True
        return True

    def status(self):
        return types.SimpleNamespace(code=types.SimpleNamespace(name="PENDING"), rank=0, queue_size=1)


class FakeClient:
    def __init__(self, info: dict, behaviors: dict, never_done: tuple = ()):
        self.info, self.behaviors, self.never_done = info, behaviors, never_done
        self.calls: list = []
        self.jobs: list = []
        self.closed = False

    def view_api(self, return_format=None, print_info=True):
        assert return_format == "dict" and print_info is False
        return self.info

    def submit(self, api_name=None, **kwargs):
        self.calls.append((api_name, kwargs))
        fn = self.behaviors[api_name]
        job = FakeJob(lambda: fn(**kwargs), never_done=api_name in self.never_done)
        self.jobs.append(job)
        return job

    def close(self):
        self.closed = True


def trellis_info() -> dict:
    return json.loads(FIXTURE.read_text(encoding="utf-8"))


def ep(*names_defaults):
    """Endpoint schema from ('name', has_default) pairs."""
    return {"parameters": [{"parameter_name": n, "parameter_has_default": d, "parameter_default": None} for n, d in names_defaults],
            "returns": []}


class Base(unittest.TestCase):
    def setUp(self):
        self.tmp = tempdir(self, "i23d-test-")
        self.image = self.tmp / "lamp.png"
        self.image.write_bytes(png_bytes())
        patches = [mock.patch.object(g3d, "_sleep", lambda s: None),
                   mock.patch.object(g3d, "_handle_file", lambda p: str(p)),
                   mock.patch.object(g3d, "probe_space", side_effect=AssertionError("network probe must not run in tests"))]
        for p in patches:
            p.start()
            self.addCleanup(p.stop)

    def trellis_client(self, **overrides) -> FakeClient:
        def pre(image):
            p = self.tmp / "processed.png"
            p.write_bytes(png_bytes(256, 256, 6))
            return str(p)

        def gen(**kw):
            glb = self.tmp / "remote.glb"
            glb.write_bytes(glb_bytes())
            video = self.tmp / "remote.mp4"
            video.write_bytes(b"\x00\x00\x00\x18ftypmp42")
            return ({"video": str(video)}, str(glb), {"path": str(glb)})
        behaviors = {"/preprocess_image": pre, "/generate_and_extract_glb": gen}
        behaviors.update(overrides)
        return FakeClient(trellis_info(), behaviors)

    def run_generate(self, client, **kw):
        args = dict(backend="trellis", skip_probe=True, client_factory=lambda *a: client, approve_upload=SPACE,
                    approved_by=APPROVAL, params=g3d.GenParams(seed=7), log=lambda m: None)
        args.update(kw)
        return g3d.generate(self.image, self.tmp / "out" / "raw.glb", **args)


# --------------------------------------------------------------------------------------------
# generate_3d: inputs, files, safety helpers
# --------------------------------------------------------------------------------------------
class InputAndGlbTests(Base):
    def test_sniff_png_jpeg_webp(self):
        png = self.tmp / "a.png"; png.write_bytes(png_bytes(300, 200, 6))
        jpg = self.tmp / "a.jpg"; jpg.write_bytes(jpeg_bytes(300, 200))
        web = self.tmp / "a.webp"; web.write_bytes(webp_bytes(640, 480, True))
        p, j, w = g3d.sniff_image(png), g3d.sniff_image(jpg), g3d.sniff_image(web)
        self.assertEqual((p["format"], p["width"], p["height"], p["has_alpha"]), ("png", 300, 200, True))
        self.assertEqual((j["format"], j["width"], j["height"]), ("jpeg", 300, 200))
        self.assertEqual((w["format"], w["width"], w["height"], w["has_alpha"]), ("webp", 640, 480, True))

    def test_sniff_rejects_bad_inputs(self):
        small = self.tmp / "s.png"; small.write_bytes(png_bytes(64, 64))
        junk = self.tmp / "j.png"; junk.write_bytes(b"not an image at all")
        for path, text in ((small, "shorter side"), (junk, "PNG, JPEG or WebP"), (self.tmp / "missing.png", "not found")):
            with self.assertRaises(g3d.Gen3DError) as cm:
                g3d.sniff_image(path)
            self.assertEqual(cm.exception.exit_code, g3d.EXIT_USAGE)
            self.assertIn(text, cm.exception.message)

    def test_inspect_glb_counts(self):
        p = self.tmp / "m.glb"; p.write_bytes(glb_bytes())
        s = g3d.inspect_glb(p)
        self.assertEqual((s["meshes"], s["triangles"], s["materials"], s["textures"], s["bbox_size"]), (1, 12, 1, 1, [2, 2, 2]))

    def test_inspect_glb_rejects_corruption(self):
        good = glb_bytes()
        cases = {"magic": b"XXXX" + good[4:], "version": good[:4] + struct.pack("<I", 1) + good[8:],
                 "length": good + b"\x00", "truncated": good[:20], "json": good[:20] + b"{{{{" + good[24:]}
        for name, data in cases.items():
            p = self.tmp / f"{name}.glb"; p.write_bytes(data)
            with self.assertRaises(g3d.GlbError, msg=name):
                g3d.inspect_glb(p)

    def test_redact_removes_tokens_everywhere(self):
        self.assertNotIn(FAKE_TOKEN, g3d.redact(f"failed with token {FAKE_TOKEN} here"))
        self.assertNotIn("abcdefghijklmnop1234", g3d.redact("Authorization: Bearer abcdefghijklmnop1234"))
        with mock.patch.dict(os.environ, {"HF_TOKEN": "customsecretvalue99"}):
            self.assertNotIn("customsecretvalue99", g3d.redact("leaked customsecretvalue99 in text"))
        self.assertNotIn("literal-secret-77", g3d.redact("x literal-secret-77 y", ("literal-secret-77",)))

    def test_classify_error(self):
        cases = [("You have exceeded your GPU quota (60s requested)", "quota", g3d.EXIT_TEMPFAIL),
                 ("HTTP 429 Too Many Requests", "rate_limited", g3d.EXIT_TEMPFAIL),
                 ("read timed out", "timeout", g3d.EXIT_TEMPFAIL),
                 ("401 Unauthorized", "auth", g3d.EXIT_AUTH),
                 ("The Space is sleeping", "space_unavailable", g3d.EXIT_UNAVAILABLE),
                 ("Connection reset by peer", "network", g3d.EXIT_TEMPFAIL),
                 ("something odd", "unknown", g3d.EXIT_FAILED)]
        for text, kind, code in cases:
            info = g3d.classify_error(RuntimeError(text))
            self.assertEqual((info["kind"], info["exit_code"]), (kind, code), text)

    def test_space_id_validation(self):
        self.assertEqual(g3d.check_space_id(SPACE), SPACE)
        for bad in ("nospace", "a/b/c", "../etc/passwd", "owner/na me", "", None):
            with self.assertRaises(g3d.Gen3DError):
                g3d.check_space_id(bad)

    def test_fetch_api_info_rejects_foreign_hosts(self):
        with mock.patch.object(g3d, "_http_json", side_effect=AssertionError("must not request")):
            self.assertIsNone(g3d.fetch_api_info("https://evil.example.com"))
            self.assertIsNone(g3d.fetch_api_info("http://x.hf.space"))


class RealProbeTests(unittest.TestCase):
    """probe_space is patched out in Base; exercise the real function here."""

    def test_running_missing_and_unreachable(self):
        data = {"runtime": {"stage": "RUNNING", "hardware": {"current": "zero-a10g"}}, "host": "https://x-y.hf.space", "sdk": "gradio"}
        with mock.patch.object(g3d, "_http_json", return_value=data):
            p = g3d.probe_space(SPACE)
        self.assertEqual((p["stage"], p["hardware"]), ("RUNNING", "zero-a10g"))
        err = urllib.error.HTTPError("https://huggingface.co/x", 404, "nf", {}, None)
        with mock.patch.object(g3d, "_http_json", side_effect=err):
            self.assertEqual(g3d.probe_space(SPACE)["stage"], "NOT_FOUND")
        with mock.patch.object(g3d, "_http_json", side_effect=OSError("Connection refused")):
            self.assertEqual(g3d.probe_space(SPACE)["stage"], "UNREACHABLE")


# --------------------------------------------------------------------------------------------
# generate_3d: schema discovery
# --------------------------------------------------------------------------------------------
class SchemaTests(Base):
    def test_parse_endpoints_from_recorded_schema(self):
        eps = g3d.parse_endpoints(trellis_info())
        self.assertIn("/generate_and_extract_glb", eps)
        self.assertNotIn("/image_to_3d", eps)  # the layout in the original request no longer exists
        names = [p["name"] for p in eps["/generate_and_extract_glb"]["parameters"]]
        self.assertEqual(names[:2], ["image", "multiimages"])
        self.assertIn("texture_size", names)

    def test_select_values_filters_and_reports(self):
        eps = g3d.parse_endpoints(trellis_info())
        kwargs, ignored, missing = g3d.select_values(eps, "/generate_and_extract_glb", {"image": "x", "seed": 1, "bogus": 3})
        self.assertEqual((sorted(kwargs), ignored, missing), (["image", "seed"], ["bogus"], []))
        _, _, missing = g3d.select_values(eps, "/preprocess_image", {})
        self.assertEqual(missing, ["image"])

    def test_collect_paths_handles_gradio_shapes(self):
        glb = self.tmp / "a.glb"; glb.write_bytes(glb_bytes())
        nested = ({"video": "x.mp4"}, {"value": {"path": str(glb)}}, [str(glb)], None)
        self.assertEqual(g3d.existing_files(nested, ".glb"), [glb])


# --------------------------------------------------------------------------------------------
# generate_3d: the generate() flow
# --------------------------------------------------------------------------------------------
class GenerateFlowTests(Base):
    def test_dry_run_makes_no_calls_and_writes_receipt(self):
        receipt = self.tmp / "dry.json"
        res = g3d.generate(self.image, self.tmp / "o.glb", dry_run=True, receipt_path=receipt,
                           client_factory=lambda *a: self.fail("client must not be created"))
        self.assertEqual((res["dry_run"], res["provider_calls"]), (True, 0))
        data = json.loads(receipt.read_text(encoding="utf-8"))
        self.assertEqual((data["dry_run"], data["submit"], data["provider_calls"]), (True, False, 0))
        self.assertEqual(data["expected_endpoints"], ["/preprocess_image", "/generate_and_extract_glb"])
        self.assertEqual(data["input"]["file"], "lamp.png")
        self.assertNotIn(str(self.tmp), json.dumps(data))  # no absolute paths in receipts

    def test_upload_needs_named_approval(self):
        factory = lambda *a: self.fail("client must not be created without approval")  # noqa: E731
        for override in ({"approve_upload": None}, {"approve_upload": "someone/else"}, {"approved_by": ""}):
            args = dict(approve_upload=SPACE, approved_by=APPROVAL, skip_probe=True, client_factory=factory)
            args.update(override)
            with self.assertRaises(g3d.Gen3DError) as cm:
                g3d.generate(self.image, self.tmp / "o.glb", **args)
            self.assertEqual((cm.exception.kind, cm.exception.exit_code), ("approval_required", g3d.EXIT_APPROVAL), override)

    def test_approval_matches_the_space_case_insensitively(self):
        self.assertTrue(self.run_generate(self.trellis_client(), approve_upload=SPACE.upper())["ok"])

    def test_hunyuan_needs_license_acknowledgement(self):
        with self.assertRaises(g3d.Gen3DError) as cm:
            g3d.generate(self.image, self.tmp / "o.glb", backend="hunyuan3d", approve_upload="tencent/Hunyuan3D-2",
                         approved_by=APPROVAL, skip_probe=True, client_factory=lambda *a: self.fail("no client"))
        self.assertEqual(cm.exception.exit_code, g3d.EXIT_APPROVAL)
        self.assertIn("European Union", cm.exception.message)

    def test_space_stage_blocks_generation(self):
        with mock.patch.object(g3d, "probe_space", return_value={"space": SPACE, "stage": "SLEEPING"}):
            with self.assertRaises(g3d.Gen3DError) as cm:
                self.run_generate(self.trellis_client(), skip_probe=False)
        self.assertEqual((cm.exception.kind, cm.exception.exit_code), ("space_unavailable", g3d.EXIT_UNAVAILABLE))

    def test_trellis_success_uses_discovered_endpoints_and_records_everything(self):
        client = self.trellis_client()
        receipt = self.tmp / "r.json"
        res = self.run_generate(client, receipt_path=receipt)
        self.assertEqual([c[0] for c in client.calls], ["/preprocess_image", "/generate_and_extract_glb"])
        gen_kwargs = client.calls[1][1]
        self.assertEqual((gen_kwargs["seed"], gen_kwargs["texture_size"], gen_kwargs["mesh_simplify"]), (7, 1024, 0.95))
        self.assertTrue(gen_kwargs["image"].endswith("processed.png"))  # the preprocessed image, not the original
        self.assertNotIn("multiimages", gen_kwargs)
        self.assertEqual(res["provider_calls"], 2)
        out = Path(res["out"])
        self.assertTrue(out.is_file() and g3d.inspect_glb(out)["triangles"] == 12)
        self.assertFalse(Path(str(out) + ".tmp").exists())
        self.assertTrue(client.closed)
        data = json.loads(receipt.read_text(encoding="utf-8"))
        self.assertEqual((data["approved_by"], data["seed"], data["output"]["bytes"]), (APPROVAL, 7, out.stat().st_size))
        self.assertEqual(data["output"]["sha256"], g3d.sha256_file(out))

    def test_preprocess_never_skips_the_preprocess_call(self):
        client = self.trellis_client()
        self.run_generate(client, params=g3d.GenParams(seed=1, preprocess="never"))
        self.assertEqual([c[0] for c in client.calls], ["/generate_and_extract_glb"])

    def test_legacy_two_step_layout_is_adapted(self):
        glb = self.tmp / "legacy.glb"; glb.write_bytes(glb_bytes())
        info = {"named_endpoints": {
            "/preprocess_image": ep(("image", False)),
            "/image_to_3d": ep(("image", False), ("multiimages", True), ("seed", True), ("ss_guidance_strength", True),
                               ("ss_sampling_steps", True), ("slat_guidance_strength", True), ("slat_sampling_steps", True)),
            "/extract_glb": ep(("mesh_simplify", True), ("texture_size", True))}}
        pre = self.trellis_client().behaviors["/preprocess_image"]
        client = FakeClient(info, {"/preprocess_image": pre, "/image_to_3d": lambda **kw: "state",
                                   "/extract_glb": lambda **kw: (str(glb), str(glb))})
        res = self.run_generate(client)
        self.assertEqual([c[0] for c in client.calls], ["/preprocess_image", "/image_to_3d", "/extract_glb"])
        self.assertTrue(any("legacy" in w for w in res["warnings"]))
        self.assertEqual(sorted(client.calls[2][1]), ["mesh_simplify", "texture_size"])

    def test_unknown_layout_fails_clearly(self):
        client = FakeClient({"named_endpoints": {"/get_seed": ep(("seed", True))}}, {})
        with self.assertRaises(g3d.Gen3DError) as cm:
            self.run_generate(client, params=g3d.GenParams(seed=1, preprocess="never"))
        self.assertEqual((cm.exception.kind, cm.exception.exit_code), ("endpoint_mismatch", g3d.EXIT_UNAVAILABLE))
        self.assertIn("/get_seed", cm.exception.message)

    def test_required_parameter_we_cannot_fill_is_reported(self):
        info = {"named_endpoints": {"/generate_and_extract_glb": ep(("image", False), ("brand_new_required", False))}}
        with self.assertRaises(g3d.Gen3DError) as cm:
            self.run_generate(FakeClient(info, {}), params=g3d.GenParams(seed=1, preprocess="never"))
        self.assertIn("brand_new_required", cm.exception.message)

    def test_remote_error_is_classified_redacted_and_never_resubmitted(self):
        def boom(**kw):
            raise RuntimeError("You have exceeded your GPU quota. " + FAKE_TOKEN)
        client = self.trellis_client(**{"/generate_and_extract_glb": boom})
        with self.assertRaises(g3d.Gen3DError) as cm:
            self.run_generate(client, token=FAKE_TOKEN)
        self.assertEqual((cm.exception.kind, cm.exception.exit_code), ("quota", g3d.EXIT_TEMPFAIL))
        self.assertNotIn(FAKE_TOKEN, cm.exception.message)
        self.assertEqual([c[0] for c in client.calls].count("/generate_and_extract_glb"), 1)
        self.assertTrue(client.closed)

    def test_timeout_cancels_and_does_not_resubmit(self):
        clock = {"t": 0.0}
        client = self.trellis_client()
        client.never_done = ("/generate_and_extract_glb",)
        with mock.patch.object(g3d, "_now", lambda: clock["t"]), \
                mock.patch.object(g3d, "_sleep", lambda s: clock.__setitem__("t", clock["t"] + 5)):
            with self.assertRaises(g3d.Gen3DError) as cm:
                self.run_generate(client, timeout=12)
        self.assertEqual((cm.exception.kind, cm.exception.exit_code), ("timeout", g3d.EXIT_TEMPFAIL))
        self.assertTrue(client.jobs[-1].cancelled)
        self.assertEqual([c[0] for c in client.calls].count("/generate_and_extract_glb"), 1)
        self.assertIn("not resubmitted", cm.exception.message)

    def test_no_glb_in_result(self):
        client = self.trellis_client(**{"/generate_and_extract_glb": lambda **kw: ({"video": "x.mp4"}, None, None)})
        with self.assertRaises(g3d.Gen3DError) as cm:
            self.run_generate(client)
        self.assertEqual(cm.exception.kind, "invalid_response")

    def test_corrupt_glb_is_rejected_and_not_written(self):
        bad = self.tmp / "bad.glb"; bad.write_bytes(b"glTF-but-not-really")
        client = self.trellis_client(**{"/generate_and_extract_glb": lambda **kw: (None, str(bad), str(bad))})
        with self.assertRaises(g3d.Gen3DError) as cm:
            self.run_generate(client)
        self.assertIn("not a valid GLB", cm.exception.message)
        self.assertFalse((self.tmp / "out" / "raw.glb").exists())

    def test_client_creation_retries_only_transient_errors(self):
        attempts = {"n": 0}
        good = self.trellis_client()

        def flaky(*a):
            attempts["n"] += 1
            if attempts["n"] < 3:
                raise ConnectionError("Connection reset")
            return good
        self.assertTrue(self.run_generate(good, client_factory=flaky)["ok"])
        self.assertEqual(attempts["n"], 3)

        def denied(*a):
            attempts["n"] += 1
            raise RuntimeError("401 Unauthorized")
        attempts["n"] = 0
        with self.assertRaises(g3d.Gen3DError) as cm:
            self.run_generate(good, client_factory=denied)
        self.assertEqual((attempts["n"], cm.exception.kind), (1, "auth"))

    def test_hunyuan_backend_maps_by_name_and_picks_the_textured_glb(self):
        white, textured = self.tmp / "white.glb", self.tmp / "tex.glb"
        white.write_bytes(glb_bytes()); textured.write_bytes(glb_bytes())
        info = {"named_endpoints": {"/generation_all": ep(
            ("caption", True), ("image", True), ("mv_image_front", True), ("steps", True), ("guidance_scale", True),
            ("seed", True), ("octree_resolution", True), ("check_box_rembg", True), ("num_chunks", True), ("randomize_seed", True))}}
        client = FakeClient(info, {"/generation_all": lambda **kw: (str(white), str(textured), "<html>", {}, 5)})
        res = self.run_generate(client, backend="hunyuan3d", space="tencent/Hunyuan3D-2",
                                approve_upload="tencent/Hunyuan3D-2", accept_license=True)
        kw = client.calls[0][1]
        self.assertEqual((kw["steps"], kw["seed"], kw["check_box_rembg"], kw["randomize_seed"]), (50, 7, True, False))
        self.assertNotIn("caption", kw)
        self.assertTrue(any("experimental" in w for w in res["warnings"]))

    def test_params_are_range_checked(self):
        for bad in (g3d.GenParams(texture_size=999), g3d.GenParams(mesh_simplify=0.5), g3d.GenParams(ss_steps=0),
                    g3d.GenParams(seed=-1), g3d.GenParams(ss_guidance=11)):
            with self.assertRaises(g3d.Gen3DError):
                bad.validate()


class CliTests(Base):
    def run_main(self, *argv):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = g3d.main(list(argv))
        return code, out.getvalue(), err.getvalue()

    def test_dry_run_cli(self):
        code, out, _ = self.run_main("--image", str(self.image), "--out", str(self.tmp / "o.glb"), "--dry-run")
        self.assertEqual(code, 0)
        self.assertIn("DRY RUN (0 provider calls)", out)

    def test_cli_usage_and_approval_exit_codes(self):
        self.assertEqual(self.run_main()[0], g3d.EXIT_USAGE)
        code, _, err = self.run_main("--image", str(self.image), "--out", str(self.tmp / "o.glb"))
        self.assertEqual(code, g3d.EXIT_APPROVAL)
        self.assertIn("explicit yes", err)


# --------------------------------------------------------------------------------------------
# process_mesh (pure parts; the Blender steps cannot run without Blender)
# --------------------------------------------------------------------------------------------
class ProcessMeshTests(unittest.TestCase):
    def test_argv_after_double_dash(self):
        self.assertEqual(pm.argv_after_double_dash(["blender", "-b", "--python", "x.py", "--", "in.glb", "out.glb"]), ["in.glb", "out.glb"])
        self.assertEqual(pm.argv_after_double_dash(["blender"]), [])

    def test_defaults_match_the_documented_invocation(self):
        args = pm.build_parser().parse_args(["in.glb", "out.glb"])
        self.assertEqual((args.target_size, args.pivot, args.texture_max_size, args.max_triangles, args.draco), (2.0, "center", 1024, 0, False))

    def test_compute_fit_center_and_bottom(self):
        fit = pm.compute_fit([0, 0, 0], [4, 2, 1], 2.0, "center")
        self.assertAlmostEqual(fit["scale"], 0.5)
        self.assertEqual(fit["translation"], [-2.0, -1.0, -0.5])
        self.assertEqual(fit["size_after"], [2.0, 1.0, 0.5])
        bottom = pm.compute_fit([-1, -1, 3], [1, 1, 5], 1.0, "bottom")
        self.assertEqual(bottom["translation"], [0.0, 0.0, -3])
        self.assertAlmostEqual(bottom["scale"], 0.5)

    def test_compute_fit_degenerate_mesh(self):
        fit = pm.compute_fit([1, 1, 1], [1, 1, 1], 2.0, "center")
        self.assertTrue(fit["degenerate"] and fit["scale"] == 1.0)

    def test_validate_args_protects_the_original(self):
        parse = pm.build_parser().parse_args
        for argv, text in ((["a.glb", "a.glb"], "differ"), (["a.png", "b.glb"], "input must"), (["a.glb", "b.gltf"], "output must"),
                           (["a.glb", "b.glb", "--target-size", "0"], "target-size")):
            with self.assertRaises(ValueError, msg=argv) as cm:
                pm.validate_args(parse(argv))
            self.assertIn(text, str(cm.exception))

    def test_main_outside_blender_fails_cleanly_with_a_result_line(self):
        tmp = tempdir(self, "pm-test-")
        out = io.StringIO()
        with contextlib.redirect_stdout(out):
            code = pm.main([str(tmp / "in.glb"), str(tmp / "out.glb")])
        self.assertEqual(code, 1)
        line = next(l for l in out.getvalue().splitlines() if l.startswith(pm.RESULT_PREFIX))
        self.assertIn("bpy", json.loads(line[len(pm.RESULT_PREFIX) + 1:])["error"])
        self.assertTrue((tmp / "out.glb.report.json").exists())


# --------------------------------------------------------------------------------------------
# image_to_glb: Blender discovery, wrapper, manifest, end to end
# --------------------------------------------------------------------------------------------
class BlenderDiscoveryTests(unittest.TestCase):
    def test_explicit_and_env_paths_win(self):
        tmp = tempdir(self, "bl-test-")
        exe = tmp / "blender"; exe.write_text("x")
        none = dict(which=lambda _: None, glob_fn=lambda _: [], platform_name="linux")
        self.assertEqual(i2g.find_blender(str(exe), env={}, **none), str(exe))
        self.assertEqual(i2g.find_blender(None, env={"BLENDER_PATH": str(exe)}, **none), str(exe))
        self.assertIsNone(i2g.find_blender(None, env={}, is_file=lambda p: False, **none))

    def test_windows_install_folders_prefer_the_newest(self):
        seen = []

        def fake_glob(pattern):
            seen.append(pattern)
            if "Blender Foundation" in pattern and "Program Files" in pattern:
                return [r"C:\Program Files\Blender Foundation\Blender 3.6\blender.exe",
                        r"C:\Program Files\Blender Foundation\Blender 4.2\blender.exe"]
            return []
        found = i2g.find_blender(None, env={"ProgramFiles": r"C:\Program Files"}, which=lambda _: None, platform_name="win32",
                                 glob_fn=fake_glob, is_file=lambda p: True)
        self.assertIn("4.2", found)
        self.assertTrue(any("Blender *" in p for p in seen))

    def test_version_parsing(self):
        runner = lambda *a, **k: types.SimpleNamespace(stdout="Blender 4.2.3 LTS\n\tbuild date: x\n")  # noqa: E731
        self.assertEqual(i2g.blender_version("/x/blender", runner=runner), "4.2.3")
        self.assertIsNone(i2g.blender_version("/x/blender", runner=lambda *a, **k: types.SimpleNamespace(stdout="garbage")))
        self.assertGreaterEqual(i2g.version_tuple("4.2.3"), i2g.MIN_BLENDER)
        self.assertLess(i2g.version_tuple("2.93.1"), i2g.MIN_BLENDER)

    def test_install_help_per_os(self):
        win, mac, lin = (i2g.blender_install_help(p) for p in ("win32", "darwin", "linux"))
        for text in (win, mac, lin):
            self.assertIn("https://www.blender.org/download/", text)
            self.assertIn("--blender", text)
        self.assertIn("Environment Variables", win)
        self.assertIn("/Applications/Blender.app", mac)
        self.assertIn("snap install blender", lin)

    def test_doctor_reports_missing_blender_with_help(self):
        with mock.patch.object(i2g, "find_blender", return_value=None):
            rep = i2g.doctor(offline=True)
        self.assertFalse(rep["ready_to_post_process"])
        self.assertTrue(any("blender.org/download" in s for s in rep["next_steps"]))
        self.assertEqual({c["id"] for c in rep["checks"]}, {"python", "gradio_client", "blender", "hf_token", "gemini", "space"})
        self.assertIn(rep["gemini_available"], (True, False))  # optional: never a reason to stop
        self.assertNotIn(FAKE_TOKEN, json.dumps(rep))


class RunBlenderTests(unittest.TestCase):
    def runner(self, stdout="", code=0, stderr=""):
        calls = []

        def run(cmd, **kw):
            calls.append(cmd)
            return types.SimpleNamespace(stdout=stdout, stderr=stderr, returncode=code)
        run.calls = calls
        return run

    def test_command_line_and_result_parsing(self):
        run = self.runner(stdout='noise\nPROCESS_MESH_RESULT {"ok": true, "warnings": ["w"]}\n')
        res = i2g.run_blender("/b/blender", Path("raw.glb"), Path("final.glb"), ["--pivot", "bottom"], runner=run)
        cmd = run.calls[0]
        self.assertEqual(res["warnings"], ["w"])
        self.assertEqual(cmd[:6], ["/b/blender", "--background", "--factory-startup", "--python-exit-code", "1", "--python"])
        sep = cmd.index("--")
        self.assertEqual(cmd[sep + 1:sep + 3], [str(Path("raw.glb")), str(Path("final.glb"))])
        self.assertIn("bottom", cmd)

    def test_failures_are_reported(self):
        for run in (self.runner(stdout='PROCESS_MESH_RESULT {"ok": false, "error": "boom"}', code=1),
                    self.runner(stdout="no result line"), self.runner(code=1)):
            with self.assertRaises(i2g.g3d.Gen3DError) as cm:
                i2g.run_blender("/b/blender", Path("a.glb"), Path("b.glb"), [], runner=run)
            self.assertEqual(cm.exception.kind, "blender_failed")

    def test_timeout(self):
        def hang(cmd, **kw):
            raise i2g.subprocess.TimeoutExpired(cmd, 1)
        with self.assertRaises(i2g.g3d.Gen3DError) as cm:
            i2g.run_blender("/b/blender", Path("a.glb"), Path("b.glb"), [], runner=hang)
        self.assertEqual(cm.exception.kind, "blender_timeout")


class ManifestTests(unittest.TestCase):
    def entry(self, **kw):
        base = dict(asset_id="lamp", rel_path="public/models/lamp.glb", role="product", backend="trellis", space=SPACE, seed=7,
                    params={"texture_size": 1024}, approved_by=APPROVAL, size=123456, processed=True, critical=False,
                    loading="lazy", fallback=None, alt=None, notes="n", blender="4.2.3", today="2026-10-29")
        base.update(kw)
        return i2g.build_manifest_entry(**base)

    def test_entry_has_the_fields_the_schema_requires(self):
        e = self.entry()
        for key in ("id", "type", "role", "path", "source", "format", "license", "critical", "loading", "optimization", "validation"):
            self.assertIn(key, e)
        self.assertEqual((e["type"], e["source"], e["format"], e["optimization"], e["validation"]["status"]),
                         ("model3d", "generated", "glb", "optimized", "pending"))
        self.assertNotIn("unknown", e["license"].lower())
        self.assertEqual(self.entry(processed=False)["optimization"], "pending")
        self.assertNotIn(FAKE_TOKEN, json.dumps(e))

    def test_hunyuan_entry_carries_the_licence_restriction(self):
        e = self.entry(backend="hunyuan3d", space="tencent/Hunyuan3D-2")
        self.assertIn("European Union", e["usageRestrictions"])

    def test_upsert_creates_updates_and_never_clobbers(self):
        tmp = tempdir(self, "mf-test-")
        path = tmp / "asset-manifest.json"
        self.assertEqual(i2g.upsert_manifest(path, "proj", self.entry()), "created")
        other = self.entry(asset_id="chair", rel_path="public/models/chair.glb")
        self.assertEqual(i2g.upsert_manifest(path, "proj", other), "updated")
        self.assertEqual(i2g.upsert_manifest(path, "proj", self.entry(size=999)), "updated")
        data = json.loads(path.read_text(encoding="utf-8"))
        self.assertEqual([a["id"] for a in data["assets"]], ["lamp", "chair"])
        self.assertEqual(data["assets"][0]["bytes"], 999)
        path.write_text("{ not json", encoding="utf-8")
        with self.assertRaises(i2g.g3d.Gen3DError):
            i2g.upsert_manifest(path, "proj", self.entry())
        self.assertEqual(path.read_text(encoding="utf-8"), "{ not json")
        path.write_text('{"version": "1.0"}', encoding="utf-8")
        with self.assertRaises(i2g.g3d.Gen3DError):
            i2g.upsert_manifest(path, "proj", self.entry())

    def test_paths_cannot_escape_the_project(self):
        root = tempdir(self, "rt-test-")
        self.assertTrue(str(i2g.resolve_inside(root, "public/models", "x")).startswith(str(root.resolve())))
        with self.assertRaises(i2g.g3d.Gen3DError):
            i2g.resolve_inside(root, "../outside", "x")


class EndToEndTests(Base):
    """Real generate() and cmd_run code paths, with a fake Space client and a fake Blender wrapper."""

    def setUp(self):
        super().setUp()
        self.proj = self.tmp / "site"
        self.proj.mkdir()
        self.img = self.proj / "lamp.png"
        self.img.write_bytes(png_bytes())
        self.client = self.trellis_client()
        for p in (mock.patch.object(g3d, "make_client", lambda *a: self.client),
                  mock.patch.object(i2g, "blender_version", lambda p: "4.2.3")):
            p.start()
            self.addCleanup(p.stop)

    def invoke(self, *extra, blender="/fake/blender", run_blender=None):
        argv = ["run", "--image", str(self.img), "--id", "lamp", "--root", str(self.proj), "--json", "--skip-probe", *extra]

        def fake_process(b, raw, final, opts, **kw):
            final.parent.mkdir(parents=True, exist_ok=True)
            final.write_bytes(raw.read_bytes())
            return {"ok": True, "warnings": ["material 'm' has default grey base colour"], "opts": opts}
        out, err = io.StringIO(), io.StringIO()
        with mock.patch.object(i2g, "find_blender", lambda *a, **k: blender), \
                mock.patch.object(i2g, "run_blender", run_blender or fake_process), \
                contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = i2g.main(argv)
        return code, out.getvalue(), err.getvalue()

    def approve(self):
        return ["--approve-upload", SPACE, "--approved-by", APPROVAL, "--seed", "7"]

    def test_dry_run_creates_only_a_receipt(self):
        code, out, _ = self.invoke("--dry-run")
        self.assertEqual(code, 0)
        self.assertEqual(json.loads(out)["provider_calls"], 0)
        self.assertEqual(self.client.calls, [])
        files = sorted(p.name for p in (self.proj / "public").rglob("*") if p.is_file())
        self.assertEqual(files, ["lamp.dry-run.json"])

    def test_full_run_with_blender(self):
        code, out, _ = self.invoke(*self.approve(), "--role", "product")
        self.assertEqual(code, 0, out)
        summary = json.loads(out)
        self.assertEqual((summary["processed"], summary["final"]), (True, "public/models/lamp.glb"))
        self.assertTrue((self.proj / "public/models/lamp.glb").is_file() and (self.proj / "public/models/_sources/lamp.raw.glb").is_file())
        asset = json.loads((self.proj / "asset-manifest.json").read_text(encoding="utf-8"))["assets"][0]
        self.assertEqual((asset["id"], asset["type"], asset["path"], asset["optimization"], asset["validation"]["status"]),
                         ("lamp", "model3d", "public/models/lamp.glb", "optimized", "pending"))
        self.assertIn("default grey", asset["validation"]["notes"])
        receipts = json.loads((self.proj / "public/models/_sources/receipts.json").read_text(encoding="utf-8"))["lamp"]
        self.assertEqual(receipts["final"]["sha256"], g3d.sha256_file(self.proj / "public/models/lamp.glb"))
        self.assertEqual(receipts["generate"]["approved_by"], APPROVAL)
        self.assertNotIn(str(self.proj), json.dumps(receipts["generate"]))

    def test_reference_asset_is_recorded_as_provenance(self):
        code, out, _ = self.invoke(*self.approve(), "--reference-asset", "lamp-ref")
        self.assertEqual(code, 0, out)
        asset = json.loads((self.proj / "asset-manifest.json").read_text(encoding="utf-8"))["assets"][0]
        self.assertEqual(asset["generator"]["params"]["referenceAsset"], "lamp-ref")
        code, _, _ = self.invoke(*self.approve(), "--reference-asset", "../bad", "--overwrite")
        self.assertEqual(code, g3d.EXIT_USAGE)

    def test_second_run_will_not_overwrite_without_the_flag(self):
        self.assertEqual(self.invoke(*self.approve())[0], 0)
        calls_before = len(self.client.calls)
        code, out, _ = self.invoke(*self.approve())
        self.assertEqual(code, g3d.EXIT_APPROVAL)
        self.assertIn("overwrite_required", out)
        self.assertEqual(len(self.client.calls), calls_before)  # nothing was submitted

    def test_missing_blender_is_incomplete_not_a_silent_substitution(self):
        code, out, _ = self.invoke(*self.approve(), blender=None)
        self.assertEqual(code, i2g.EXIT_INCOMPLETE)
        self.assertTrue(json.loads(out)["incomplete"])
        self.assertFalse((self.proj / "public/models/lamp.glb").exists())
        self.assertTrue((self.proj / "public/models/_sources/lamp.raw.glb").exists())
        self.assertFalse((self.proj / "asset-manifest.json").exists())

    def test_allow_unprocessed_ships_the_raw_glb_but_records_it(self):
        code, _, _ = self.invoke(*self.approve(), "--allow-unprocessed", blender=None)
        self.assertEqual(code, i2g.EXIT_INCOMPLETE)
        asset = json.loads((self.proj / "asset-manifest.json").read_text(encoding="utf-8"))["assets"][0]
        self.assertEqual(asset["optimization"], "pending")
        self.assertIn("NOT RUN", asset["validation"]["notes"])
        self.assertTrue((self.proj / "public/models/lamp.glb").is_file())

    def test_blender_failure_keeps_the_raw_glb(self):
        def broken(*a, **k):
            raise i2g.g3d.Gen3DError("blender_failed", "Blender post-processing failed (boom)", 1)
        code, _, _ = self.invoke(*self.approve(), run_blender=broken)
        self.assertEqual(code, i2g.EXIT_INCOMPLETE)
        self.assertTrue((self.proj / "public/models/_sources/lamp.raw.glb").exists())
        self.assertFalse((self.proj / "public/models/lamp.glb").exists())

    def test_over_budget_is_flagged(self):
        code, out, _ = self.invoke(*self.approve(), "--budget-bytes", "100")
        self.assertEqual(code, i2g.EXIT_INCOMPLETE)
        self.assertTrue(any("over budget" in n for n in json.loads(out)["notes"]))

    def test_critical_asset_requires_a_fallback_before_any_work(self):
        code, _, _ = self.invoke(*self.approve(), "--critical")
        self.assertEqual(code, g3d.EXIT_USAGE)
        self.assertEqual(self.client.calls, [])
        code, out, _ = self.invoke(*self.approve(), "--critical", "--fallback", "poster:public/images/lamp.webp")
        self.assertEqual(code, 0, out)

    def test_out_dir_cannot_leave_the_project(self):
        code, _, _ = self.invoke(*self.approve(), "--out-dir", "../elsewhere")
        self.assertEqual(code, g3d.EXIT_USAGE)

    def test_no_secret_reaches_any_written_file(self):
        with mock.patch.dict(os.environ, {"HF_TOKEN": FAKE_TOKEN}):
            self.assertEqual(self.invoke(*self.approve())[0], 0)
        for path in self.proj.rglob("*.json"):
            self.assertNotIn(FAKE_TOKEN, path.read_text(encoding="utf-8"), path.name)


if __name__ == "__main__":
    unittest.main()

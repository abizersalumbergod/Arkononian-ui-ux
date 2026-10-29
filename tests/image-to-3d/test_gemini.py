"""Tests for the optional Gemini stage (scripts/image-to-3d/gemini_media.py).

Everything runs against a fake network layer driven by the request/response shapes documented by Google on
2026-10-29 (Interactions API). No network, no key, no cost.
"""
from __future__ import annotations

import base64
import contextlib
import hashlib
import io
import json
import shutil
import socket
import sys
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "image-to-3d"))
sys.path.insert(0, str(HERE))

import gemini_media as gm  # noqa: E402
import generate_3d as g3d  # noqa: E402
from test_pipeline import png_bytes  # noqa: E402

# Assembled at run time so this file itself does not trip the package secret scan.
KEY = "AIza" + "x1" * 18
ENV = {"GEMINI_API_KEY": KEY, "GEMINI_IMAGE_MODEL": "img-model-1", "GEMINI_VIDEO_MODEL": "vid-model-1"}
APPROVAL = 'user, 2026-10-29, "yes, 2 hero candidates with Gemini"'


def b64(data: bytes) -> str:
    return base64.b64encode(data).decode("ascii")


def mp4() -> bytes:
    return b"\x00\x00\x00\x18ftypmp42" + b"\x00" * 64


def img_block(data: bytes, mime: str = "image/png") -> dict:
    return {"type": "image", "mime_type": mime, "data": b64(data)}


def vid_block(data: bytes = None, uri: str = None) -> dict:
    block = {"type": "video", "mime_type": "video/mp4"}
    if data is not None:
        block["data"] = b64(data)
    if uri is not None:
        block["uri"] = uri
    return block


def interaction(status: str = "completed", iid: str = "int_img_1", content=None, thought=None, usage=None, errors=None) -> dict:
    steps = []
    if thought:
        steps.append({"type": "thought", "content": thought})
    if content is not None:
        steps.append({"type": "model_output", "content": content})
    data = {"id": iid, "status": status, "steps": steps}
    if usage:
        data["usage"] = usage
    if errors:
        data["errors"] = errors
    return data


def api_error(code: str, message: str = "nope") -> dict:
    return {"error": {"code": code, "message": message}}


class FakeResp:
    def __init__(self, status: int, body: bytes, headers: dict = None):
        self.status, self.body, self.headers = status, body, headers or {}

    def read(self, n: int = -1) -> bytes:
        return self.body if n is None or n < 0 else self.body[:n]

    def __enter__(self):
        return self

    def __exit__(self, *exc):
        return False


class FakeNet:
    """Stands in for urllib's opener. Routes are consumed in order; the last response repeats."""

    def __init__(self):
        self.routes: dict = {}
        self.requests: list = []
        self.hooks: list = []

    def on(self, method: str, path: str, *items) -> "FakeNet":
        self.routes[(method, path)] = list(items)
        return self

    def __call__(self, req, timeout=None):
        url = req.full_url
        path = url.split("/v1beta", 1)[1]
        record = {"method": req.get_method(), "path": path, "url": url, "timeout": timeout,
                  "headers": {k.lower(): v for k, v in req.header_items()},
                  "body": json.loads(req.data) if req.data else None}
        self.requests.append(record)
        for hook in self.hooks:
            hook(record)
        items = self.routes.get((req.get_method(), path))
        assert items, f"unexpected request {req.get_method()} {path}"
        item = items.pop(0) if len(items) > 1 else items[0]
        if isinstance(item, BaseException):
            raise item
        status, payload = item[0], item[1]
        headers = item[2] if len(item) > 2 else {}
        raw = payload if isinstance(payload, bytes) else json.dumps(payload).encode("utf-8")
        if status >= 400:
            raise urllib.error.HTTPError(url, status, "err", headers, io.BytesIO(raw))
        return FakeResp(status, raw, headers)

    def posts(self) -> list:
        return [r for r in self.requests if r["method"] == "POST"]


class Base(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp(prefix="gem-test-"))
        self.addCleanup(lambda: shutil.rmtree(self.root, ignore_errors=True))
        self.clock = {"t": 0.0}
        self.sleeps: list = []

        def fake_sleep(seconds):
            self.sleeps.append(seconds)
            self.clock["t"] += seconds
        for p in (mock.patch.object(gm, "_sleep", fake_sleep), mock.patch.object(gm, "_now", lambda: self.clock["t"])):
            p.start()
            self.addCleanup(p.stop)
        self.ref = self.root / "ref.png"
        self.ref.write_bytes(png_bytes(256, 256))

    def run_cli(self, *argv, env=None, net=None):
        out, err = io.StringIO(), io.StringIO()
        with contextlib.redirect_stdout(out), contextlib.redirect_stderr(err):
            code = gm.main(list(argv), env=ENV if env is None else env, opener=net)
        return code, out.getvalue(), err.getvalue()

    def approved(self, *extra):
        return ["--approve-provider", "gemini", "--approved-by", APPROVAL, "--root", str(self.root), "--json", *extra]

    def jobs(self) -> dict:
        return json.loads((self.root / "_sources" / "gemini" / "jobs.json").read_text(encoding="utf-8"))


# --------------------------------------------------------------------------------------------
# Configuration and the "no Gemini access" path
# --------------------------------------------------------------------------------------------
class ConfigTests(Base):
    def test_env_values_and_precedence(self):
        envfile = self.root / ".env"
        envfile.write_text('# comment\nexport GEMINI_API_KEY="' + "f" * 30 + '"\nGEMINI_IMAGE_MODEL=from-file\nOTHER_SECRET=do-not-read\n', encoding="utf-8")
        cfg = gm.load_config({"GEMINI_IMAGE_MODEL": "from-env"}, envfile)
        self.assertEqual((cfg.image_model, cfg.api_key), ("from-env", "f" * 30))  # process environment wins
        self.assertNotIn("OTHER_SECRET", gm.parse_env_file(envfile))

    def test_malformed_values_are_reported_without_echoing_them(self):
        cfg = gm.load_config({"GEMINI_API_KEY": "short key", "GEMINI_IMAGE_MODEL": "bad model!", "GEMINI_MAX_JOBS_PER_RUN": "zero"})
        self.assertFalse(cfg.has_access())
        self.assertEqual(len(cfg.problems), 3)
        self.assertNotIn("short key", " ".join(cfg.problems))

    def test_missing_model_names_the_variable_and_the_fallback(self):
        cfg = gm.load_config({"GEMINI_API_KEY": KEY})
        with self.assertRaises(gm.GeminiError) as cm:
            cfg.model_for("image")
        self.assertEqual((cm.exception.kind, cm.exception.exit_code, cm.exception.fallback), ("not_configured", g3d.EXIT_USAGE, True))
        self.assertIn("GEMINI_IMAGE_MODEL", cm.exception.message)
        self.assertEqual(cfg.model_for("image", "override-model-2"), "override-model-2")

    def test_doctor_without_a_key_points_to_the_normal_procedure_and_never_calls_out(self):
        net = FakeNet()
        code, out, _ = self.run_cli("doctor", "--json", "--online", env={}, net=net)
        report = json.loads(out)
        self.assertEqual(code, 0)
        self.assertFalse(report["gemini_available"])
        self.assertIn("normal procedure", report["normal_procedure"])
        self.assertEqual(net.requests, [])

    def test_doctor_online_checks_the_key_with_a_free_read_only_request(self):
        net = FakeNet().on("GET", "/models?pageSize=1", (200, {"models": []}))
        _, out, _ = self.run_cli("doctor", "--json", "--online", net=net)
        self.assertEqual(json.loads(out)["key_check"], "accepted by the API (read-only models request)")
        self.assertEqual((net.requests[0]["method"], net.requests[0]["headers"]["x-goog-api-key"]), ("GET", KEY))
        net = FakeNet().on("GET", "/models?pageSize=1", (403, api_error("permission_denied")))
        _, out, _ = self.run_cli("doctor", "--json", "--online", net=net)
        report = json.loads(out)
        self.assertFalse(report["gemini_available"])
        self.assertIn("normal_procedure", report)

    def test_capability_router(self):
        cfg = gm.load_config(ENV)
        self.assertTrue(gm.resolve_capability("image.edit", cfg)["configured"])
        none = gm.load_config({})
        self.assertFalse(gm.resolve_capability("video.generate", none)["configured"])
        self.assertIn("normal procedure", gm.resolve_capability("video.generate", none)["fallback"])
        for cap in ("model3d.generate", "video.analyze", "asset.optimize", "asset.discover", "nope.nope"):
            self.assertFalse(gm.resolve_capability(cap, cfg)["supported"], cap)
        self.assertIn("TRELLIS", gm.resolve_capability("model3d.generate", cfg)["reason"])
        code, out, _ = self.run_cli("capabilities", "--json", env={})
        self.assertEqual(code, 0)
        self.assertEqual(len(json.loads(out)["capabilities"]), len(gm.CAPABILITIES))


# --------------------------------------------------------------------------------------------
# Error classification and the HTTP layer
# --------------------------------------------------------------------------------------------
class ErrorTests(Base):
    def err(self, status, payload, headers=None):
        return gm.error_from_response(status, json.dumps(payload).encode(), headers)

    def http(self, net):
        return gm.GeminiHttp(gm.load_config(ENV), net, log=lambda m: None)

    def test_documented_codes(self):
        cases = [(429, "rate_limit_exceeded", "rate_limited", 75, True), (429, "quota_exceeded", "quota", 75, False),
                 (429, "too_many_requests", "rate_limited", 75, True), (503, "service_unavailable", "unavailable", 75, True),
                 (500, "api_error", "server_error", 75, False), (504, "deadline_exceeded", "timeout", 75, False),
                 (402, "payment_required", "no_access", 77, False), (401, "authentication", "no_access", 77, False),
                 (403, "permission_denied", "no_access", 77, False), (400, "failed_precondition", "no_access", 77, False),
                 (404, "model_not_found", "model_not_found", 69, False), (400, "invalid_request", "invalid_request", 1, False)]
        for status, code, kind, exit_code, reject in cases:
            e = self.err(status, api_error(code))
            self.assertEqual((e.kind, e.exit_code, e.reject), (kind, exit_code, reject), code)

    def test_no_access_and_model_errors_point_to_the_normal_procedure(self):
        for status, code in ((403, "permission_denied"), (404, "model_not_found")):
            e = self.err(status, api_error(code))
            self.assertTrue(e.fallback, code)
            self.assertIn("normal procedure", e.message)
        self.assertIn("paid-only", self.err(403, api_error("permission_denied")).message)

    def test_blocked_codes_and_unknown_codes(self):
        e = self.err(400, api_error("image_safety", "blocked by policy"))
        self.assertEqual((e.kind, e.exit_code), ("blocked", g3d.EXIT_FAILED))
        self.assertEqual(self.err(429, api_error("something_new")).kind, "rate_limited")  # falls back to the HTTP status
        self.assertEqual(gm.error_from_response(502, b"<html>bad gateway</html>").kind, "unknown")

    def test_classic_google_error_bodies_and_retry_after(self):
        e = self.err(429, {"error": {"code": 429, "status": "RESOURCE_EXHAUSTED", "message": "slow"}}, {"Retry-After": "7"})
        self.assertEqual((e.kind, e.retry_after), ("rate_limited", 7.0))

    def test_secrets_never_survive_in_messages(self):
        cfg = gm.load_config(ENV)
        e = gm.error_from_response(400, json.dumps(api_error("invalid_request", f"bad key {KEY} and {KEY[:30]}")).encode(), cfg=cfg)
        self.assertNotIn("AIza", e.message)
        self.assertNotIn(KEY, gm.redact(f"x {KEY} y"))

    def test_key_travels_in_a_header_never_in_the_url(self):
        net = FakeNet().on("GET", "/models?pageSize=1", (200, {}))
        self.http(net).request_json("GET", "/models?pageSize=1")
        req = net.requests[0]
        self.assertEqual(req["headers"]["x-goog-api-key"], KEY)
        self.assertNotIn(KEY, req["url"])
        self.assertNotIn("key=", req["url"])

    def test_retry_policy_post_vs_get(self):
        # POST: only when Google rejected the request before doing any work
        net = FakeNet().on("POST", "/interactions", (503, api_error("service_unavailable")), (200, {"id": "int_ok_1", "status": "completed"}))
        self.assertEqual(self.http(net).request_json("POST", "/interactions", {}, retries=2, post=True)["id"], "int_ok_1")
        self.assertEqual(len(net.posts()), 2)
        self.assertTrue(self.sleeps)
        for status, code in ((500, "api_error"), (429, "quota_exceeded"), (504, "deadline_exceeded")):
            net = FakeNet().on("POST", "/interactions", (status, api_error(code)))
            with self.assertRaises(gm.GeminiError):
                self.http(net).request_json("POST", "/interactions", {}, retries=3, post=True)
            self.assertEqual(len(net.posts()), 1, code)  # ambiguous or final: never re-sent
        timeout_net = FakeNet().on("POST", "/interactions", socket.timeout("timed out"))
        with self.assertRaises(gm.GeminiError) as cm:
            self.http(timeout_net).request_json("POST", "/interactions", {}, retries=3, post=True)
        self.assertEqual((cm.exception.kind, len(timeout_net.posts())), ("timeout", 1))
        # the connection was never made: safe to send again
        dns = FakeNet().on("POST", "/interactions", urllib.error.URLError(socket.gaierror(-2, "no dns")), (200, {"id": "int_dns_1"}))
        self.assertEqual(self.http(dns).request_json("POST", "/interactions", {}, retries=1, post=True)["id"], "int_dns_1")
        # GET: transient errors retry
        get = FakeNet().on("GET", "/interactions/int_a1b2", (500, api_error("api_error")), (200, {"status": "completed"}))
        self.assertEqual(self.http(get).request_json("GET", "/interactions/int_a1b2", retries=2)["status"], "completed")

    def test_invalid_json_is_reported(self):
        with self.assertRaises(gm.GeminiError) as cm:
            self.http(FakeNet().on("GET", "/x", (200, b"<html>not json</html>"))).request_json("GET", "/x")
        self.assertEqual(cm.exception.kind, "invalid_response")

    def test_fetch_bytes_only_talks_to_googles_api_host(self):
        net = FakeNet().on("GET", "/files/abc123:download?alt=media", (200, b"VIDEO-BYTES"))
        http = self.http(net)
        self.assertEqual(http.fetch_bytes("https://generativelanguage.googleapis.com/v1beta/files/abc123"), b"VIDEO-BYTES")
        self.assertEqual(net.requests[0]["headers"]["x-goog-api-key"], KEY)
        self.assertNotIn(KEY, net.requests[0]["url"])
        for bad in ("https://evil.example.com/v1beta/files/abc123", "http://generativelanguage.googleapis.com/v1beta/files/abc123",
                    "https://generativelanguage.googleapis.com/v1beta/files/../../etc", "https://generativelanguage.googleapis.com/other"):
            with self.assertRaises(gm.GeminiError, msg=bad):
                http.fetch_bytes(bad)
        self.assertEqual(len(net.requests), 1)


# --------------------------------------------------------------------------------------------
# Request builders and parsing
# --------------------------------------------------------------------------------------------
class BuilderTests(Base):
    def test_image_request_shape(self):
        body = gm.build_image_request("m1", "a hero", [], "16:9", "2K", "image/png")
        self.assertEqual(body["input"], [{"type": "text", "text": "a hero"}])
        self.assertEqual(body["response_format"], {"type": "image", "mime_type": "image/png", "aspect_ratio": "16:9", "image_size": "2K"})
        self.assertIs(body["store"], False)  # prompts and references are not kept server-side by default
        self.assertNotIn("background", body)

    def test_image_edit_request_carries_the_reference_image(self):
        body = gm.build_image_request("m1", "make it blue", [self.ref])
        self.assertEqual([b["type"] for b in body["input"]], ["text", "image"])
        self.assertEqual((body["input"][1]["mime_type"], body["input"][1]["data"]), ("image/png", b64(self.ref.read_bytes())))

    def test_image_request_validation(self):
        for kwargs in ({"aspect_ratio": "wide"}, {"image_size": "2k"}, {"mime_type": "image/gif"}, {"input_images": [self.ref] * 11}):
            with self.assertRaises(gm.GeminiError, msg=str(kwargs)):
                gm.build_image_request("m1", "x", **kwargs)

    def test_video_request_shapes(self):
        text = gm.build_video_request("v1", "a dolly shot", aspect_ratio="16:9", resolution="720p")
        self.assertEqual((text["background"], text["store"]), (True, True))
        self.assertEqual(text["response_format"], {"type": "video", "aspect_ratio": "16:9", "resolution": "720p"})
        self.assertNotIn("generation_config", text)
        frame = gm.build_video_request("v1", "animate", first_frame=self.ref)
        self.assertEqual(frame["generation_config"], {"video_config": {"task": "image_to_video"}})
        self.assertEqual([b["type"] for b in frame["input"]], ["text", "image"])
        sync = gm.build_video_request("v1", "x", background=False)
        self.assertEqual((sync["background"], sync["store"], sync["stream"]), (False, False, False))
        self.assertEqual(gm.build_video_request("v1", "x", delivery="uri")["response_format"]["delivery"], "uri")
        cont = gm.build_video_request("v1", "dusk", task="edit", previous_interaction_id="int_prev_1")
        self.assertEqual((cont["previous_interaction_id"], cont["store"], cont["generation_config"]["video_config"]["task"]), ("int_prev_1", True, "edit"))

    def test_video_request_validation(self):
        for kwargs in ({"aspect_ratio": "4:3"}, {"resolution": "8k"}, {"task": "dance"}, {"previous_interaction_id": "int_x1"},
                       {"first_frame": self.ref, "previous_interaction_id": "int_x1", "task": "edit"}):
            with self.assertRaises(gm.GeminiError, msg=str(kwargs)):
                gm.build_video_request("v1", "x", **kwargs)

    def test_parsing_ignores_thought_steps(self):
        final = png_bytes(300, 200)
        data = interaction(content=[{"type": "text", "text": "ok"}, img_block(final)], thought=[img_block(png_bytes(256, 256), "image/jpeg")])
        blocks = gm.content_blocks(data, "image")
        self.assertEqual(len(blocks), 1)
        self.assertEqual(base64.b64decode(blocks[0]["data"]), final)

    def test_failure_from_interaction(self):
        self.assertEqual(gm.failure_from_interaction(interaction("failed", errors=[{"code": "image_prohibited_content", "message": "no"}])).kind, "blocked")
        self.assertEqual(gm.failure_from_interaction(interaction("failed", errors=[{"code": "no_image", "message": "x"}])).kind, "no_image")
        self.assertEqual(gm.failure_from_interaction(interaction("requires_continuation")).kind, "unsupported")
        self.assertIsNone(gm.failure_from_interaction(interaction("completed")))

    def test_clean_plate_prompt_is_a_reference_still_brief(self):
        text = gm.clean_plate_prompt("a ceramic desk lamp", "front")
        for needle in ("ceramic desk lamp", "front view", "plain seamless", "no text", "no people", "full object visible"):
            self.assertIn(needle, text)


# --------------------------------------------------------------------------------------------
# Image flow
# --------------------------------------------------------------------------------------------
class ImageFlowTests(Base):
    def image_net(self, *pngs, usage=None):
        items = [(200, interaction(iid=f"int_img_{i}", content=[img_block(p)], usage=usage)) for i, p in enumerate(pngs, 1)]
        return FakeNet().on("POST", "/interactions", *items)

    def test_dry_run_plans_without_any_call_or_approval(self):
        net = FakeNet()
        code, out, _ = self.run_cli("image", "--id", "hero", "--prompt", "A wide hero", "--count", "3", "--dry-run", "--json", "--root", str(self.root), net=net)
        plan = json.loads(out)
        self.assertEqual((code, plan["provider_calls"], plan["new_paid_jobs"], plan["mode"]), (0, 0, 3, "synchronous"))
        self.assertFalse(plan["stored_by_google"])
        self.assertIn("SynthID", plan["watermark"])
        self.assertEqual(net.requests, [])
        self.assertTrue((self.root / "_sources" / "gemini" / "hero.image-dry-run.json").exists())

    def test_nothing_is_sent_without_a_named_approval(self):
        net = FakeNet()
        for extra in ([], ["--approve-provider", "someone-else", "--approved-by", "x"], ["--approve-provider", "gemini"]):
            code, _, err = self.run_cli("image", "--id", "hero", "--prompt", "A wide hero", "--root", str(self.root), *extra, net=net)
            self.assertEqual(code, g3d.EXIT_APPROVAL, extra)
            self.assertIn("approval_required", err)
        self.assertEqual(net.requests, [])

    def test_uploads_need_the_exact_file_names_approved(self):
        net = self.image_net(png_bytes(300, 200))
        base = ["image", "--id", "edit", "--prompt", "make it blue", "--input-image", str(self.ref)]
        code, _, err = self.run_cli(*base, *self.approved(), net=net)
        self.assertEqual(code, g3d.EXIT_APPROVAL)
        self.assertIn("ref.png", err)
        self.assertEqual(net.requests, [])
        code, out, _ = self.run_cli(*base, *self.approved("--approved-uploads", "ref.png"), net=net)
        self.assertEqual(code, 0, out)
        self.assertEqual([b["type"] for b in net.posts()[0]["body"]["input"]], ["text", "image"])

    def test_candidates_are_saved_recorded_and_secret_free(self):
        pngs = [png_bytes(256, 256), png_bytes(300, 200)]
        net = self.image_net(*pngs, usage={"total_tokens": 1300, "total_output_tokens": 1290})
        code, out, _ = self.run_cli("image", "--id", "hero", "--prompt", "A wide hero", "--count", "2", "--aspect-ratio", "16:9",
                                    "--image-size", "2K", *self.approved(), net=net)
        results = json.loads(out)["results"]
        self.assertEqual((code, [r["status"] for r in results]), (0, ["completed", "completed"]))
        body = net.posts()[0]["body"]
        self.assertEqual((body["model"], body["response_format"]["aspect_ratio"], body["response_format"]["image_size"]), ("img-model-1", "16:9", "2K"))
        files = [self.root / r["file"] for r in results]
        self.assertEqual([f.read_bytes() for f in files], pngs)
        self.assertEqual({f.name for f in files}, {"hero-c1.png", "hero-c2.png"})
        self.assertEqual(results[0]["usage"]["total_tokens"], 1300)
        jobs = self.jobs()
        self.assertEqual(len(jobs), 2)
        self.assertTrue(all(j["status"] == "completed" and j["approved_by"] == APPROVAL for j in jobs.values()))
        for path in (self.root / "_sources").rglob("*.json"):
            self.assertNotIn(KEY, path.read_text(encoding="utf-8"), path.name)

    def test_an_identical_request_is_not_billed_twice(self):
        net = self.image_net(png_bytes(256, 256))
        args = ["image", "--id", "hero", "--prompt", "A wide hero", *self.approved()]
        self.assertEqual(self.run_cli(*args, net=net)[0], 0)
        code, out, _ = self.run_cli(*args, net=net)
        self.assertEqual((code, json.loads(out)["results"][0]["status"]), (0, "reused"))
        self.assertEqual(len(net.posts()), 1)
        self.assertEqual(self.run_cli(*args, "--force-new", net=net)[0], 0)
        self.assertEqual(len(net.posts()), 2)

    def test_interim_thought_images_are_never_the_result(self):
        final = png_bytes(300, 200)
        data = interaction(content=[img_block(final)], thought=[img_block(png_bytes(256, 256), "image/jpeg")])
        net = FakeNet().on("POST", "/interactions", (200, data))
        _, out, _ = self.run_cli("image", "--id", "hero", "--prompt", "A wide hero", *self.approved(), net=net)
        self.assertEqual((self.root / json.loads(out)["results"][0]["file"]).read_bytes(), final)

    def test_the_file_extension_follows_the_real_bytes(self):
        net = FakeNet().on("POST", "/interactions", (200, interaction(content=[{"type": "image", "mime_type": "image/jpeg", "data": b64(png_bytes())}])))
        _, out, _ = self.run_cli("image", "--id", "hero", "--prompt", "A wide hero", *self.approved(), net=net)
        self.assertTrue(json.loads(out)["results"][0]["file"].endswith("hero-c1.png"))

    def test_per_run_cap_and_token_budget(self):
        net = self.image_net(png_bytes(256, 256))
        code, _, err = self.run_cli("image", "--id", "hero", "--prompt", "A wide hero", "--count", "5", *self.approved(), net=net)
        self.assertEqual((code, net.requests), (g3d.EXIT_APPROVAL, []))
        self.assertIn("--max-jobs 5", err)
        net = self.image_net(png_bytes(256, 256), png_bytes(300, 200), usage={"total_tokens": 100})
        _, out, _ = self.run_cli("image", "--id", "tb", "--prompt", "A wide hero", "--count", "2", "--token-budget", "50", *self.approved(), net=net)
        self.assertEqual([r["status"] for r in json.loads(out)["results"]], ["completed", "skipped"])
        self.assertEqual(len(net.posts()), 1)

    def test_no_access_stops_at_the_first_job_and_names_the_normal_procedure(self):
        net = FakeNet().on("POST", "/interactions", (403, api_error("permission_denied", "billing is not enabled")))
        code, out, _ = self.run_cli("image", "--id", "hero", "--prompt", "A wide hero", "--count", "3", *self.approved(), net=net)
        payload = json.loads(out)
        self.assertEqual((code, len(net.posts()), payload["results"][0]["error"]["kind"]), (77, 1, "no_access"))
        self.assertIn("normal procedure", payload["normal_procedure"])

    def test_no_key_means_normal_procedure_not_a_crash(self):
        code, out, _ = self.run_cli("image", "--id", "hero", "--prompt", "A wide hero", *self.approved(),
                                    env={"GEMINI_IMAGE_MODEL": "img-model-1"}, net=FakeNet())
        self.assertEqual(code, 77)
        self.assertIn("normal_procedure", json.loads(out))

    def test_blocked_and_empty_results(self):
        blocked = FakeNet().on("POST", "/interactions", (200, interaction("failed", errors=[{"code": "image_safety", "message": "blocked"}])))
        code, out, _ = self.run_cli("image", "--id", "a", "--prompt", "A wide hero", *self.approved(), net=blocked)
        self.assertEqual((code, json.loads(out)["results"][0]["error"]["kind"]), (1, "blocked"))
        empty = FakeNet().on("POST", "/interactions", (200, interaction(content=[{"type": "text", "text": "sorry"}])))
        _, out, _ = self.run_cli("image", "--id", "b", "--prompt", "A wide hero", *self.approved(), net=empty)
        self.assertEqual(json.loads(out)["results"][0]["error"]["kind"], "no_media")

    def test_corrupt_image_is_rejected_and_leaves_no_file(self):
        net = FakeNet().on("POST", "/interactions", (200, interaction(content=[{"type": "image", "mime_type": "image/png", "data": b64(b"not a png")}])))
        _, out, _ = self.run_cli("image", "--id", "bad", "--prompt", "A wide hero", *self.approved(), net=net)
        self.assertEqual(json.loads(out)["results"][0]["error"]["kind"], "invalid_response")
        self.assertEqual(list((self.root / "_sources" / "gemini" / "candidates").glob("*")), [])

    def test_prompts_with_credentials_and_bad_ids_are_refused_before_any_call(self):
        net = FakeNet()
        for argv in (["--id", "x", "--prompt", f"use {KEY} please"], ["--id", "bad id", "--prompt", "A wide hero"], ["--id", "x", "--prompt", "hi"]):
            code, _, _ = self.run_cli("image", *argv, *self.approved(), net=net)
            self.assertEqual(code, g3d.EXIT_USAGE, argv)
        self.assertEqual(net.requests, [])

    def test_clean_plate_flag_builds_the_reference_brief(self):
        code, _, _ = self.run_cli("image", "--id", "lamp-ref", "--subject", "a ceramic desk lamp", "--clean-plate", "--dry-run", "--json", "--root", str(self.root))
        self.assertEqual(code, 0)
        saved = json.loads((self.root / "_sources" / "gemini" / "lamp-ref.image-dry-run.json").read_text(encoding="utf-8"))
        self.assertEqual(saved["prompt_sha256"], hashlib.sha256(gm.clean_plate_prompt("a ceramic desk lamp").encode()).hexdigest())

    def test_promote_writes_asset_manifest_entry_prompt_and_receipt(self):
        net = self.image_net(png_bytes(300, 200))
        code, out, _ = self.run_cli("image", "--id", "hero", "--prompt", "A wide hero", "--promote", "--alt", "A warm hero scene", "--role", "hero",
                                    *self.approved(), net=net)
        self.assertEqual(code, 0, out)
        asset = self.root / "public" / "images" / "generated" / "hero.png"
        self.assertTrue(asset.is_file())
        entry = json.loads((self.root / "asset-manifest.json").read_text(encoding="utf-8"))["assets"][0]
        self.assertEqual((entry["id"], entry["type"], entry["source"], entry["role"], entry["optimization"], entry["alt"]),
                         ("hero", "image", "generated", "hero", "pending", "A warm hero scene"))
        self.assertEqual((entry["dimensions"], entry["format"], entry["generator"]["model"]), ({"width": 300, "height": 200}, "png", "img-model-1"))
        self.assertIn("SynthID", entry["license"])
        self.assertEqual((self.root / entry["promptRef"]).read_text(encoding="utf-8").strip(), "A wide hero")
        receipts = json.loads((self.root / "_sources" / "gemini" / "receipts.json").read_text(encoding="utf-8"))["hero"]
        self.assertEqual(receipts["final"]["sha256"], g3d.sha256_file(asset))
        self.assertNotIn(KEY, json.dumps(entry))

    def test_promote_guards(self):
        net = self.image_net(png_bytes(256, 256))
        _, out, _ = self.run_cli("image", "--id", "hero", "--prompt", "A wide hero", *self.approved(), net=net)
        candidate = str(self.root / json.loads(out)["results"][0]["file"])
        base = ["promote", "--candidate", candidate, "--id", "hero", "--root", str(self.root), "--json"]
        self.assertEqual(self.run_cli(*base)[0], g3d.EXIT_USAGE)  # no --alt
        self.assertEqual(self.run_cli(*base, "--alt", "x", "--critical")[0], g3d.EXIT_USAGE)  # critical needs a fallback
        self.assertEqual(self.run_cli(*base, "--alt", "x", "--critical", "--fallback", "solid colour")[0], 0)
        self.assertEqual(self.run_cli(*base, "--alt", "x")[0], g3d.EXIT_APPROVAL)  # exists: no silent overwrite
        stranger = self.root / "stranger.png"
        stranger.write_bytes(png_bytes(256, 256) + b"\x00")
        code, _, err = self.run_cli("promote", "--candidate", str(stranger), "--id", "x1", "--alt", "x", "--root", str(self.root))
        self.assertEqual(code, g3d.EXIT_USAGE)
        self.assertIn("provenance", err)

    def test_reference_still_can_be_tagged_for_a_3d_asset(self):
        net = self.image_net(png_bytes(256, 256))
        _, out, _ = self.run_cli("image", "--id", "lamp-ref", "--subject", "a ceramic desk lamp", "--clean-plate", *self.approved(), net=net)
        candidate = str(self.root / json.loads(out)["results"][0]["file"])
        code, _, _ = self.run_cli("promote", "--candidate", candidate, "--id", "lamp-ref", "--role", "reference", "--alt", "", "--reference-for", "lamp-3d",
                                  "--root", str(self.root), "--out-dir", "refs")
        self.assertEqual(code, 0)
        entry = json.loads((self.root / "asset-manifest.json").read_text(encoding="utf-8"))["assets"][0]
        self.assertIn("lamp-3d", entry["validation"]["notes"])
        self.assertEqual((entry["role"], entry["alt"], entry["path"]), ("reference", "", "refs/lamp-ref.png"))


# --------------------------------------------------------------------------------------------
# Video flow
# --------------------------------------------------------------------------------------------
class VideoFlowTests(Base):
    def video_net(self, iid="int_vid_1", polls=1):
        net = FakeNet().on("POST", "/interactions", (200, {"id": iid, "status": "in_progress"}))
        pending = [(200, {"id": iid, "status": "in_progress"})] * polls
        net.on("GET", f"/interactions/{iid}", *pending, (200, interaction(iid=iid, content=[vid_block(mp4())], usage={"total_tokens": 9000})))
        return net

    def never_finishing_net(self):
        net = FakeNet().on("POST", "/interactions", (200, {"id": "int_vid_1", "status": "in_progress"}))
        return net.on("GET", "/interactions/int_vid_1", (200, {"id": "int_vid_1", "status": "in_progress"}))

    def run_video(self, net, *extra):
        return self.run_cli("video", "--id", "clip", "--prompt", "A slow dolly through a studio", "--poll-interval", "1", *self.approved(*extra), net=net)

    def test_dry_run_discloses_background_mode_and_retention(self):
        _, out, _ = self.run_cli("video", "--id", "clip", "--prompt", "A slow dolly", "--dry-run", "--json", "--root", str(self.root), net=FakeNet())
        plan = json.loads(out)
        self.assertEqual((plan["mode"], plan["stored_by_google"], plan["max_jobs_allowed"]), ("background", True, 1))
        self.assertIn("55 days", plan["retention_note"])

    def test_background_job_completes_and_records_usage(self):
        net = self.video_net(polls=2)
        code, out, _ = self.run_video(net)
        self.assertEqual(code, 0, out)
        result = json.loads(out)["results"][0]
        self.assertEqual((result["status"], result["file"].endswith("clip.mp4"), result["usage"]["total_tokens"]), ("completed", True, 9000))
        self.assertEqual([r["method"] for r in net.requests], ["POST", "GET", "GET", "GET"])
        body = net.posts()[0]["body"]
        self.assertEqual((body["model"], body["background"], body["store"]), ("vid-model-1", True, True))
        self.assertEqual(self.jobs()[result["job_id"]]["interaction_id"], "int_vid_1")

    def test_the_job_id_is_saved_before_polling_starts(self):
        states = []
        net = self.video_net(polls=1)
        net.hooks.append(lambda r: states.append(self.jobs()[next(iter(self.jobs()))]["status"]) if r["method"] == "GET" else None)
        self.assertEqual(self.run_video(net)[0], 0)
        self.assertEqual(states[0], "in_progress")  # a crash here would not lose the paid job

    def test_timeout_leaves_the_job_running_then_status_resumes_it(self):
        net = self.never_finishing_net()
        code, out, _ = self.run_video(net, "--timeout", "5")
        error = json.loads(out)["results"][0]
        job_id = error["job_id"]
        self.assertEqual((code, error["error"]["kind"]), (gm.EXIT_INCOMPLETE, "still_running"))
        self.assertIn("NOT cancelled", error["error"]["message"])
        self.assertEqual(self.jobs()[job_id]["status"], "in_progress")
        self.assertEqual(len(net.posts()), 1)
        resume = FakeNet().on("GET", "/interactions/int_vid_1", (200, interaction(iid="int_vid_1", content=[vid_block(mp4())])))
        code, out, _ = self.run_cli("status", "--job", job_id, "--root", str(self.root), "--json", net=resume)
        self.assertEqual(code, 0, out)
        self.assertEqual((self.jobs()[job_id]["status"], (self.root / json.loads(out)["file"]).is_file()), ("completed", True))
        self.assertEqual(resume.posts(), [])

    def test_a_running_job_is_resumed_not_recreated_on_rerun(self):
        self.run_video(self.never_finishing_net(), "--timeout", "5")
        again = FakeNet().on("GET", "/interactions/int_vid_1", (200, interaction(iid="int_vid_1", content=[vid_block(mp4())])))
        code, _, _ = self.run_video(again)
        self.assertEqual((code, again.posts()), (0, []))

    def test_cancel(self):
        _, out, _ = self.run_video(self.never_finishing_net(), "--timeout", "3")
        job_id = json.loads(out)["results"][0]["job_id"]
        cancel = FakeNet().on("POST", "/interactions/int_vid_1/cancel", (200, {"id": "int_vid_1", "status": "cancelled"}))
        code, _, _ = self.run_cli("cancel", "--job", job_id, "--root", str(self.root), "--json", net=cancel)
        self.assertEqual((code, self.jobs()[job_id]["status"]), (0, "cancelled"))
        self.assertEqual(self.run_cli("cancel", "--job", job_id, "--root", str(self.root), net=cancel)[0], g3d.EXIT_USAGE)

    def test_image_to_video_needs_the_upload_approved(self):
        net = self.video_net()
        code, _, err = self.run_video(net, "--first-frame", str(self.ref))
        self.assertEqual((code, net.requests), (g3d.EXIT_APPROVAL, []))
        self.assertIn("ref.png", err)
        code, out, _ = self.run_video(net, "--first-frame", str(self.ref), "--approved-uploads", "ref.png")
        self.assertEqual(code, 0, out)
        body = net.posts()[0]["body"]
        self.assertEqual((body["generation_config"]["video_config"]["task"], [b["type"] for b in body["input"]]), ("image_to_video", ["text", "image"]))

    def test_edit_continues_a_completed_video(self):
        self.assertEqual(self.run_video(self.video_net())[0], 0)
        base_id = next(iter(self.jobs()))
        net = self.video_net(iid="int_vid_2")
        code, out, _ = self.run_cli("video", "--id", "clip-dusk", "--prompt", "Make it dusk", "--continue", base_id, "--task", "edit",
                                    "--poll-interval", "1", *self.approved(), net=net)
        self.assertEqual(code, 0, out)
        body = net.posts()[0]["body"]
        self.assertEqual((body["previous_interaction_id"], body["generation_config"]["video_config"]["task"], body["store"]), ("int_vid_1", "edit", True))
        for argv in (["--continue", "nope", "--task", "edit"], ["--continue", base_id]):
            code, _, _ = self.run_cli("video", "--id", "c3", "--prompt", "again please", *argv, *self.approved(), net=FakeNet())
            self.assertEqual(code, g3d.EXIT_USAGE, argv)

    def test_sync_mode_is_one_blocking_request(self):
        net = FakeNet().on("POST", "/interactions", (200, interaction(content=[vid_block(mp4())])))
        code, out, _ = self.run_video(net, "--sync", "--timeout", "600")
        self.assertEqual(code, 0, out)
        body = net.posts()[0]["body"]
        self.assertEqual((body["background"], body["store"], len(net.requests)), (False, False, 1))
        self.assertEqual(net.requests[0]["timeout"], 600)  # a blocking request waits as long as the job may take

    def test_uri_delivery_downloads_from_googles_file_endpoint(self):
        uri = "https://generativelanguage.googleapis.com/v1beta/files/abc123"
        net = FakeNet().on("POST", "/interactions", (200, {"id": "int_vid_1", "status": "in_progress"}))
        net.on("GET", "/interactions/int_vid_1", (200, interaction(iid="int_vid_1", content=[vid_block(uri=uri)])))
        net.on("GET", "/files/abc123:download?alt=media", (200, mp4()))
        code, out, _ = self.run_video(net, "--delivery", "uri")
        self.assertEqual(code, 0, out)
        self.assertEqual(net.posts()[0]["body"]["response_format"]["delivery"], "uri")
        self.assertEqual((self.root / json.loads(out)["results"][0]["file"]).read_bytes(), mp4())

    def test_failed_job_and_bad_video_bytes(self):
        failed = FakeNet().on("POST", "/interactions", (200, {"id": "int_vid_1", "status": "in_progress"}))
        failed.on("GET", "/interactions/int_vid_1", (200, interaction("failed", iid="int_vid_1", errors=[{"code": "content_blocked", "message": "no"}])))
        code, out, _ = self.run_video(failed)
        self.assertEqual((code, json.loads(out)["results"][0]["error"]["kind"]), (1, "blocked"))
        # a terminal failure is recorded, so a rerun creates a fresh (re-approved) job instead of resuming a dead one
        self.assertEqual(self.jobs()[json.loads(out)["results"][0]["job_id"]]["status"], "failed")
        junk = FakeNet().on("POST", "/interactions", (200, {"id": "int_vid_9", "status": "in_progress"}))
        junk.on("GET", "/interactions/int_vid_9", (200, interaction(iid="int_vid_9", content=[vid_block(b"this is not a video at all")])))
        _, out, _ = self.run_cli("video", "--id", "junk", "--prompt", "A slow dolly through a studio", "--poll-interval", "1", *self.approved(), net=junk)
        self.assertEqual(json.loads(out)["results"][0]["error"]["kind"], "invalid_response")
        self.assertEqual([p.name for p in (self.root / "_sources" / "gemini" / "candidates").glob("junk*")], [])

    def test_a_strange_interaction_id_is_refused(self):
        net = FakeNet().on("POST", "/interactions", (200, {"id": "../../etc/passwd", "status": "in_progress"}))
        _, out, _ = self.run_video(net)
        self.assertEqual(json.loads(out)["results"][0]["error"]["kind"], "invalid_response")
        self.assertEqual([r["method"] for r in net.requests], ["POST"])

    def test_promote_video_links_the_poster_fallback(self):
        self.assertEqual(self.run_video(self.video_net())[0], 0)
        candidate = str(self.root / "_sources" / "gemini" / "candidates" / "clip.mp4")
        code, out, _ = self.run_cli("promote", "--candidate", candidate, "--id", "hero-loop", "--root", str(self.root), "--role", "ambient-loop",
                                    "--out-dir", "public/video", "--fallback-asset", "hero-poster", "--json")
        self.assertEqual(code, 0, out)
        entry = json.loads((self.root / "asset-manifest.json").read_text(encoding="utf-8"))["assets"][0]
        self.assertEqual((entry["type"], entry["format"], entry["fallback"]["assetId"], entry["path"]), ("video", "mp4", "hero-poster", "public/video/hero-loop.mp4"))
        self.assertNotIn("alt", entry)


if __name__ == "__main__":
    unittest.main()

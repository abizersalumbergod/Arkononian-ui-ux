#!/usr/bin/env python3
"""Image -> raw GLB through a public Hugging Face Gradio Space.

Default backend: TRELLIS (``trellis-community/TRELLIS``).
Opt-in backend:  Hunyuan3D-2 (``tencent/Hunyuan3D-2``), experimental and licence-restricted.

This is NOT local generation. The input image is uploaded to a third-party Space, which runs the
model on Hugging Face GPUs (ZeroGPU: free, but quota- and queue-limited). The script therefore:

* refuses to submit a job without ``--approve-upload <space-id>`` and ``--approved-by <text>``
  (the user's approval, quoted); ``--dry-run`` shows the plan with zero provider calls;
* discovers the Space's endpoints at run time from its API schema instead of trusting names;
* submits each job exactly once (never resubmits after a timeout or error), polls with a deadline
  and cancels on timeout or Ctrl+C;
* validates the downloaded file as a real GLB and writes a receipt (hashes, seed, parameters,
  endpoints used) that never contains credentials.

Python 3.9+ and the standard library; ``gradio_client`` is imported only when a job is submitted.
Exit codes: 0 ok, 1 failure, 3 approval missing, 64 usage, 69 Space/dependency unavailable,
75 temporary (quota, queue, timeout, network), 77 authentication.
"""
from __future__ import annotations

import argparse
import hashlib
import inspect
import json
import os
import random
import re
import shutil
import struct
import sys
import tempfile
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

TOOL_VERSION = "1.0.0"

EXIT_OK = 0
EXIT_FAILED = 1
EXIT_APPROVAL = 3
EXIT_USAGE = 64
EXIT_UNAVAILABLE = 69
EXIT_TEMPFAIL = 75
EXIT_AUTH = 77

MAX_IMAGE_BYTES = 25 * 1024 * 1024
MIN_IMAGE_SIDE = 128
MAX_SEED = 2**31 - 1
SPACE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*/[A-Za-z0-9][A-Za-z0-9._-]*$")
HF_HOST_RE = re.compile(r"^https://[a-z0-9][a-z0-9.-]*\.hf\.space/?$")
TOKEN_RE = re.compile(r"(hf_[A-Za-z0-9]{20,}|[Bb]earer\s+[A-Za-z0-9._\-]{16,})")

HUNYUAN_LICENSE_NOTE = (
    "Tencent Hunyuan 3D 2.0 Community License: not valid in the European Union, the United Kingdom "
    "and South Korea; products with more than 1 million monthly active users need a separate licence."
)


@dataclass(frozen=True)
class BackendSpec:
    name: str
    default_space: str
    model_note: str
    license_note: str
    needs_license_ack: bool = False


BACKENDS: Dict[str, BackendSpec] = {
    "trellis": BackendSpec(
        name="trellis",
        default_space="trellis-community/TRELLIS",
        model_note="TRELLIS-image-large (as loaded by the Space source, checked 2026-10-29)",
        license_note="TRELLIS model weights: MIT (huggingface.co/JeffreyXiang/TRELLIS-image-large).",
    ),
    "hunyuan3d": BackendSpec(
        name="hunyuan3d",
        default_space="tencent/Hunyuan3D-2",
        model_note="Hunyuan3D-2 (Tencent); endpoints read from the Space source, not exercised live",
        license_note=HUNYUAN_LICENSE_NOTE,
        needs_license_ack=True,
    ),
}


class Gen3DError(Exception):
    """A classified failure. ``kind`` is stable and safe to print; ``message`` is already redacted."""

    def __init__(self, kind: str, message: str, exit_code: int = EXIT_FAILED, retryable: bool = False,
                 detail: Optional[dict] = None):
        super().__init__(message)
        self.kind = kind
        self.message = message
        self.exit_code = exit_code
        self.retryable = retryable
        self.detail = detail or {}


class GlbError(ValueError):
    pass


# --------------------------------------------------------------------------------------------
# Small helpers
# --------------------------------------------------------------------------------------------
_sleep: Callable[[float], None] = time.sleep
_now: Callable[[], float] = time.monotonic


def redact(text: Any, extra: tuple = ()) -> str:
    """Remove token-like strings (and any extra literal secrets) from text before it is shown or stored."""
    out = TOKEN_RE.sub("[REDACTED]", str(text))
    env_token = os.environ.get("HF_TOKEN")
    for secret in (env_token, *extra):
        if secret and len(secret) >= 8:
            out = out.replace(secret, "[REDACTED]")
    return out


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with open(path, "rb") as fh:
        for block in iter(lambda: fh.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _default_log(message: str) -> None:
    print(message, file=sys.stderr, flush=True)


def classify_error(err: Any) -> dict:
    """Map an exception or message to ``{kind, message, retryable, exit_code}`` (message redacted)."""
    if isinstance(err, Gen3DError):
        return {"kind": err.kind, "message": err.message, "retryable": err.retryable, "exit_code": err.exit_code}
    text = redact(err)
    low = text.lower()
    if "quota" in low and ("gpu" in low or "zerogpu" in low or "exceeded" in low):
        kind, retry, code = "quota", False, EXIT_TEMPFAIL
    elif "429" in low or "too many requests" in low or "rate limit" in low:
        kind, retry, code = "rate_limited", True, EXIT_TEMPFAIL
    elif "queue" in low and ("full" in low or "too many" in low):
        kind, retry, code = "queue_full", True, EXIT_TEMPFAIL
    elif isinstance(err, TimeoutError) or "timed out" in low or "timeout" in low:
        kind, retry, code = "timeout", True, EXIT_TEMPFAIL
    elif "401" in low or "403" in low or "unauthorized" in low or "forbidden" in low or "invalid token" in low:
        kind, retry, code = "auth", False, EXIT_AUTH
    elif any(w in low for w in ("sleeping", "building", "paused", "runtime error", "config error",
                                "could not get space", "space not found", "no app file")):
        kind, retry, code = "space_unavailable", True, EXIT_UNAVAILABLE
    elif any(w in low for w in ("connection", "ssl", "name resolution", "network is unreachable", "temporary failure")):
        kind, retry, code = "network", True, EXIT_TEMPFAIL
    else:
        kind, retry, code = "unknown", False, EXIT_FAILED
    return {"kind": kind, "message": text, "retryable": retry, "exit_code": code}


def _error_from(err: BaseException) -> Gen3DError:
    info = classify_error(err)
    return Gen3DError(info["kind"], info["message"], info["exit_code"], info["retryable"])


# --------------------------------------------------------------------------------------------
# Input image inspection (stdlib only: PNG, JPEG, WebP)
# --------------------------------------------------------------------------------------------
_JPEG_SOF = {0xC0, 0xC1, 0xC2, 0xC3, 0xC5, 0xC6, 0xC7, 0xC9, 0xCA, 0xCB, 0xCD, 0xCE, 0xCF}


def sniff_image(path: Path) -> dict:
    """Return ``{format, width, height, has_alpha, bytes, sha256}`` or raise Gen3DError(invalid_input)."""
    path = Path(path)
    if not path.is_file():
        raise Gen3DError("invalid_input", f"input image not found: {path.name}", EXIT_USAGE)
    size = path.stat().st_size
    if size == 0 or size > MAX_IMAGE_BYTES:
        raise Gen3DError("invalid_input", f"input image must be 1 byte to {MAX_IMAGE_BYTES // (1024 * 1024)} MiB (got {size} bytes)", EXIT_USAGE)
    data = path.read_bytes()
    fmt = width = height = None
    alpha = False
    if data[:8] == b"\x89PNG\r\n\x1a\n" and len(data) >= 26:
        fmt = "png"
        width, height = struct.unpack(">II", data[16:24])
        alpha = data[25] in (4, 6) or b"tRNS" in data[:4096]
    elif data[:2] == b"\xff\xd8":
        fmt = "jpeg"
        pos = 2
        while pos + 9 < len(data):
            if data[pos] != 0xFF:
                pos += 1
                continue
            marker = data[pos + 1]
            if marker == 0xFF:
                pos += 1
                continue
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:
                pos += 2
                continue
            seg = struct.unpack(">H", data[pos + 2:pos + 4])[0]
            if marker in _JPEG_SOF:
                height, width = struct.unpack(">HH", data[pos + 5:pos + 9])
                break
            pos += 2 + seg
    elif data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        fmt = "webp"
        chunk = data[12:16]
        if chunk == b"VP8X" and len(data) >= 30:
            alpha = bool(data[20] & 0x10)
            width = 1 + int.from_bytes(data[24:27], "little")
            height = 1 + int.from_bytes(data[27:30], "little")
        elif chunk == b"VP8 " and len(data) >= 30:
            width, height = (v & 0x3FFF for v in struct.unpack("<HH", data[26:30]))
        elif chunk == b"VP8L" and len(data) >= 25:
            bits = int.from_bytes(data[21:25], "little")
            width, height = (bits & 0x3FFF) + 1, ((bits >> 14) & 0x3FFF) + 1
            alpha = bool((bits >> 28) & 1)
    if not fmt or not width or not height:
        raise Gen3DError("invalid_input", "input must be a PNG, JPEG or WebP image whose size can be read", EXIT_USAGE)
    if min(width, height) < MIN_IMAGE_SIDE:
        raise Gen3DError("invalid_input", f"input image is {width}x{height}; the shorter side must be at least {MIN_IMAGE_SIDE}px", EXIT_USAGE)
    return {"format": fmt, "width": int(width), "height": int(height), "has_alpha": alpha,
            "bytes": size, "sha256": hashlib.sha256(data).hexdigest()}


# --------------------------------------------------------------------------------------------
# GLB inspection
# --------------------------------------------------------------------------------------------
def inspect_glb(path: Path) -> dict:
    """Validate the GLB container and return counts. Raises GlbError for anything that is not a real GLB 2.0."""
    path = Path(path)
    size = path.stat().st_size
    with open(path, "rb") as fh:
        head = fh.read(12)
        if len(head) < 12 or head[:4] != b"glTF":
            raise GlbError("not a GLB file (missing glTF magic)")
        version, length = struct.unpack("<II", head[4:12])
        if version != 2:
            raise GlbError(f"unsupported glTF container version {version}")
        if length != size:
            raise GlbError(f"GLB header declares {length} bytes but the file has {size}")
        chunk_head = fh.read(8)
        if len(chunk_head) < 8:
            raise GlbError("GLB has no JSON chunk")
        chunk_len, chunk_type = struct.unpack("<II", chunk_head)
        if chunk_type != 0x4E4F534A:
            raise GlbError("first GLB chunk is not JSON")
        raw = fh.read(chunk_len)
    if len(raw) != chunk_len:
        raise GlbError("GLB JSON chunk is truncated")
    try:
        doc = json.loads(raw.decode("utf-8").rstrip("\x00 "))
    except (UnicodeDecodeError, json.JSONDecodeError) as exc:
        raise GlbError(f"GLB JSON chunk is not valid JSON: {exc}") from exc
    accessors = doc.get("accessors") or []
    meshes = doc.get("meshes") or []
    triangles = 0
    primitives = 0
    mins: List[List[float]] = []
    maxs: List[List[float]] = []
    for mesh in meshes:
        for prim in mesh.get("primitives") or []:
            primitives += 1
            if prim.get("mode", 4) != 4:
                continue
            idx = prim.get("indices")
            pos = (prim.get("attributes") or {}).get("POSITION")
            source = idx if idx is not None else pos
            if source is not None and 0 <= source < len(accessors):
                triangles += int(accessors[source].get("count", 0)) // 3
            if pos is not None and 0 <= pos < len(accessors):
                acc = accessors[pos]
                if acc.get("min") and acc.get("max"):
                    mins.append(acc["min"])
                    maxs.append(acc["max"])
    dims = None
    if mins:
        lo = [min(m[i] for m in mins) for i in range(3)]
        hi = [max(m[i] for m in maxs) for i in range(3)]
        dims = [round(hi[i] - lo[i], 6) for i in range(3)]
    return {
        "bytes": size,
        "meshes": len(meshes),
        "primitives": primitives,
        "triangles": triangles,
        "materials": len(doc.get("materials") or []),
        "textures": len(doc.get("textures") or []),
        "images": len(doc.get("images") or []),
        "nodes": len(doc.get("nodes") or []),
        "animations": len(doc.get("animations") or []),
        "extensions_used": sorted(doc.get("extensionsUsed") or []),
        "bbox_size": dims,
    }


# --------------------------------------------------------------------------------------------
# Space probing (read-only, stdlib)
# --------------------------------------------------------------------------------------------
def check_space_id(space: str) -> str:
    if not isinstance(space, str) or not SPACE_ID_RE.match(space):
        raise Gen3DError("invalid_input", f"not a valid Space id (expected owner/name): {redact(space)[:80]}", EXIT_USAGE)
    return space


def _http_json(url: str, timeout: float) -> Any:
    req = urllib.request.Request(url, headers={"User-Agent": f"arkononion-image-to-3d/{TOOL_VERSION}", "Accept": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as resp:  # noqa: S310 (https only, host checked by callers)
        return json.loads(resp.read().decode("utf-8"))


def probe_space(space: str, timeout: float = 20.0) -> dict:
    """Read-only: ask the Hugging Face API for the Space's runtime stage. Never raises for network errors."""
    check_space_id(space)
    try:
        data = _http_json(f"https://huggingface.co/api/spaces/{space}", timeout)
    except urllib.error.HTTPError as exc:
        stage = "NOT_FOUND" if exc.code == 404 else f"HTTP_{exc.code}"
        return {"space": space, "stage": stage, "error": redact(exc)}
    except Exception as exc:  # noqa: BLE001 - network failure is reported, not raised
        return {"space": space, "stage": "UNREACHABLE", "error": redact(exc)}
    runtime = data.get("runtime") or {}
    hardware = (runtime.get("hardware") or {}).get("current")
    return {"space": space, "stage": runtime.get("stage") or "UNKNOWN", "hardware": hardware,
            "host": data.get("host"), "sdk": data.get("sdk"), "lastModified": data.get("lastModified")}


def fetch_api_info(host: str, timeout: float = 60.0) -> Optional[dict]:
    """Read-only GET of the Gradio API description. Returns None when the host is not an hf.space host or fails."""
    if not isinstance(host, str) or not HF_HOST_RE.match(host):
        return None
    base = host.rstrip("/")
    for suffix in ("/gradio_api/info", "/info"):
        try:
            info = _http_json(base + suffix, timeout)
            if isinstance(info, dict) and "named_endpoints" in info:
                return info
        except Exception:  # noqa: BLE001
            continue
    return None


# --------------------------------------------------------------------------------------------
# Endpoint schema handling
# --------------------------------------------------------------------------------------------
def parse_endpoints(info: Optional[dict]) -> Dict[str, dict]:
    """Normalise ``view_api(return_format='dict')`` / ``/gradio_api/info`` into ``{'/name': {parameters, returns}}``."""
    out: Dict[str, dict] = {}
    for raw_name, ep in ((info or {}).get("named_endpoints") or {}).items():
        name = raw_name if raw_name.startswith("/") else "/" + raw_name
        params = []
        for p in (ep or {}).get("parameters") or []:
            params.append({
                "name": p.get("parameter_name") or p.get("label"),
                "has_default": bool(p.get("parameter_has_default")),
                "default": p.get("parameter_default"),
            })
        out[name] = {"parameters": params, "returns": (ep or {}).get("returns") or []}
    return out


def select_values(endpoints: Dict[str, dict], api_name: str, values: Dict[str, Any]) -> tuple:
    """Pick the values this endpoint accepts. Returns ``(kwargs, ignored_names, missing_required_names)``."""
    ep = endpoints[api_name]
    accepted = {p["name"]: p for p in ep["parameters"]}
    kwargs = {n: v for n, v in values.items() if n in accepted}
    ignored = sorted(n for n in values if n not in accepted)
    missing = sorted(n for n, p in accepted.items() if n not in kwargs and not p["has_default"])
    return kwargs, ignored, missing


def collect_paths(obj: Any, _depth: int = 0) -> List[str]:
    """Every string that could be a file path inside a (possibly nested) Gradio result."""
    if _depth > 6 or obj is None:
        return []
    if isinstance(obj, str):
        return [obj]
    if isinstance(obj, dict):
        found: List[str] = []
        for key in ("path", "value", "name", "video", "model3d", "image"):
            if key in obj:
                found.extend(collect_paths(obj[key], _depth + 1))
        return found
    if isinstance(obj, (list, tuple)):
        found = []
        for item in obj:
            found.extend(collect_paths(item, _depth + 1))
        return found
    return []


def existing_files(obj: Any, suffix: str) -> List[Path]:
    seen: List[Path] = []
    for candidate in collect_paths(obj):
        try:
            p = Path(candidate)
            if p.suffix.lower() == suffix and p.is_file() and p not in seen:
                seen.append(p)
        except (OSError, ValueError):
            continue
    return seen


# --------------------------------------------------------------------------------------------
# Parameters and plan
# --------------------------------------------------------------------------------------------
@dataclass
class GenParams:
    seed: Optional[int] = None
    preprocess: str = "always"  # always | never
    ss_guidance: float = 7.5
    ss_steps: int = 12
    slat_guidance: float = 3.0
    slat_steps: int = 12
    mesh_simplify: float = 0.95
    texture_size: int = 1024
    hy_steps: int = 50
    hy_guidance: float = 7.5
    hy_octree: int = 256
    hy_chunks: int = 200000
    hy_textured: bool = True

    def validate(self) -> None:
        def bad(msg: str) -> None:
            raise Gen3DError("invalid_input", msg, EXIT_USAGE)
        if self.seed is not None and not 0 <= self.seed <= MAX_SEED:
            bad(f"seed must be between 0 and {MAX_SEED}")
        if self.preprocess not in ("always", "never"):
            bad("preprocess must be 'always' or 'never'")
        if not 0.0 <= self.ss_guidance <= 10.0 or not 0.0 <= self.slat_guidance <= 10.0:
            bad("guidance strengths must be between 0 and 10")
        if not 1 <= self.ss_steps <= 50 or not 1 <= self.slat_steps <= 50:
            bad("sampling steps must be between 1 and 50")
        if not 0.9 <= self.mesh_simplify <= 0.98:
            bad("mesh-simplify must be between 0.90 and 0.98")
        if self.texture_size not in (512, 1024, 1536, 2048):
            bad("texture-size must be 512, 1024, 1536 or 2048")


def build_plan(image: Path, out: Path, backend: str, space: str, params: GenParams, image_info: dict) -> dict:
    spec = BACKENDS[backend]
    if backend == "trellis":
        expected = (["/preprocess_image"] if params.preprocess == "always" else []) + ["/generate_and_extract_glb"]
    else:
        expected = ["/generation_all" if params.hy_textured else "/shape_generation"]
    return {
        "tool": "generate_3d.py",
        "tool_version": TOOL_VERSION,
        "backend": backend,
        "space": space,
        "model": spec.model_note,
        "license_note": spec.license_note,
        "input": {"file": Path(image).name, **{k: image_info[k] for k in ("format", "width", "height", "has_alpha", "bytes", "sha256")}},
        "output": Path(out).name,
        "params": asdict(params),
        "expected_endpoints": expected,
        "endpoint_resolution": "read from the Space API schema at run time; a different layout is adapted or rejected with a clear error",
        "uploads": [Path(image).name],
        "cost": "free tier (ZeroGPU quota); no price is quoted by the provider",
    }


# --------------------------------------------------------------------------------------------
# Client handling
# --------------------------------------------------------------------------------------------
def _handle_file(path: Any) -> Any:
    try:
        from gradio_client import handle_file
    except ImportError as exc:
        raise Gen3DError("dependency_missing", "gradio_client is not installed; run image_to_glb.py setup", EXIT_UNAVAILABLE) from exc
    return handle_file(str(path))


def make_client(space: str, token: Optional[str], download_dir: Path, timeout: float) -> Any:
    try:
        from gradio_client import Client
    except ImportError as exc:
        raise Gen3DError("dependency_missing", "gradio_client is not installed; run image_to_glb.py setup", EXIT_UNAVAILABLE) from exc
    accepted = inspect.signature(Client.__init__).parameters
    kwargs: Dict[str, Any] = {}
    if "verbose" in accepted:
        kwargs["verbose"] = False
    if token:
        kwargs["token" if "token" in accepted else "hf_token"] = token
    if "download_files" in accepted:
        kwargs["download_files"] = str(download_dir)
    elif "output_dir" in accepted:
        kwargs["output_dir"] = str(download_dir)
    if "httpx_kwargs" in accepted:
        try:
            import httpx
            kwargs["httpx_kwargs"] = {"timeout": httpx.Timeout(30.0, read=float(timeout) + 60.0)}
        except ImportError:
            pass
    return Client(space, **kwargs)


def open_client(space: str, token: Optional[str], download_dir: Path, timeout: float,
                factory: Optional[Callable[..., Any]], log: Callable[[str], None], attempts: int = 3) -> Any:
    """Create the client. Only this read-only step is retried (a cold Space may need a moment); no job exists yet."""
    make = factory or make_client
    delay = 5.0
    for attempt in range(1, attempts + 1):
        try:
            return make(space, token, download_dir, timeout)
        except Gen3DError:
            raise
        except Exception as exc:  # noqa: BLE001
            err = _error_from(exc)
            if attempt == attempts or not err.retryable:
                raise err from exc
            log(f"[connect] attempt {attempt} failed ({err.kind}); retrying in {delay:.0f}s")
            _sleep(delay)
            delay *= 2
    raise Gen3DError("unknown", "client could not be created")  # pragma: no cover


def call_endpoint(client: Any, api_name: str, kwargs: Dict[str, Any], timeout: float,
                  log: Callable[[str], None], poll: float = 2.0) -> Any:
    """Submit ONE job, poll until done or the deadline, cancel on timeout/interrupt, return the raw result."""
    started = _now()
    deadline = started + timeout
    job = client.submit(api_name=api_name, **kwargs)
    last_note = None
    last_log = started
    try:
        while not job.done():
            if _now() > deadline:
                cancelled = False
                try:
                    cancelled = bool(job.cancel())
                except Exception:  # noqa: BLE001
                    pass
                raise Gen3DError(
                    "timeout",
                    f"{api_name} did not finish within {timeout:.0f}s (cancel {'accepted' if cancelled else 'is best-effort: a job already running on the GPU may still finish remotely'}). "
                    "The job was not resubmitted.",
                    EXIT_TEMPFAIL, True)
            try:
                status = job.status()
                note = (getattr(status, "code", None), getattr(status, "rank", None), getattr(status, "queue_size", None))
            except Exception:  # noqa: BLE001
                note = None
            if note != last_note or _now() - last_log > 30:
                if note:
                    code, rank, qsize = note
                    log(f"[{api_name}] status={getattr(code, 'name', code)} queue={rank}/{qsize}")
                last_note, last_log = note, _now()
            _sleep(poll)
        return job.result(timeout=30)
    except KeyboardInterrupt:
        try:
            job.cancel()
        except Exception:  # noqa: BLE001
            pass
        raise Gen3DError("cancelled", "interrupted by the user; the job was cancelled where the provider allows it", EXIT_FAILED)
    except Gen3DError:
        raise
    except Exception as exc:  # noqa: BLE001 - remote errors are classified, never retried automatically
        raise _error_from(exc) from exc


# --------------------------------------------------------------------------------------------
# Backends
# --------------------------------------------------------------------------------------------
def _need(endpoints: Dict[str, dict], name: str) -> None:
    if name not in endpoints:
        raise Gen3DError("endpoint_mismatch", f"Space has no {name} endpoint. Available: {', '.join(sorted(endpoints)) or 'none'}", EXIT_UNAVAILABLE)


def _call(client: Any, endpoints: Dict[str, dict], api_name: str, values: Dict[str, Any], timeout: float,
          log: Callable[[str], None], calls: List[dict]) -> Any:
    kwargs, ignored, missing = select_values(endpoints, api_name, values)
    if missing:
        raise Gen3DError("endpoint_mismatch", f"{api_name} needs parameter(s) this tool does not provide: {', '.join(missing)}", EXIT_UNAVAILABLE)
    if ignored:
        log(f"[{api_name}] ignoring values the endpoint does not accept: {', '.join(ignored)}")
    t0 = _now()
    log(f"[{api_name}] submitting")
    result = call_endpoint(client, api_name, kwargs, timeout, log)
    calls.append({"endpoint": api_name, "seconds": round(_now() - t0, 1), "parameters": sorted(kwargs)})
    return result


def run_trellis(client: Any, endpoints: Dict[str, dict], image: Path, params: GenParams, seed: int,
                timeout: float, log: Callable[[str], None]) -> tuple:
    calls: List[dict] = []
    warnings: List[str] = []
    source = Path(image)
    if params.preprocess == "always":
        if "/preprocess_image" in endpoints:
            res = _call(client, endpoints, "/preprocess_image", {"image": _handle_file(source)}, timeout, log, calls)
            processed = existing_files(res, ".png") or existing_files(res, ".webp") or existing_files(res, ".jpg")
            if not processed:
                raise Gen3DError("invalid_response", "/preprocess_image returned no downloadable image", EXIT_FAILED)
            source = processed[0]
        else:
            warnings.append("Space has no /preprocess_image; sent the original image (background not removed)")
    gen_values = {
        "image": _handle_file(source),
        "seed": seed,
        "ss_guidance_strength": params.ss_guidance,
        "ss_sampling_steps": params.ss_steps,
        "slat_guidance_strength": params.slat_guidance,
        "slat_sampling_steps": params.slat_steps,
        "mesh_simplify": params.mesh_simplify,
        "texture_size": params.texture_size,
    }
    if "/generate_and_extract_glb" in endpoints:
        res = _call(client, endpoints, "/generate_and_extract_glb", gen_values, timeout, log, calls)
    elif "/image_to_3d" in endpoints and "/extract_glb" in endpoints:
        warnings.append("Space uses the legacy two-step layout (/image_to_3d + /extract_glb); handled from its schema, not exercised live")
        _call(client, endpoints, "/image_to_3d", gen_values, timeout, log, calls)
        res = _call(client, endpoints, "/extract_glb", gen_values, timeout, log, calls)
    else:
        raise Gen3DError("endpoint_mismatch",
                         "Space exposes neither /generate_and_extract_glb nor /image_to_3d + /extract_glb. "
                         f"Available: {', '.join(sorted(endpoints)) or 'none'}", EXIT_UNAVAILABLE)
    glbs = existing_files(res, ".glb")
    if not glbs:
        raise Gen3DError("invalid_response", "the Space finished but returned no downloadable .glb file", EXIT_FAILED)
    return glbs[0], calls, warnings


def run_hunyuan(client: Any, endpoints: Dict[str, dict], image: Path, params: GenParams, seed: int,
                timeout: float, log: Callable[[str], None]) -> tuple:
    calls: List[dict] = []
    warnings = ["Hunyuan3D-2 backend is experimental: parameters are mapped by name from the Space schema and the flow was not exercised live"]
    api_name = "/generation_all" if params.hy_textured else "/shape_generation"
    if api_name not in endpoints and params.hy_textured and "/shape_generation" in endpoints:
        api_name = "/shape_generation"
        warnings.append("textured endpoint /generation_all not found: output is an UNTEXTURED mesh")
    _need(endpoints, api_name)
    values = {
        "image": _handle_file(image),
        "steps": params.hy_steps,
        "guidance_scale": params.hy_guidance,
        "seed": seed,
        "octree_resolution": params.hy_octree,
        "check_box_rembg": params.preprocess == "always",
        "num_chunks": params.hy_chunks,
        "randomize_seed": False,
    }
    res = _call(client, endpoints, api_name, values, timeout, log, calls)
    glbs = existing_files(res, ".glb")
    if not glbs:
        raise Gen3DError("invalid_response", "the Space finished but returned no downloadable .glb file", EXIT_FAILED)
    return (glbs[-1] if api_name == "/generation_all" else glbs[0]), calls, warnings


# --------------------------------------------------------------------------------------------
# Public API
# --------------------------------------------------------------------------------------------
def write_json(path: Path, data: dict) -> None:
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix(path.suffix + ".tmp")
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    os.replace(tmp, path)


def generate(image: Path, out: Path, *, backend: str = "trellis", space: Optional[str] = None,
             params: Optional[GenParams] = None, timeout: float = 900.0, dry_run: bool = False,
             approve_upload: Optional[str] = None, approved_by: Optional[str] = None,
             accept_license: bool = False, token: Optional[str] = None,
             log: Callable[[str], None] = _default_log, client_factory: Optional[Callable[..., Any]] = None,
             skip_probe: bool = False, receipt_path: Optional[Path] = None) -> dict:
    """Image -> raw GLB at ``out``. Returns a result dict; raises Gen3DError on any failure."""
    if backend not in BACKENDS:
        raise Gen3DError("invalid_input", f"unknown backend {backend!r}; choose one of: {', '.join(BACKENDS)}", EXIT_USAGE)
    spec = BACKENDS[backend]
    space = check_space_id(space or spec.default_space)
    params = params or GenParams()
    params.validate()
    image, out = Path(image), Path(out)
    info = sniff_image(image)
    plan = build_plan(image, out, backend, space, params, info)

    if dry_run:
        result = {"ok": True, "dry_run": True, "provider_calls": 0, "plan": plan}
        if receipt_path:
            write_json(receipt_path, {"dry_run": True, "submit": False, "provider_calls": 0, **plan})
        return result

    if not approve_upload or approve_upload.strip().lower() != space.lower():
        raise Gen3DError("approval_required",
                         f"This sends '{image.name}' to the third-party Space '{space}'. Get the user's explicit yes naming that file and Space, "
                         f"then pass --approve-upload {space} --approved-by \"<who, when, quote>\".", EXIT_APPROVAL)
    if not approved_by or not approved_by.strip():
        raise Gen3DError("approval_required", "--approved-by is required: record who approved the upload and when", EXIT_APPROVAL)
    if spec.needs_license_ack and not accept_license:
        raise Gen3DError("approval_required", f"{spec.name} needs --accept-hunyuan-license after the user has read: {spec.license_note}", EXIT_APPROVAL)

    if not skip_probe:
        probe = probe_space(space)
        if probe["stage"] not in ("RUNNING", "UNREACHABLE"):
            raise Gen3DError("space_unavailable", f"Space '{space}' is in stage {probe['stage']}; try again later or pick another backend with fresh approval", EXIT_UNAVAILABLE, True, probe)
        if probe["stage"] == "UNREACHABLE":
            log(f"[probe] could not reach the Hugging Face API ({probe.get('error', '')[:120]}); continuing")

    secrets = (token,) if token else ()
    seed = params.seed if params.seed is not None else random.SystemRandom().randrange(0, MAX_SEED)
    started = time.time()
    tmp_dir = Path(tempfile.mkdtemp(prefix="image-to-3d-"))
    client = None
    try:
        try:
            client = open_client(space, token, tmp_dir, timeout, client_factory, log)
            endpoints = parse_endpoints(client.view_api(return_format="dict", print_info=False))
        except Gen3DError:
            raise
        except Exception as exc:  # noqa: BLE001
            raise _error_from(exc) from exc
        if not endpoints:
            raise Gen3DError("endpoint_mismatch", f"Space '{space}' exposes no named API endpoints", EXIT_UNAVAILABLE)
        runner = run_trellis if backend == "trellis" else run_hunyuan
        glb_path, calls, warnings = runner(client, endpoints, image, params, seed, timeout, log)

        try:
            stats = inspect_glb(glb_path)
        except GlbError as exc:
            raise Gen3DError("invalid_response", f"downloaded file is not a valid GLB: {exc}", EXIT_FAILED) from exc
        out.parent.mkdir(parents=True, exist_ok=True)
        staged = out.with_suffix(out.suffix + ".tmp")
        shutil.copyfile(glb_path, staged)
        os.replace(staged, out)
        digest = sha256_file(out)
    except Gen3DError as err:
        err.message = redact(err.message, secrets)
        raise
    finally:
        closer = getattr(client, "close", None)
        if callable(closer):
            try:
                closer()
            except Exception:  # noqa: BLE001
                pass
        shutil.rmtree(tmp_dir, ignore_errors=True)

    result = {
        "ok": True, "dry_run": False, "provider_calls": len(calls), "out": str(out), "bytes": out.stat().st_size,
        "sha256": digest, "seed": seed, "backend": backend, "space": space, "endpoints": calls, "glb": stats,
        "warnings": warnings, "seconds": round(time.time() - started, 1), "plan": plan,
    }
    if receipt_path:
        write_json(receipt_path, {
            "dry_run": False, "approved_by": approved_by.strip(), "provider_calls": len(calls),
            **{k: result[k] for k in ("backend", "space", "seed", "endpoints", "glb", "warnings", "seconds")},
            "input": plan["input"], "params": plan["params"], "model": plan["model"], "license_note": plan["license_note"],
            "output": {"file": out.name, "bytes": result["bytes"], "sha256": digest},
            "generated_on": time.strftime("%Y-%m-%d", time.gmtime()),
        })
    return result


# --------------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="generate_3d.py",
        description="Image -> raw GLB via a public Hugging Face Space (remote, free-tier). Needs explicit upload approval.",
        epilog="Exit codes: 0 ok, 1 failure, 3 approval missing, 64 usage, 69 Space unavailable, 75 temporary, 77 auth.")
    p.add_argument("--image", help="input PNG/JPEG/WebP (clean plate: one object, plain background)")
    p.add_argument("--out", help="output raw GLB path")
    p.add_argument("--backend", choices=sorted(BACKENDS), default="trellis")
    p.add_argument("--space", help="override the Space id (owner/name); env TRELLIS_SPACE also works for trellis")
    p.add_argument("--seed", type=int, help=f"0..{MAX_SEED}; random when omitted (always recorded)")
    p.add_argument("--preprocess", choices=("always", "never"), default="always", help="remove the background on the Space first (default always)")
    p.add_argument("--ss-guidance", type=float, default=7.5)
    p.add_argument("--ss-steps", type=int, default=12)
    p.add_argument("--slat-guidance", type=float, default=3.0)
    p.add_argument("--slat-steps", type=int, default=12)
    p.add_argument("--mesh-simplify", type=float, default=0.95, help="0.90..0.98 (TRELLIS)")
    p.add_argument("--texture-size", type=int, default=1024, help="512/1024/1536/2048 (TRELLIS)")
    p.add_argument("--hy-steps", type=int, default=50)
    p.add_argument("--hy-guidance", type=float, default=7.5)
    p.add_argument("--hy-octree", type=int, default=256)
    p.add_argument("--hy-chunks", type=int, default=200000)
    p.add_argument("--hy-untextured", action="store_true", help="Hunyuan: shape only, no texture")
    p.add_argument("--timeout", type=float, default=900.0, help="seconds per remote job before cancel (default 900)")
    p.add_argument("--dry-run", action="store_true", help="plan + receipt, zero provider calls, no network")
    p.add_argument("--approve-upload", metavar="SPACE", help="the Space id the user approved sending the image to")
    p.add_argument("--approved-by", metavar="TEXT", help="who approved, when, and the quote")
    p.add_argument("--accept-hunyuan-license", action="store_true")
    p.add_argument("--skip-probe", action="store_true", help="skip the read-only Space status check")
    p.add_argument("--receipt", help="write a JSON receipt (no credentials) to this path")
    p.add_argument("--probe", action="store_true", help="read-only: Space stage + endpoint names, then exit (no upload)")
    p.add_argument("--json", action="store_true", help="print the result as JSON on stdout")
    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    try:
        spec = BACKENDS[args.backend]
        space = args.space or (os.environ.get("TRELLIS_SPACE") if args.backend == "trellis" else None) or spec.default_space
        if args.probe:
            probe = probe_space(check_space_id(space))
            info = fetch_api_info(probe["host"]) if probe.get("stage") == "RUNNING" and probe.get("host") else None
            probe["endpoints"] = {n: [p["name"] for p in ep["parameters"]] for n, ep in parse_endpoints(info).items()} if info else None
            print(json.dumps(probe, indent=2))
            return EXIT_OK if probe.get("stage") == "RUNNING" else EXIT_UNAVAILABLE
        if not args.image or not args.out:
            raise Gen3DError("invalid_input", "--image and --out are required (or use --probe)", EXIT_USAGE)
        params = GenParams(
            seed=args.seed, preprocess=args.preprocess, ss_guidance=args.ss_guidance, ss_steps=args.ss_steps,
            slat_guidance=args.slat_guidance, slat_steps=args.slat_steps, mesh_simplify=args.mesh_simplify,
            texture_size=args.texture_size, hy_steps=args.hy_steps, hy_guidance=args.hy_guidance,
            hy_octree=args.hy_octree, hy_chunks=args.hy_chunks, hy_textured=not args.hy_untextured)
        result = generate(
            Path(args.image), Path(args.out), backend=args.backend, space=space, params=params, timeout=args.timeout,
            dry_run=args.dry_run, approve_upload=args.approve_upload, approved_by=args.approved_by,
            accept_license=args.accept_hunyuan_license, token=os.environ.get("HF_TOKEN") or None,
            skip_probe=args.skip_probe, receipt_path=Path(args.receipt) if args.receipt else None)
    except Gen3DError as err:
        if getattr(args, "json", False):
            print(json.dumps({"ok": False, "error": {"kind": err.kind, "message": err.message, "retryable": err.retryable}}))
        print(f"error[{err.kind}]: {err.message}", file=sys.stderr)
        return err.exit_code
    if args.json:
        print(json.dumps(result, indent=2))
    elif result.get("dry_run"):
        print(f"DRY RUN (0 provider calls): would send {result['plan']['input']['file']} to {result['plan']['space']} "
              f"using {', '.join(result['plan']['expected_endpoints'])}")
    else:
        g = result["glb"]
        print(f"OK {result['out']} ({result['bytes']} bytes, {g['triangles']} triangles, {g['materials']} materials, "
              f"{g['textures']} textures) seed={result['seed']} in {result['seconds']}s")
        for w in result["warnings"]:
            print(f"warning: {w}", file=sys.stderr)
    return EXIT_OK


if __name__ == "__main__":
    sys.exit(main())

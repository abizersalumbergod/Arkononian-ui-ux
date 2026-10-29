#!/usr/bin/env python3
"""Optional Gemini stage: images and video for websites, and reference stills for the image-to-3D step.

Only for people who have Gemini API access (a billing-enabled key: Google's pricing page lists the image and
video models as paid-only). Without a key every command here says "not configured" and the NORMAL PROCEDURE
applies: a user-supplied image, licensed retrieval, procedural assets, or another generator (see
references/asset-generation.md). Nothing in the rest of the skill depends on this file.

What it does (Interactions API, ``POST /v1beta/interactions``, key in the ``x-goog-api-key`` header):

* ``image``   text-to-image and image editing (reference images in, new image out); several candidates per brief;
* ``video``   text-to-video, image-to-video from a still, conversational edit/extend of an earlier video;
* ``promote`` turn a chosen candidate into a shippable asset with a manifest entry and provenance;
* ``status`` / ``cancel`` resume or cancel a background video job; ``--dry-run`` on every generator;
* ``capabilities`` / ``doctor`` say what is supported and whether Gemini is configured, without any paid call.

Safety rules, shared with the rest of the toolkit: every paid call needs ``--approve-provider gemini`` plus
``--approved-by "<who, when, quote>"`` (and ``--approved-uploads`` naming any local image sent to Google); a job is
created once and never resubmitted automatically; the API key comes from the environment (or an explicit
``--env-file``), is never printed, stored or put in a URL, and is redacted from every message.

Python 3.9+, standard library only. Exit codes: 0 ok, 1 failure, 2 incomplete (job still running), 3 approval or
budget confirmation missing, 64 usage, 69 model/unsupported, 75 temporary (rate limit, quota, overload, timeout),
77 no access (key missing/invalid, billing, permission).
"""
from __future__ import annotations

import argparse
import base64
import binascii
import concurrent.futures
import hashlib
import json
import os
import random
import re
import shutil
import socket
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence, Tuple

sys.path.insert(0, str(Path(__file__).resolve().parent))
import generate_3d as g3d  # noqa: E402

TOOL = "gemini_media.py"
TOOL_VERSION = "1.0.0"
API_HOST = "generativelanguage.googleapis.com"
API_BASE = f"https://{API_HOST}/v1beta"
KEY_HEADER = "x-goog-api-key"

ENV_KEY = "GEMINI_API_KEY"
ENV_IMAGE = "GEMINI_IMAGE_MODEL"
ENV_VIDEO = "GEMINI_VIDEO_MODEL"
ENV_MAX_JOBS = "GEMINI_MAX_JOBS_PER_RUN"
ENV_TIMEOUT = "GEMINI_TIMEOUT_SECONDS"
ENV_ALLOWED = (ENV_KEY, ENV_IMAGE, ENV_VIDEO, ENV_MAX_JOBS, ENV_TIMEOUT)

# Suggestions from Google's docs (read 2026-10-29). They are never used implicitly: models come from configuration.
SUGGESTED_MODELS = {"image": "gemini-nano-banana-2.1", "video": "gemini-omni-1.1-flash"}

ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
MODEL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]{1,80}$")
ASPECT_RE = re.compile(r"^\d{1,2}:\d{1,2}$")
INTERACTION_ID_RE = re.compile(r"^[A-Za-z0-9_\-.=:~]{4,300}$")
IMAGE_SIZES = ("1K", "2K", "4K")
VIDEO_ASPECTS = ("16:9", "9:16")
VIDEO_RESOLUTIONS = ("360p", "720p", "1080p", "4k")
VIDEO_TASKS = ("text_to_video", "image_to_video", "reference_to_video", "edit", "extend")
IMAGE_EXT = {"png": ".png", "jpeg": ".jpg", "webp": ".webp"}
IMAGE_MIME = {"png": "image/png", "jpeg": "image/jpeg", "webp": "image/webp"}
MAX_REFERENCE_IMAGES = 10
MAX_RESPONSE_BYTES = 400 * 1024 * 1024
DEFAULT_MAX_JOBS = {"image": 4, "video": 1}
GOOGLE_KEY_RE = re.compile(r"AIza[0-9A-Za-z_\-]{20,}")

EXIT_INCOMPLETE = 2

# Capability identifiers shared with the rest of the skill. Anything not verified is an explicit "unsupported".
CAPABILITIES: Dict[str, Dict[str, Any]] = {
    "image.generate": {"supported": True, "provider": "gemini", "command": "image"},
    "image.edit": {"supported": True, "provider": "gemini", "command": "image --input-image"},
    "video.generate": {"supported": True, "provider": "gemini", "command": "video [--first-frame]"},
    "video.edit": {"supported": True, "provider": "gemini", "command": "video --continue <job> --task edit|extend",
                   "note": "conversational edit/extend of a video this toolkit generated; editing an uploaded video is not implemented "
                           "(Google lists it as unavailable in the EEA, Switzerland and the UK)"},
    "video.analyze": {"supported": False, "reason": "not verified in the Gemini image-generation and video docs this toolkit was built from"},
    "asset.validate": {"supported": True, "provider": "local", "command": "node scripts/asset-validation.mjs --manifest <file> --root <dir>"},
    "asset.optimize": {"supported": False, "reason": "not provided here; follow references/image-pipelines.md and references/video-pipelines.md"},
    "asset.discover": {"supported": False, "reason": "not a provider capability; reuse project assets and licensed retrieval (references/asset-generation.md)"},
    "model3d.generate": {"supported": False, "reason": "Gemini does not produce 3D models; use the TRELLIS route (image_to_glb.py run) with a Gemini reference still"},
}

NORMAL_PROCEDURE = ("Gemini is not usable here, so the normal procedure applies: a user-supplied image, licensed retrieval, "
                    "procedural assets or another approved generator (references/asset-generation.md). Record this in the report.")


# --------------------------------------------------------------------------------------------
# Errors
# --------------------------------------------------------------------------------------------
class GeminiError(g3d.Gen3DError):
    """Classified failure. ``fallback`` is True when the normal (non-Gemini) procedure should be used instead."""

    def __init__(self, kind: str, message: str, exit_code: int = g3d.EXIT_FAILED, retryable: bool = False,
                 reject: bool = False, fallback: bool = False, http_status: Optional[int] = None,
                 code: Optional[str] = None, retry_after: Optional[float] = None):
        super().__init__(kind, message, exit_code, retryable)
        self.reject = reject
        self.fallback = fallback
        self.http_status = http_status
        self.code = code
        self.retry_after = retry_after


# code -> (kind, exit code, retryable for GET, request-was-rejected so a POST may be retried, normal procedure applies)
_ERROR_TABLE: Dict[str, Tuple[str, int, bool, bool, bool]] = {
    "invalid_request": ("invalid_request", 1, False, False, False),
    "parameter_unknown": ("invalid_request", 1, False, False, False),
    "out_of_range": ("invalid_request", 1, False, False, False),
    "failed_precondition": ("no_access", 77, False, False, True),
    "authentication": ("no_access", 77, False, False, True),
    "payment_required": ("no_access", 77, False, False, True),
    "permission_denied": ("no_access", 77, False, False, True),
    "not_found": ("not_found", 69, False, False, False),
    "model_not_found": ("model_not_found", 69, False, False, True),
    "already_exists": ("conflict", 1, False, False, False),
    "aborted": ("conflict", 75, True, False, False),
    "rate_limit_exceeded": ("rate_limited", 75, True, True, False),
    "too_many_requests": ("rate_limited", 75, True, True, False),
    "quota_exceeded": ("quota", 75, False, False, False),
    "cancelled": ("cancelled", 1, False, False, False),
    "api_error": ("server_error", 75, True, False, False),
    "unimplemented": ("unsupported", 69, False, False, True),
    "service_unavailable": ("unavailable", 75, True, True, False),
    "deadline_exceeded": ("timeout", 75, True, False, False),
}
_CLASSIC_STATUS = {"resource_exhausted": "rate_limit_exceeded", "unauthenticated": "authentication", "permission_denied": "permission_denied",
                   "not_found": "not_found", "invalid_argument": "invalid_request", "unavailable": "service_unavailable",
                   "deadline_exceeded": "deadline_exceeded", "failed_precondition": "failed_precondition", "internal": "api_error"}
_HTTP_CODE = {400: "invalid_request", 401: "authentication", 402: "payment_required", 403: "permission_denied", 404: "not_found",
              409: "aborted", 416: "out_of_range", 429: "rate_limit_exceeded", 500: "api_error", 501: "unimplemented",
              503: "service_unavailable", 504: "deadline_exceeded"}
BLOCKED_CODES = {"safety", "recitation", "language", "prohibited_content", "spii", "blocklist", "image_safety",
                 "image_prohibited_content", "image_recitation", "image_other", "content_blocked"}


def redact(text: Any, cfg: Optional["GeminiConfig"] = None) -> str:
    out = GOOGLE_KEY_RE.sub("[REDACTED]", g3d.redact(text))
    key = (cfg.api_key if cfg else None) or os.environ.get(ENV_KEY)
    if key and len(key) >= 8:
        out = out.replace(key, "[REDACTED]")
    return out


def error_from_response(status: int, raw: bytes, headers: Optional[dict] = None, cfg: Optional["GeminiConfig"] = None) -> GeminiError:
    """Build a classified error from an HTTP error response (Google error body: ``{"error": {"code", "message"}}``)."""
    code = message = None
    try:
        body = json.loads(raw.decode("utf-8", "replace")) if raw else {}
        err = body.get("error") if isinstance(body, dict) else None
        if isinstance(err, dict):
            if isinstance(err.get("code"), str):
                code = err["code"].lower()
            elif isinstance(err.get("status"), str):
                code = _CLASSIC_STATUS.get(err["status"].lower(), err["status"].lower())
            message = err.get("message")
    except (ValueError, AttributeError):
        pass
    if code not in _ERROR_TABLE and code not in BLOCKED_CODES:
        code = _HTTP_CODE.get(status, code or "unknown")
    retry_after = None
    for name, value in (headers or {}).items():
        if str(name).lower() == "retry-after":
            try:
                retry_after = float(value)
            except (TypeError, ValueError):
                retry_after = None
    text = redact(message or f"HTTP {status}", cfg)[:400].rstrip(".")
    if code in BLOCKED_CODES:
        return GeminiError("blocked", f"the request or result was blocked ({code}): {text}. Change the prompt or input and try again with fresh approval.",
                           g3d.EXIT_FAILED, code=code, http_status=status)
    kind, exit_code, retryable, reject, fallback = _ERROR_TABLE.get(code, ("unknown", g3d.EXIT_FAILED, False, False, False))
    extra = ""
    if kind == "no_access":
        extra = " Image and video models are paid-only per Google's pricing page: check the key, billing and project permissions. " + NORMAL_PROCEDURE
    elif kind == "model_not_found":
        extra = f" Check {ENV_IMAGE} / {ENV_VIDEO}; Google retires models (the Veo 3.1 previews were shut down on 2026-10-22). " + NORMAL_PROCEDURE
    return GeminiError(kind, f"{code}: {text}.{extra}", exit_code, retryable, reject, fallback, status, code, retry_after)


# --------------------------------------------------------------------------------------------
# Configuration
# --------------------------------------------------------------------------------------------
@dataclass
class GeminiConfig:
    api_key: Optional[str] = None
    image_model: Optional[str] = None
    video_model: Optional[str] = None
    max_jobs_override: Optional[int] = None
    timeout: float = 120.0
    problems: List[str] = field(default_factory=list)

    def has_access(self) -> bool:
        return bool(self.api_key)

    def max_jobs(self, kind: str) -> int:
        return self.max_jobs_override if self.max_jobs_override else DEFAULT_MAX_JOBS[kind]

    def model_for(self, kind: str, override: Optional[str] = None) -> str:
        model = override or (self.image_model if kind == "image" else self.video_model)
        var = ENV_IMAGE if kind == "image" else ENV_VIDEO
        if not model:
            raise GeminiError("not_configured", f"{var} is not set. Set it to a model id from Google's docs "
                              f"(suggested on 2026-10-29: {SUGGESTED_MODELS[kind]}) or pass --model.", g3d.EXIT_USAGE, fallback=True)
        if not MODEL_RE.match(model):
            raise GeminiError("invalid_input", f"{var} is not a valid model id", g3d.EXIT_USAGE)
        return model


def parse_env_file(path: Path) -> Dict[str, str]:
    """Minimal KEY=VALUE reader. Only the GEMINI_* names this tool uses are returned; other secrets are never read."""
    values: Dict[str, str] = {}
    for line in Path(path).read_text(encoding="utf-8-sig").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        name, _, value = line.partition("=")
        name = name.strip()
        if name.startswith("export "):
            name = name[len("export "):].strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in "\"'":
            value = value[1:-1]
        if name in ENV_ALLOWED:
            values[name] = value
    return values


def load_config(env: Optional[Dict[str, str]] = None, env_file: Optional[Path] = None) -> GeminiConfig:
    """Process environment wins over the env file. Never raises for a missing key: the stage is simply unavailable."""
    merged: Dict[str, str] = {}
    problems: List[str] = []
    if env_file:
        try:
            merged.update(parse_env_file(Path(env_file)))
        except OSError as exc:
            problems.append(f"cannot read env file: {exc.__class__.__name__}")
    source = os.environ if env is None else env
    merged.update({k: source[k] for k in ENV_ALLOWED if source.get(k)})
    cfg = GeminiConfig()
    key = (merged.get(ENV_KEY) or "").strip()
    if key:
        if re.search(r"\s", key) or len(key) < 20:
            problems.append(f"{ENV_KEY} looks malformed (contains whitespace or is too short); the value is not shown")
        else:
            cfg.api_key = key
    for var, attr in ((ENV_IMAGE, "image_model"), (ENV_VIDEO, "video_model")):
        value = (merged.get(var) or "").strip()
        if value and not MODEL_RE.match(value):
            problems.append(f"{var} is not a valid model id")
        elif value:
            setattr(cfg, attr, value)
    for var in (ENV_MAX_JOBS, ENV_TIMEOUT):
        raw = merged.get(var)
        if not raw:
            continue
        try:
            number = float(raw)
            if number <= 0:
                raise ValueError
            if var == ENV_MAX_JOBS:
                cfg.max_jobs_override = int(number)
            else:
                cfg.timeout = number
        except ValueError:
            problems.append(f"{var} must be a positive number")
    cfg.problems = problems
    return cfg


def resolve_capability(capability: str, cfg: GeminiConfig) -> Dict[str, Any]:
    """Capability router: which implementation serves a capability right now, or an explicit unsupported answer."""
    entry = CAPABILITIES.get(capability)
    if entry is None:
        return {"capability": capability, "supported": False, "reason": "unknown capability id"}
    out = {"capability": capability, **entry}
    if entry.get("provider") == "gemini":
        out["configured"] = cfg.has_access() and bool(cfg.image_model if capability.startswith("image") else cfg.video_model)
        if not out["configured"]:
            out["fallback"] = NORMAL_PROCEDURE
    return out


# --------------------------------------------------------------------------------------------
# HTTP
# --------------------------------------------------------------------------------------------
class _KeepKeyInsideGoogle(urllib.request.HTTPRedirectHandler):
    """Follow redirects (file downloads do), but never forward the API key to a host that is not Google's API host."""

    def redirect_request(self, req, fp, code, msg, headers, newurl):  # noqa: N802 (stdlib signature)
        new = super().redirect_request(req, fp, code, msg, headers, newurl)
        if new is not None and urllib.parse.urlparse(newurl).hostname != API_HOST:
            for name in list(new.headers):
                if name.lower() == KEY_HEADER:
                    del new.headers[name]
        return new


_default_opener = urllib.request.build_opener(_KeepKeyInsideGoogle).open
_sleep: Callable[[float], None] = time.sleep
_now: Callable[[], float] = time.monotonic


class GeminiHttp:
    def __init__(self, cfg: GeminiConfig, opener: Optional[Callable[..., Any]] = None,
                 log: Callable[[str], None] = g3d._default_log):
        if not cfg.api_key:
            raise GeminiError("no_access", f"{ENV_KEY} is not set. " + NORMAL_PROCEDURE, 77, fallback=True)
        self.cfg, self.open, self.log = cfg, opener or _default_opener, log

    def _send(self, method: str, url: str, body: Optional[dict], timeout: float) -> Tuple[int, dict, bytes]:
        data = json.dumps(body).encode("utf-8") if body is not None else None
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header(KEY_HEADER, self.cfg.api_key or "")
        req.add_header("User-Agent", f"arkononion-gemini-media/{TOOL_VERSION}")
        if data is not None:
            req.add_header("Content-Type", "application/json")
        try:
            with self.open(req, timeout=timeout) as resp:
                raw = resp.read(MAX_RESPONSE_BYTES + 1)
                if len(raw) > MAX_RESPONSE_BYTES:
                    raise GeminiError("invalid_response", "response is larger than the safety limit", g3d.EXIT_FAILED)
                return int(getattr(resp, "status", 200)), dict(getattr(resp, "headers", {}) or {}), raw
        except urllib.error.HTTPError as exc:
            raw = exc.read() if exc.fp is not None else b""
            raise error_from_response(exc.code, raw, dict(exc.headers or {}), self.cfg) from None
        except (socket.timeout, TimeoutError):
            raise GeminiError("timeout", "the request timed out; it may still have been processed. Do not resubmit without checking.",
                              75, retryable=True) from None
        except urllib.error.URLError as exc:
            never_sent = isinstance(exc.reason, (socket.gaierror, ConnectionRefusedError))
            raise GeminiError("network", redact(f"network error: {exc.reason}", self.cfg), 75, retryable=True, reject=never_sent) from None

    def request_json(self, method: str, path: str, body: Optional[dict] = None, *, timeout: Optional[float] = None,
                     retries: int = 0, post: bool = False) -> dict:
        """One logical request. ``retries`` re-sends only what is safe: GETs on transient errors; POSTs only when the
        server rejected the request before doing any work (429 rate limit, 503 overload, connection never made)."""
        url = path if path.startswith("https://") else API_BASE + path
        delay = 2.0
        for attempt in range(retries + 1):
            try:
                _status, _headers, raw = self._send(method, url, body, timeout or self.cfg.timeout)
                try:
                    data = json.loads(raw.decode("utf-8")) if raw else {}
                except ValueError as exc:
                    raise GeminiError("invalid_response", "the API returned something that is not JSON", g3d.EXIT_FAILED) from exc
                if not isinstance(data, dict):
                    raise GeminiError("invalid_response", "the API returned JSON that is not an object", g3d.EXIT_FAILED)
                return data
            except GeminiError as err:
                safe = err.reject if post else err.retryable
                if attempt >= retries or not safe:
                    raise
                wait = min(err.retry_after or delay * (1 + random.random() * 0.25), 60.0)
                self.log(f"[http] {err.kind} on attempt {attempt + 1}; retrying in {wait:.0f}s")
                _sleep(wait)
                delay *= 2
        raise GeminiError("unknown", "request failed")  # pragma: no cover

    def fetch_bytes(self, uri: str, retries: int = 3) -> bytes:
        """Download a ``files/...`` URI that an interaction returned (delivery=uri). Only Google's API host is accepted."""
        parsed = urllib.parse.urlparse(uri)
        match = re.fullmatch(r"/v1beta/files/([A-Za-z0-9_\-]+)(?::download)?", parsed.path)
        if parsed.scheme != "https" or parsed.hostname != API_HOST or not match:
            raise GeminiError("invalid_response", "the API returned a file URI outside Google's API host; refusing to fetch it", g3d.EXIT_FAILED)
        url = f"{API_BASE}/files/{match.group(1)}:download?alt=media"
        delay = 2.0
        for attempt in range(retries + 1):
            try:
                return self._send("GET", url, None, max(self.cfg.timeout, 300.0))[2]
            except GeminiError as err:
                if attempt >= retries or not err.retryable:
                    raise
                _sleep(min(err.retry_after or delay, 60.0))
                delay *= 2
        raise GeminiError("unknown", "download failed")  # pragma: no cover


# --------------------------------------------------------------------------------------------
# Request builders and response parsing
# --------------------------------------------------------------------------------------------
def _b64_file(path: Path) -> Tuple[str, str]:
    info = g3d.sniff_image(path)
    return IMAGE_MIME[info["format"]], base64.b64encode(Path(path).read_bytes()).decode("ascii")


def build_image_request(model: str, prompt: str, input_images: Sequence[Path] = (), aspect_ratio: Optional[str] = None,
                        image_size: Optional[str] = None, mime_type: str = "image/png", store: bool = False,
                        previous_interaction_id: Optional[str] = None) -> dict:
    if len(input_images) > MAX_REFERENCE_IMAGES:
        raise GeminiError("invalid_input", f"at most {MAX_REFERENCE_IMAGES} reference images per request", g3d.EXIT_USAGE)
    if aspect_ratio and not ASPECT_RE.match(aspect_ratio):
        raise GeminiError("invalid_input", "aspect ratio must look like 16:9", g3d.EXIT_USAGE)
    if image_size and image_size not in IMAGE_SIZES:
        raise GeminiError("invalid_input", f"image size must be one of {', '.join(IMAGE_SIZES)} (uppercase K)", g3d.EXIT_USAGE)
    if mime_type not in ("image/png", "image/jpeg"):
        raise GeminiError("invalid_input", "output mime type must be image/png or image/jpeg", g3d.EXIT_USAGE)
    blocks: List[dict] = [{"type": "text", "text": prompt}]
    for path in input_images:
        mime, data = _b64_file(Path(path))
        blocks.append({"type": "image", "mime_type": mime, "data": data})
    fmt: Dict[str, Any] = {"type": "image", "mime_type": mime_type}
    if aspect_ratio:
        fmt["aspect_ratio"] = aspect_ratio
    if image_size:
        fmt["image_size"] = image_size
    body: Dict[str, Any] = {"model": model, "input": blocks, "response_format": fmt, "store": bool(store)}
    if previous_interaction_id:
        body["previous_interaction_id"] = previous_interaction_id
    return body


def build_video_request(model: str, prompt: str, first_frame: Optional[Path] = None, aspect_ratio: Optional[str] = None,
                        resolution: Optional[str] = None, task: Optional[str] = None, delivery: str = "inline",
                        background: bool = True, previous_interaction_id: Optional[str] = None) -> dict:
    if aspect_ratio and aspect_ratio not in VIDEO_ASPECTS:
        raise GeminiError("invalid_input", f"video aspect ratio must be one of {', '.join(VIDEO_ASPECTS)}", g3d.EXIT_USAGE)
    if resolution and resolution not in VIDEO_RESOLUTIONS:
        raise GeminiError("invalid_input", f"resolution must be one of {', '.join(VIDEO_RESOLUTIONS)}", g3d.EXIT_USAGE)
    if task and task not in VIDEO_TASKS:
        raise GeminiError("invalid_input", f"task must be one of {', '.join(VIDEO_TASKS)}", g3d.EXIT_USAGE)
    if delivery not in ("inline", "uri"):
        raise GeminiError("invalid_input", "delivery must be inline or uri", g3d.EXIT_USAGE)
    if first_frame and previous_interaction_id:
        raise GeminiError("invalid_input", "--first-frame and --continue cannot be combined", g3d.EXIT_USAGE)
    blocks: List[dict] = [{"type": "text", "text": prompt}]
    if first_frame:
        mime, data = _b64_file(Path(first_frame))
        blocks.append({"type": "image", "mime_type": mime, "data": data})
        task = task or "image_to_video"
    if previous_interaction_id and task not in ("edit", "extend"):
        raise GeminiError("invalid_input", "--continue needs --task edit or --task extend", g3d.EXIT_USAGE)
    fmt: Dict[str, Any] = {"type": "video"}
    if aspect_ratio:
        fmt["aspect_ratio"] = aspect_ratio
    if resolution:
        fmt["resolution"] = resolution
    if delivery == "uri":
        fmt["delivery"] = "uri"
    body: Dict[str, Any] = {"model": model, "input": blocks, "response_format": fmt}
    if task:
        body["generation_config"] = {"video_config": {"task": task}}
    if background:
        body["background"] = True
        body["store"] = True  # background execution requires a stored interaction
    else:
        body.update({"background": False, "store": False, "stream": False})
    if previous_interaction_id:
        body["previous_interaction_id"] = previous_interaction_id
        body["store"] = True
    return body


def content_blocks(interaction: dict, kind: str) -> List[dict]:
    """Content blocks of ``kind`` from model_output steps (thought steps are interim and never the result)."""
    found: List[dict] = []
    for step in interaction.get("steps") or []:
        if not isinstance(step, dict) or step.get("type") != "model_output":
            continue
        for block in step.get("content") or []:
            if isinstance(block, dict) and block.get("type") == kind:
                found.append(block)
    return found


def usage_summary(interaction: dict) -> Dict[str, Any]:
    usage = interaction.get("usage")
    if not isinstance(usage, dict):
        return {"note": "the API returned no usage data; cost not known"}
    keep = ("total_tokens", "total_input_tokens", "total_output_tokens", "total_thought_tokens", "output_tokens_by_modality")
    return {k: usage[k] for k in keep if k in usage}


def failure_from_interaction(interaction: dict, cfg: Optional[GeminiConfig] = None) -> Optional[GeminiError]:
    status = interaction.get("status")
    errors = interaction.get("errors") or []
    first = errors[0] if errors and isinstance(errors[0], dict) else {}
    code = str(first.get("code") or "").lower()
    message = redact(first.get("message") or "", cfg)[:300]
    if status in ("failed", "cancelled", "incomplete", "requires_action", "requires_continuation") or (errors and status != "completed"):
        if code in BLOCKED_CODES:
            return GeminiError("blocked", f"the result was blocked ({code}): {message}. Change the prompt or input and try again with fresh approval.",
                               g3d.EXIT_FAILED, code=code)
        if code == "no_image":
            return GeminiError("no_image", "the model returned no image for this prompt; rephrase it and try again with fresh approval", g3d.EXIT_FAILED, code=code)
        detail = f" ({code}: {message})" if code or message else ""
        if status == "requires_continuation":
            return GeminiError("unsupported", "the interaction needs a continuation token, which this tool does not implement" + detail, 69)
        return GeminiError("job_" + str(status), f"the interaction ended with status '{status}'{detail}", g3d.EXIT_FAILED)
    return None


def decode_block(http: Optional[GeminiHttp], block: dict) -> bytes:
    if isinstance(block.get("data"), str) and block["data"]:
        try:
            return base64.b64decode(block["data"], validate=True)
        except (binascii.Error, ValueError) as exc:
            raise GeminiError("invalid_response", "the media block is not valid base64", g3d.EXIT_FAILED) from exc
    if isinstance(block.get("uri"), str) and block["uri"] and http is not None:
        return http.fetch_bytes(block["uri"])
    raise GeminiError("invalid_response", "the media block has neither data nor uri", g3d.EXIT_FAILED)


def sniff_video(path: Path) -> Dict[str, Any]:
    with open(path, "rb") as fh:
        head = fh.read(16)
    if len(head) >= 12 and head[4:8] == b"ftyp":
        return {"format": "mp4"}
    if head[:4] == b"\x1a\x45\xdf\xa3":
        return {"format": "webm"}
    raise GeminiError("invalid_response", "the downloaded file is not an MP4 or WebM video", g3d.EXIT_FAILED)


def clean_plate_prompt(subject: str, view: str = "three-quarter", extra: str = "") -> str:
    """Brief for a reference still that image-to-3D can read well (one object, plain background, even light)."""
    base = (f"Studio product photograph of {subject.strip()}. Single object, {view} view, centered and filling about 70% of the frame, "
            "on a plain seamless light-grey background, soft even lighting from a large softbox, no hard shadows, "
            "sharp focus across the whole object, the full object visible with nothing cropped, thin parts and edges clearly visible, "
            "consistent proportions, no text, no logos, no watermark, no props, no people.")
    return base + (" " + extra.strip() if extra.strip() else "")


# --------------------------------------------------------------------------------------------
# Jobs store (duplicate protection, resume, provenance)
# --------------------------------------------------------------------------------------------
class JobStore:
    _lock = threading.Lock()

    def __init__(self, root: Path):
        self.root = Path(root)
        self.dir = self.root / "_sources" / "gemini"
        self.path = self.dir / "jobs.json"

    def load(self) -> Dict[str, dict]:
        if not self.path.exists():
            return {}
        try:
            data = json.loads(self.path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            raise GeminiError("invalid_input", f"{self.path.name} is not valid JSON; fix or move it (it holds the job ids that prevent double billing)", g3d.EXIT_USAGE)
        return data if isinstance(data, dict) else {}

    def put(self, record: dict) -> None:
        with JobStore._lock:
            data = self.load()
            data[record["job_id"]] = record
            g3d.write_json(self.path, data)

    def get(self, job_id: str) -> Optional[dict]:
        data = self.load()
        if job_id in data:
            return data[job_id]
        matches = [r for k, r in data.items() if k.startswith(job_id)]
        return matches[0] if len(matches) == 1 else None

    def find_by_sha(self, sha256: str) -> Optional[dict]:
        for rec in self.load().values():
            if (rec.get("output") or {}).get("sha256") == sha256:
                return rec
        return None

    def candidate_base(self, kind: str, asset_id: str, variant: int) -> Path:
        name = f"{asset_id}-c{variant}" if kind == "image" else asset_id
        return self.dir / "candidates" / name


def job_key(kind: str, model: str, prompt: str, params: dict, input_hashes: Sequence[str], variant: int) -> str:
    canonical = json.dumps({"k": kind, "m": model, "p": prompt, "x": params, "i": list(input_hashes), "v": variant}, sort_keys=True)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()[:16]


def _atomic_write(path: Path, data: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.parent / (path.name + ".tmp")
    tmp.write_bytes(data)
    os.replace(tmp, path)


def _sha(path: Path) -> str:
    return g3d.sha256_file(path)


def _today() -> str:
    return time.strftime("%Y-%m-%d", time.gmtime())


# --------------------------------------------------------------------------------------------
# Running jobs
# --------------------------------------------------------------------------------------------
def poll_until_done(http: GeminiHttp, interaction_id: str, timeout: float, interval: float = 10.0,
                    log: Callable[[str], None] = g3d._default_log) -> dict:
    if not INTERACTION_ID_RE.match(interaction_id or "") or ".." in interaction_id:
        raise GeminiError("invalid_response", "the API returned an interaction id in an unexpected format", g3d.EXIT_FAILED)
    deadline = _now() + timeout
    delay = interval
    while True:
        data = http.request_json("GET", f"/interactions/{interaction_id}", retries=5)
        status = data.get("status")
        if status == "completed":
            return data
        if status != "in_progress":
            raise failure_from_interaction(data, http.cfg) or GeminiError("job_" + str(status), f"unexpected status '{status}'")
        if _now() > deadline:
            raise GeminiError("still_running", f"job still running after {timeout:.0f}s. It was NOT cancelled and may still be billed: "
                              "resume with `status --job <id>` or stop it with `cancel --job <id>`.", EXIT_INCOMPLETE, retryable=True)
        log(f"[poll] in_progress; next check in {delay:.0f}s")
        _sleep(delay)
        delay = min(delay * 1.5, 30.0)


def _record(job_id: str, kind: str, model: str, prompt: str, params: dict, status: str, **extra: Any) -> dict:
    created = extra.pop("created", None) or _today()
    return {"job_id": job_id, "kind": kind, "model": model, "prompt": prompt, "params": params, "status": status,
            "created": created, "updated": _today(), **extra}


def _save_result(http: GeminiHttp, interaction: dict, kind: str, base: Path) -> Dict[str, Any]:
    blocks = content_blocks(interaction, "image" if kind == "image" else "video")
    if not blocks:
        err = failure_from_interaction(interaction, http.cfg)
        types = sorted({str(s.get("type", "?")) for s in interaction.get("steps") or [] if isinstance(s, dict)})
        raise err or GeminiError("no_media", f"the interaction completed but contained no {kind} (step types: {', '.join(types) or 'none'})", g3d.EXIT_FAILED)
    data = decode_block(http, blocks[-1])  # the last block is the final result; earlier ones can be interim drafts
    part = base.parent / (base.name + ".part")
    _atomic_write(part, data)
    try:
        if kind == "image":
            info = g3d.sniff_image(part)
            final = base.parent / (base.name + IMAGE_EXT[info["format"]])
            os.replace(part, final)
            return {"path": final, "mime": IMAGE_MIME[info["format"]], "bytes": final.stat().st_size, "sha256": _sha(final),
                    "dimensions": {"width": info["width"], "height": info["height"]}, "format": info["format"]}
        info = sniff_video(part)
        final = base.parent / (base.name + (".webm" if info["format"] == "webm" else ".mp4"))
        os.replace(part, final)
        return {"path": final, "mime": f"video/{info['format']}", "bytes": final.stat().st_size, "sha256": _sha(final), "format": info["format"]}
    except g3d.Gen3DError as exc:
        part.unlink(missing_ok=True)
        if isinstance(exc, GeminiError):
            raise
        raise GeminiError("invalid_response", f"the returned file is not usable: {exc.message}", g3d.EXIT_FAILED) from exc


def _file_rel(root: Path, path: Path) -> str:
    return path.relative_to(root).as_posix()


@dataclass
class JobPlan:
    kind: str
    asset_id: str
    variant: int
    job_id: str
    model: str
    prompt: str
    body: dict
    params: dict
    uploads: List[str]
    input_hashes: List[str]
    reuse: Optional[dict] = None
    resume: Optional[dict] = None


def make_plan(kind: str, store: JobStore, asset_id: str, prompt: str, count: int, model: str,
              body_for: Callable[[int], dict], params: dict, uploads: Sequence[Path], force_new: bool = False) -> List[JobPlan]:
    hashes = [_sha(Path(p)) for p in uploads]
    records = store.load()
    plans: List[JobPlan] = []
    for variant in range(1, count + 1):
        jid = job_key(kind, model, prompt, params, hashes, variant)
        plan = JobPlan(kind, asset_id, variant, jid, model, prompt, body_for(variant), params, [Path(p).name for p in uploads], hashes)
        rec = records.get(jid)
        if rec and not force_new:
            out = (rec.get("output") or {}).get("file")
            if rec.get("status") == "completed" and out and (store.root / out).exists():
                plan.reuse = rec
            elif rec.get("status") == "in_progress" and rec.get("interaction_id"):
                plan.resume = rec
        plans.append(plan)
    return plans


def plan_summary(plans: Sequence[JobPlan], cfg: GeminiConfig, cap: int) -> Dict[str, Any]:
    p0 = plans[0]
    new = [p for p in plans if not p.reuse and not p.resume]
    stored = bool(p0.body.get("store"))
    return {
        "tool": TOOL, "tool_version": TOOL_VERSION, "provider": "gemini", "endpoint": "POST /v1beta/interactions",
        "kind": p0.kind, "model": p0.model, "provider_calls": 0, "jobs": len(plans), "new_paid_jobs": len(new),
        "reused": [p.job_id for p in plans if p.reuse], "resumed": [p.job_id for p in plans if p.resume],
        "job_ids": [p.job_id for p in plans], "uploads": sorted({u for p in plans for u in p.uploads}),
        "request_format": p0.body.get("response_format"), "mode": "background" if p0.body.get("background") else "synchronous",
        "stored_by_google": stored,
        "retention_note": ("stored interactions are kept 1 day on the free tier and 55 days on the paid tier (Google docs, 2026-10-29)"
                           if stored else "store=false: not kept for later retrieval"),
        "watermark": "all generated media carries a SynthID watermark (Google docs)",
        "cost": "billed per token on the paid tier; this tool does not quote prices (see Google's pricing page)",
        "max_jobs_allowed": cap, "prompt_sha256": hashlib.sha256(p0.prompt.encode("utf-8")).hexdigest(),
    }


def require_approval(provider: Optional[str], approved_by: Optional[str], approved_uploads: Optional[str],
                     uploads: Sequence[str], new_jobs: int, cap: int) -> None:
    if (provider or "").strip().lower() != "gemini":
        raise GeminiError("approval_required", "This sends the prompt to Google and bills the user's Gemini account. Get the user's explicit yes "
                          "(count and kind of jobs), then pass --approve-provider gemini --approved-by \"<who, when, quote>\".", g3d.EXIT_APPROVAL)
    if not (approved_by or "").strip():
        raise GeminiError("approval_required", "--approved-by is required: record who approved, when, and the quote", g3d.EXIT_APPROVAL)
    if uploads:
        wanted = sorted(uploads)
        got = sorted(x.strip() for x in (approved_uploads or "").split(",") if x.strip())
        if got != wanted:
            raise GeminiError("approval_required", f"These local images would be uploaded to Google: {', '.join(wanted)}. After the user approves "
                              f"exactly these files pass --approved-uploads \"{','.join(wanted)}\".", g3d.EXIT_APPROVAL)
    if new_jobs > cap:
        raise GeminiError("budget", f"{new_jobs} paid jobs exceed the per-run cap of {cap}. Ask the user to approve the higher count, "
                          f"then pass --max-jobs {new_jobs} (or set {ENV_MAX_JOBS}).", g3d.EXIT_APPROVAL)


def execute_plans(http: GeminiHttp, plans: Sequence[JobPlan], store: JobStore, root: Path, *, approved_by: str,
                  retries: int = 0, concurrency: int = 1, timeout: float = 900.0, interval: float = 10.0,
                  token_budget: Optional[int] = None, log: Callable[[str], None] = g3d._default_log) -> List[Dict[str, Any]]:
    """Run each planned job once. Reused jobs cost nothing; running jobs are resumed, never recreated."""
    results: List[Dict[str, Any]] = []
    spent = {"tokens": 0}

    def one(plan: JobPlan) -> Dict[str, Any]:
        base = {"job_id": plan.job_id, "kind": plan.kind, "variant": plan.variant, "model": plan.model}
        if plan.reuse:
            log(f"[{plan.job_id}] reusing the completed result (no new call)")
            return {**base, "status": "reused", "reused": True, **plan.reuse["output"]}
        if token_budget is not None and spent["tokens"] >= token_budget:
            return {**base, "status": "skipped", "reason": f"token budget {token_budget} reached"}
        created = (plan.resume or {}).get("created")
        meta = {"asset_id": plan.asset_id, "variant": plan.variant, "approved_by": approved_by, "inputs": plan.uploads}

        def poll(iid: str) -> dict:
            """Poll a job; a terminal failure is recorded so a rerun never resumes a dead job. Transient ones stay resumable."""
            try:
                return poll_until_done(http, iid, timeout, interval, log)
            except GeminiError as err:
                if err.kind != "still_running" and not err.retryable:
                    store.put(_record(plan.job_id, plan.kind, plan.model, plan.prompt, plan.params, "failed", interaction_id=iid,
                                      created=created, error={"kind": err.kind, "message": err.message[:300]}, **meta))
                raise

        if plan.resume:
            interaction_id = plan.resume["interaction_id"]
            log(f"[{plan.job_id}] resuming job {interaction_id} (no new paid call)")
            interaction = poll(interaction_id)
        else:
            log(f"[{plan.job_id}] creating {plan.kind} job with {plan.model}")
            request_timeout = max(http.cfg.timeout, timeout) if plan.kind == "video" and not plan.body.get("background") else http.cfg.timeout
            data = http.request_json("POST", "/interactions", plan.body, timeout=request_timeout, retries=retries, post=True)
            interaction_id = data.get("id")
            status = data.get("status")
            if status == "completed" or (status is None and data.get("steps")):
                interaction = data
            elif status == "in_progress":
                if not interaction_id:
                    raise GeminiError("invalid_response", "the API started a job but returned no interaction id", g3d.EXIT_FAILED)
                store.put(_record(plan.job_id, plan.kind, plan.model, plan.prompt, plan.params, "in_progress",
                                  interaction_id=interaction_id, created=created, **meta))
                interaction = poll(interaction_id)
            else:
                raise failure_from_interaction(data, http.cfg) or GeminiError("job_" + str(status), f"unexpected status '{status}'")
        saved = _save_result(http, interaction, plan.kind, store.candidate_base(plan.kind, plan.asset_id, plan.variant))
        usage = usage_summary(interaction)
        total = usage.get("total_tokens")
        spent["tokens"] += int(total) if isinstance(total, (int, float)) else 0
        out = {"file": _file_rel(root, saved["path"]), "bytes": saved["bytes"], "sha256": saved["sha256"], "mime": saved["mime"],
               "format": saved["format"], **({"dimensions": saved["dimensions"]} if "dimensions" in saved else {})}
        store.put(_record(plan.job_id, plan.kind, plan.model, plan.prompt, plan.params, "completed",
                          interaction_id=interaction_id or interaction.get("id"), created=created, output=out, usage=usage, **meta))
        return {**base, "status": "completed", "interaction_id": interaction_id or interaction.get("id"), **out, "usage": usage}

    def failure(plan: JobPlan, err: g3d.Gen3DError) -> Dict[str, Any]:
        return {"job_id": plan.job_id, "kind": plan.kind, "variant": plan.variant, "status": "failed", "exit_code": err.exit_code,
                "error": {"kind": err.kind, "message": err.message, "fallback": getattr(err, "fallback", False)}}

    stop_kinds = ("no_access", "model_not_found", "quota", "rate_limited", "still_running")
    if concurrency > 1 and len(plans) > 1:
        with concurrent.futures.ThreadPoolExecutor(max_workers=min(concurrency, 4)) as pool:
            futures = [pool.submit(one, p) for p in plans]
            for fut, plan in zip(futures, plans):
                try:
                    results.append(fut.result())
                except g3d.Gen3DError as err:
                    results.append(failure(plan, err))
    else:
        for plan in plans:
            try:
                results.append(one(plan))
            except g3d.Gen3DError as err:
                results.append(failure(plan, err))
                if err.kind in stop_kinds:
                    break  # the same failure would repeat for every remaining paid job
    return results


# --------------------------------------------------------------------------------------------
# Promotion: candidate -> shippable asset + manifest entry
# --------------------------------------------------------------------------------------------
def build_entry(rec: dict, *, asset_id: str, rel_path: str, role: str, alt: Optional[str], critical: bool, loading: str,
                fallback: Optional[Any], size: int, fmt: str, dimensions: Optional[dict], prompt_ref: str, note: str) -> Dict[str, Any]:
    kind = rec["kind"]
    entry: Dict[str, Any] = {
        "id": asset_id, "type": "image" if kind == "image" else "video", "role": role, "path": rel_path, "source": "generated",
        "generator": {"tool": f"{TOOL} (Gemini Interactions API)", "model": rec["model"], "prompt": rec["prompt"],
                      "params": {**dict(rec.get("params") or {}), "interaction": rec.get("interaction_id") or "n/a"},
                      "costApprovedBy": f"billed per token to the user's Gemini account; approved: {rec.get('approved_by', 'n/a')}"},
        "promptRef": prompt_ref, "bytes": size, "format": fmt,
        "license": "generated with the Gemini API; Google's terms apply and the site owner must confirm commercial use; SynthID watermark embedded",
        "usageRestrictions": "AI-generated: disclose per project policy; do not present as a photograph of a real product, place or person.",
        "critical": critical, "loading": loading, "optimization": "pending",
        "validation": {"status": "pending", "checkedOn": None, "notes": note},
    }
    if dimensions:
        entry["dimensions"] = dimensions
        entry["aspectRatio"] = f"{dimensions['width']}:{dimensions['height']}"
    if fallback:
        entry["fallback"] = fallback
    if alt is not None:
        entry["alt"] = alt
    return entry


def promote(root: Path, candidate: Path, asset_id: str, *, role: str, alt: Optional[str], out_dir: str, manifest: Optional[str],
            critical: bool = False, loading: str = "lazy", fallback_asset: Optional[str] = None, fallback_text: Optional[str] = None,
            overwrite: bool = False, reference_for: Optional[str] = None) -> Dict[str, Any]:
    root = Path(root).resolve()
    store = JobStore(root)
    candidate = Path(candidate)
    if not ID_RE.match(asset_id):
        raise GeminiError("invalid_input", "--id must match [A-Za-z0-9][A-Za-z0-9._-]*", g3d.EXIT_USAGE)
    if not candidate.is_file():
        raise GeminiError("invalid_input", f"candidate not found: {candidate.name}", g3d.EXIT_USAGE)
    rec = store.find_by_sha(_sha(candidate))
    if not rec or rec.get("status") != "completed":
        raise GeminiError("invalid_input", "this file is not a completed Gemini result in the job store; only files this tool generated can be promoted "
                          "(provenance would be missing)", g3d.EXIT_USAGE)
    if rec["kind"] == "image" and alt is None:
        raise GeminiError("invalid_input", "--alt is required for an image (use --alt \"\" for a decorative one)", g3d.EXIT_USAGE)
    if critical and not (fallback_asset or fallback_text):
        raise GeminiError("invalid_input", "a critical asset needs --fallback-asset or --fallback", g3d.EXIT_USAGE)
    from image_to_glb import merge_receipts, resolve_inside, upsert_manifest  # local import: image_to_glb imports this module lazily too
    dest_dir = resolve_inside(root, out_dir, "--out-dir")
    final = dest_dir / f"{asset_id}{candidate.suffix}"
    if final.exists() and not overwrite:
        raise GeminiError("overwrite_required", f"{final.name} already exists; choose another --id or get approval and pass --overwrite", g3d.EXIT_APPROVAL)
    dest_dir.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(candidate, final)
    prompt_file = root / "prompts" / f"{asset_id}.txt"
    prompt_file.parent.mkdir(parents=True, exist_ok=True)
    prompt_file.write_text(rec["prompt"] + "\n", encoding="utf-8")
    out = rec.get("output") or {}
    fallback: Optional[Any] = ({"type": "asset", "assetId": fallback_asset, "note": "poster still used when the video is disabled or fails"}
                               if fallback_asset else fallback_text)
    note = "generated with Gemini; inspect the file, optimise it, then run scripts/asset-validation.mjs"
    if reference_for:
        note += f" | reference still for 3D asset '{reference_for}'"
    entry = build_entry(rec, asset_id=asset_id, rel_path=final.relative_to(root).as_posix(), role=role, alt=alt, critical=critical, loading=loading,
                        fallback=fallback, size=final.stat().st_size, fmt=out.get("format", candidate.suffix.lstrip(".")),
                        dimensions=out.get("dimensions"), prompt_ref=prompt_file.relative_to(root).as_posix(), note=note)
    state = "skipped (--no-manifest)"
    if manifest:
        mpath = resolve_inside(root, manifest, "--manifest")
        state = f"{upsert_manifest(mpath, root.name, entry)} {mpath.relative_to(root).as_posix()}"
    merge_receipts(store.dir / "receipts.json", asset_id, {
        "job_id": rec["job_id"], "interaction_id": rec.get("interaction_id"), "model": rec["model"], "usage": rec.get("usage"),
        "approved_by": rec.get("approved_by"), "final": {"file": final.name, "bytes": final.stat().st_size, "sha256": _sha(final)},
        "recorded_on": _today()})
    return {"ok": True, "asset": entry["path"], "manifest": state, "entry": entry}


# --------------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------------
def _read_prompt(args: argparse.Namespace) -> str:
    if getattr(args, "subject", None) and getattr(args, "clean_plate", False):
        return clean_plate_prompt(args.subject, args.view, args.prompt or "")
    if args.prompt_file:
        return Path(args.prompt_file).read_text(encoding="utf-8").strip()
    if args.prompt:
        return args.prompt.strip()
    raise GeminiError("invalid_input", "give --prompt, --prompt-file, or --subject with --clean-plate", g3d.EXIT_USAGE)


def _guard_prompt(prompt: str, cfg: GeminiConfig) -> None:
    if len(prompt) < 3 or len(prompt) > 12000:
        raise GeminiError("invalid_input", "the prompt must be 3 to 12000 characters", g3d.EXIT_USAGE)
    if g3d.TOKEN_RE.search(prompt) or GOOGLE_KEY_RE.search(prompt) or (cfg.api_key and cfg.api_key in prompt):
        raise GeminiError("invalid_input", "the prompt contains something that looks like a credential; remove it", g3d.EXIT_USAGE)


def _out(args: argparse.Namespace, payload: Dict[str, Any], text: str) -> None:
    print(json.dumps(payload, indent=2) if getattr(args, "json", False) else text)


def _fail(args: argparse.Namespace, err: g3d.Gen3DError) -> int:
    payload: Dict[str, Any] = {"ok": False, "error": {"kind": err.kind, "message": err.message}}
    if getattr(err, "fallback", False):
        payload["normal_procedure"] = NORMAL_PROCEDURE
    if getattr(args, "json", False):
        print(json.dumps(payload, indent=2))
    print(f"error[{err.kind}]: {err.message}", file=sys.stderr)
    return err.exit_code


def cmd_capabilities(args: argparse.Namespace, cfg: GeminiConfig, opener: Optional[Callable[..., Any]] = None) -> int:
    table = [resolve_capability(c, cfg) for c in CAPABILITIES]
    lines = [f"{t['capability']:18} {'supported' if t['supported'] else 'UNSUPPORTED':12} {t.get('note') or t.get('reason') or t.get('command', '')}" for t in table]
    _out(args, {"gemini_configured": cfg.has_access(), "capabilities": table}, "\n".join(lines))
    return 0


def cmd_doctor(args: argparse.Namespace, cfg: GeminiConfig, opener: Optional[Callable[..., Any]] = None) -> int:
    report: Dict[str, Any] = {
        "gemini_available": cfg.has_access() and bool(cfg.image_model or cfg.video_model),
        "api_key": "set" if cfg.has_access() else "not set",
        "image_model": cfg.image_model or f"not set (suggested on 2026-10-29: {SUGGESTED_MODELS['image']})",
        "video_model": cfg.video_model or f"not set (suggested on 2026-10-29: {SUGGESTED_MODELS['video']})",
        "problems": cfg.problems, "key_check": "not run (add --online for one free read-only request)",
        "access_note": "Google lists the image and video models as paid-only (no free tier): the key's project needs billing enabled.",
    }
    if args.online and cfg.has_access():
        try:
            GeminiHttp(cfg, opener).request_json("GET", "/models?pageSize=1", timeout=30, retries=1)
            report["key_check"] = "accepted by the API (read-only models request)"
        except GeminiError as err:
            report["key_check"] = f"rejected or unreachable: {err.kind}"
            report["gemini_available"] = False
    if not report["gemini_available"]:
        report["normal_procedure"] = NORMAL_PROCEDURE
    _out(args, report, "\n".join(f"{k}: {v}" for k, v in report.items() if v not in (None, [])))
    return 0


def _common_run(args: argparse.Namespace, cfg: GeminiConfig, opener: Optional[Callable[..., Any]], kind: str,
                plans: List[JobPlan], root: Path, store: JobStore) -> int:
    cap = args.max_jobs or cfg.max_jobs(kind)
    summary = plan_summary(plans, cfg, cap)
    if args.dry_run:
        g3d.write_json(store.dir / f"{plans[0].asset_id}.{kind}-dry-run.json", summary)
        _out(args, {"ok": True, "dry_run": True, **summary},
             f"DRY RUN (0 provider calls): {summary['new_paid_jobs']} new {kind} job(s) with {summary['model']}; "
             f"uploads: {', '.join(summary['uploads']) or 'none'}; mode: {summary['mode']}")
        return 0
    new = [p for p in plans if not p.reuse and not p.resume]
    if new:
        require_approval(args.approve_provider, args.approved_by, args.approved_uploads, summary["uploads"], len(new), cap)
    http = GeminiHttp(cfg, opener)
    results = execute_plans(http, plans, store, root, approved_by=(args.approved_by or "n/a").strip(), retries=args.retries,
                            concurrency=args.concurrency, timeout=args.timeout, interval=args.poll_interval, token_budget=args.token_budget)
    failed = [r for r in results if r["status"] == "failed"]
    ok = [r for r in results if r["status"] in ("completed", "reused")]
    promoted = None
    if getattr(args, "promote", False) and len(ok) == 1 and not failed:
        promoted = promote(root, root / ok[0]["file"], args.id, role=args.role, alt=args.alt, out_dir=args.out_dir,
                           manifest=None if args.no_manifest else args.manifest, critical=args.critical, loading=args.loading,
                           fallback_asset=getattr(args, "fallback_asset", None), fallback_text=args.fallback, overwrite=args.overwrite)
    payload: Dict[str, Any] = {"ok": not failed, "results": results, "promoted": promoted and promoted["asset"],
                               "manifest": promoted and promoted["manifest"],
                               "next": "inspect each candidate visually (open the image), pick one, then: gemini_media.py promote --candidate <file> --id <id> --role <role> --alt <text>"}
    if any(r.get("error", {}).get("fallback") for r in failed):
        payload["normal_procedure"] = NORMAL_PROCEDURE
    lines = [f"{r['status'].upper():9} {r.get('file') or r.get('reason') or r.get('error', {}).get('message', '')} (job {r['job_id']})" for r in results]
    _out(args, payload, "\n".join(lines))
    return failed[0].get("exit_code", g3d.EXIT_FAILED) if failed else 0


def cmd_image(args: argparse.Namespace, cfg: GeminiConfig, opener: Optional[Callable[..., Any]] = None) -> int:
    root = Path(args.root).resolve()
    prompt = _read_prompt(args)
    _guard_prompt(prompt, cfg)
    if not ID_RE.match(args.id):
        raise GeminiError("invalid_input", "--id must match [A-Za-z0-9][A-Za-z0-9._-]*", g3d.EXIT_USAGE)
    if args.count < 1 or args.count > 8:
        raise GeminiError("invalid_input", "--count must be 1 to 8", g3d.EXIT_USAGE)
    if args.promote and args.count != 1:
        raise GeminiError("invalid_input", "--promote works with --count 1 only; with several candidates, inspect them and run promote", g3d.EXIT_USAGE)
    if args.promote and args.alt is None:
        raise GeminiError("invalid_input", "--promote needs --alt (use \"\" for a decorative image)", g3d.EXIT_USAGE)
    model = cfg.model_for("image", args.model)
    inputs = [Path(p) for p in args.input_image or []]
    for p in inputs:
        g3d.sniff_image(p)
    store = JobStore(root)
    params = {"aspect_ratio": args.aspect_ratio, "image_size": args.image_size, "mime_type": args.mime_type}
    plans = make_plan("image", store, args.id, prompt, args.count, model,
                      lambda v: build_image_request(model, prompt, inputs, args.aspect_ratio, args.image_size, args.mime_type),
                      params, inputs, force_new=args.force_new)
    return _common_run(args, cfg, opener, "image", plans, root, store)


def cmd_video(args: argparse.Namespace, cfg: GeminiConfig, opener: Optional[Callable[..., Any]] = None) -> int:
    root = Path(args.root).resolve()
    prompt = _read_prompt(args)
    _guard_prompt(prompt, cfg)
    if not ID_RE.match(args.id):
        raise GeminiError("invalid_input", "--id must match [A-Za-z0-9][A-Za-z0-9._-]*", g3d.EXIT_USAGE)
    model = cfg.model_for("video", args.model)
    store = JobStore(root)
    previous = None
    if args.continue_job:
        base = store.get(args.continue_job)
        if not base or base.get("kind") != "video" or base.get("status") != "completed" or not base.get("interaction_id"):
            raise GeminiError("invalid_input", "--continue needs the id of a completed video job from this project's job store", g3d.EXIT_USAGE)
        previous = base["interaction_id"]
    frame = Path(args.first_frame) if args.first_frame else None
    if frame:
        g3d.sniff_image(frame)
    params = {"aspect_ratio": args.aspect_ratio, "resolution": args.resolution, "task": args.task, "delivery": args.delivery,
              "mode": "synchronous" if args.sync else "background", "continues": previous}
    plans = make_plan("video", store, args.id, prompt, 1, model,
                      lambda v: build_video_request(model, prompt, frame, args.aspect_ratio, args.resolution, args.task, args.delivery,
                                                    not args.sync, previous),
                      params, [frame] if frame else [], force_new=args.force_new)
    return _common_run(args, cfg, opener, "video", plans, root, store)


def cmd_promote(args: argparse.Namespace, cfg: GeminiConfig, opener: Optional[Callable[..., Any]] = None) -> int:
    result = promote(Path(args.root), Path(args.candidate), args.id, role=args.role, alt=args.alt, out_dir=args.out_dir,
                     manifest=None if args.no_manifest else args.manifest, critical=args.critical, loading=args.loading,
                     fallback_asset=args.fallback_asset, fallback_text=args.fallback, overwrite=args.overwrite, reference_for=args.reference_for)
    _out(args, result, f"OK {result['asset']}\n  manifest: {result['manifest']}\n"
                       f"  next: node <skill-dir>/scripts/asset-validation.mjs --manifest {args.manifest} --root {args.root}")
    return 0


def cmd_status(args: argparse.Namespace, cfg: GeminiConfig, opener: Optional[Callable[..., Any]] = None) -> int:
    root = Path(args.root).resolve()
    store = JobStore(root)
    rec = store.get(args.job)
    if not rec:
        raise GeminiError("invalid_input", f"no job {args.job!r} in the job store", g3d.EXIT_USAGE)
    if rec["status"] != "in_progress":
        _out(args, {"ok": True, "job": rec}, f"{rec['job_id']}: {rec['status']} {((rec.get('output') or {}).get('file') or '')}")
        return 0
    http = GeminiHttp(cfg, opener)
    interaction = poll_until_done(http, rec["interaction_id"], args.timeout, args.poll_interval)
    saved = _save_result(http, interaction, rec["kind"], store.candidate_base(rec["kind"], rec.get("asset_id") or rec["job_id"], rec.get("variant", 1)))
    out = {"file": _file_rel(root, saved["path"]), "bytes": saved["bytes"], "sha256": saved["sha256"], "mime": saved["mime"], "format": saved["format"]}
    if "dimensions" in saved:
        out["dimensions"] = saved["dimensions"]
    store.put({**rec, "status": "completed", "updated": _today(), "output": out, "usage": usage_summary(interaction)})
    _out(args, {"ok": True, "job": rec["job_id"], **out}, f"completed: {out['file']}")
    return 0


def cmd_cancel(args: argparse.Namespace, cfg: GeminiConfig, opener: Optional[Callable[..., Any]] = None) -> int:
    root = Path(args.root).resolve()
    store = JobStore(root)
    rec = store.get(args.job)
    if not rec or rec["status"] != "in_progress":
        raise GeminiError("invalid_input", "no running job with that id in the job store", g3d.EXIT_USAGE)
    if not INTERACTION_ID_RE.match(rec["interaction_id"]) or ".." in rec["interaction_id"]:
        raise GeminiError("invalid_input", "the stored interaction id is malformed", g3d.EXIT_USAGE)
    data = GeminiHttp(cfg, opener).request_json("POST", f"/interactions/{rec['interaction_id']}/cancel", {}, post=True)
    store.put({**rec, "status": "cancelled", "updated": _today()})
    _out(args, {"ok": True, "job": rec["job_id"], "status": data.get("status", "cancelled")}, f"cancel requested: {data.get('status', 'cancelled')}")
    return 0


def _add_run_options(p: argparse.ArgumentParser, default_out: str) -> None:
    p.add_argument("--id", required=True, help="asset id (also the file name)")
    p.add_argument("--prompt")
    p.add_argument("--prompt-file")
    p.add_argument("--model", help="override the configured model id")
    p.add_argument("--root", default=".", help="project root")
    p.add_argument("--env-file", help="read GEMINI_* settings from this file (the process environment wins)")
    p.add_argument("--out-dir", default=default_out, help="where promoted assets go (under --root)")
    p.add_argument("--manifest", default="asset-manifest.json")
    p.add_argument("--no-manifest", action="store_true")
    p.add_argument("--role", default="background")
    p.add_argument("--alt")
    p.add_argument("--loading", choices=("eager", "lazy", "on-interaction", "preload"), default="lazy")
    p.add_argument("--critical", action="store_true")
    p.add_argument("--fallback", help="what renders without the asset (text)")
    p.add_argument("--overwrite", action="store_true")
    p.add_argument("--dry-run", action="store_true", help="plan only: zero provider calls, no network")
    p.add_argument("--approve-provider", metavar="gemini", help="the provider the user approved (must be 'gemini')")
    p.add_argument("--approved-by", metavar="TEXT", help="who approved, when, and the quote (count and kind of jobs)")
    p.add_argument("--approved-uploads", metavar="FILES", help="comma-separated local image names the user approved sending to Google")
    p.add_argument("--max-jobs", type=int, help="raise the per-run paid-job cap (needs the user's approval of the higher count)")
    p.add_argument("--token-budget", type=int, help="stop starting new jobs once this many total tokens have been used")
    p.add_argument("--retries", type=int, default=0, help="re-send only if Google rejected the request before doing work (429/503); default 0")
    p.add_argument("--concurrency", type=int, default=1)
    p.add_argument("--force-new", action="store_true", help="create a new job even if an identical one exists (needs fresh approval)")
    p.add_argument("--timeout", type=float, default=900.0, help="seconds to wait for a background job (default 900)")
    p.add_argument("--poll-interval", type=float, default=10.0)
    p.add_argument("--json", action="store_true")


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog=TOOL, description=__doc__.split("\n\n")[0], formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)

    c = sub.add_parser("capabilities", help="what is supported (no network)")
    c.add_argument("--env-file")
    c.add_argument("--json", action="store_true")
    c.set_defaults(func=cmd_capabilities)

    d = sub.add_parser("doctor", help="is Gemini configured? (no paid call)")
    d.add_argument("--env-file")
    d.add_argument("--online", action="store_true", help="one free read-only request to check the key")
    d.add_argument("--json", action="store_true")
    d.set_defaults(func=cmd_doctor)

    i = sub.add_parser("image", help="generate or edit images (several candidates per brief)")
    _add_run_options(i, "public/images/generated")
    i.add_argument("--subject", help="with --clean-plate: what the object is, e.g. 'a ceramic desk lamp with a linen shade'")
    i.add_argument("--clean-plate", action="store_true", help="build a reference-still brief for the image-to-3D step")
    i.add_argument("--view", default="three-quarter", help="camera view for --clean-plate")
    i.add_argument("--input-image", action="append", help="reference image to edit or follow (repeatable, max 10); uploaded to Google")
    i.add_argument("--aspect-ratio", help="e.g. 16:9, 1:1, 4:5")
    i.add_argument("--image-size", choices=IMAGE_SIZES)
    i.add_argument("--mime-type", choices=("image/png", "image/jpeg"), default="image/png")
    i.add_argument("--count", type=int, default=1, help="candidates to generate (each is a separate paid job)")
    i.add_argument("--promote", action="store_true", help="with --count 1: ship the result and write the manifest entry")
    i.set_defaults(func=cmd_image)

    v = sub.add_parser("video", help="text-to-video, image-to-video, edit or extend")
    _add_run_options(v, "public/video")
    v.add_argument("--first-frame", help="start from this still (image-to-video); uploaded to Google")
    v.add_argument("--continue", dest="continue_job", metavar="JOB", help="edit or extend the video of this completed job")
    v.add_argument("--task", choices=VIDEO_TASKS)
    v.add_argument("--aspect-ratio", choices=VIDEO_ASPECTS)
    v.add_argument("--resolution", choices=VIDEO_RESOLUTIONS)
    v.add_argument("--delivery", choices=("inline", "uri"), default="inline")
    v.add_argument("--sync", action="store_true", help="one blocking request instead of a background job (not stored by Google)")
    v.add_argument("--fallback-asset", help="manifest id of the poster still that renders when the video is off or fails")
    v.add_argument("--promote", action="store_true")
    v.set_defaults(func=cmd_video)

    pr = sub.add_parser("promote", help="turn a chosen candidate into a shippable asset with provenance")
    pr.add_argument("--candidate", required=True)
    pr.add_argument("--id", required=True)
    pr.add_argument("--root", default=".")
    pr.add_argument("--env-file")
    pr.add_argument("--out-dir", default="public/images/generated")
    pr.add_argument("--manifest", default="asset-manifest.json")
    pr.add_argument("--no-manifest", action="store_true")
    pr.add_argument("--role", default="background")
    pr.add_argument("--alt")
    pr.add_argument("--loading", choices=("eager", "lazy", "on-interaction", "preload"), default="lazy")
    pr.add_argument("--critical", action="store_true")
    pr.add_argument("--fallback")
    pr.add_argument("--fallback-asset")
    pr.add_argument("--overwrite", action="store_true")
    pr.add_argument("--reference-for", metavar="ASSET_ID", help="record that this still was the reference for a 3D asset")
    pr.add_argument("--json", action="store_true")
    pr.set_defaults(func=cmd_promote)

    s = sub.add_parser("status", help="resume a background video job")
    s.add_argument("--job", required=True)
    s.add_argument("--root", default=".")
    s.add_argument("--env-file")
    s.add_argument("--timeout", type=float, default=900.0)
    s.add_argument("--poll-interval", type=float, default=10.0)
    s.add_argument("--json", action="store_true")
    s.set_defaults(func=cmd_status)

    x = sub.add_parser("cancel", help="cancel a running background video job")
    x.add_argument("--job", required=True)
    x.add_argument("--root", default=".")
    x.add_argument("--env-file")
    x.add_argument("--json", action="store_true")
    x.set_defaults(func=cmd_cancel)
    return p


def main(argv: Optional[List[str]] = None, env: Optional[Dict[str, str]] = None, opener: Optional[Callable[..., Any]] = None) -> int:
    args = build_parser().parse_args(argv)
    cfg = load_config(env, Path(args.env_file) if getattr(args, "env_file", None) else None)
    try:
        return int(args.func(args, cfg, opener))
    except g3d.Gen3DError as err:
        return _fail(args, err)
    except KeyboardInterrupt:
        print("interrupted: a created background job keeps running. Use `status --job <id>` to resume or `cancel --job <id>`.", file=sys.stderr)
        return g3d.EXIT_FAILED


if __name__ == "__main__":
    sys.exit(main())

#!/usr/bin/env python3
"""Optional image-to-3D pipeline driver: ``doctor`` | ``setup`` | ``run``.

    doctor   read-only check: Python, gradio_client, Blender (with install help), HF token presence, Space status
    setup    create an isolated venv and install requirements.txt (nothing system-wide)
    run      reference image -> raw GLB (remote Hugging Face Space) -> Blender cleanup -> final GLB
             + asset-manifest entry + receipts. ``--dry-run`` plans everything with zero provider calls.

The image is sent to a third-party Space, so ``run`` without ``--dry-run`` needs
``--approve-upload <space-id> --approved-by "<who, when, quote>"`` (see generate_3d.py).
Exit codes: 0 ok, 1 failure, 2 incomplete (generated but not post-processed / over budget / checks missing),
3 approval or overwrite confirmation missing, 64 usage, 69/75/77 passed through from generate_3d.py.
"""
from __future__ import annotations

import argparse
import glob
import importlib.util
import json
import os
import re
import shutil
import subprocess
import sys
import time
import venv
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

HERE = Path(__file__).resolve().parent
sys.path.insert(0, str(HERE))
import generate_3d as g3d  # noqa: E402

PROCESS_MESH = HERE / "process_mesh.py"
REQUIREMENTS = HERE / "requirements.txt"
RESULT_PREFIX = "PROCESS_MESH_RESULT"
ASSET_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._-]*$")
DEFAULT_BUDGET = 5 * 1024 * 1024
MIN_BLENDER = (3, 6)
EXIT_INCOMPLETE = 2

BLENDER_DOWNLOAD = "https://www.blender.org/download/"


# --------------------------------------------------------------------------------------------
# Blender discovery
# --------------------------------------------------------------------------------------------
def blender_candidates(platform_name: str, env: Dict[str, str], which: Callable[[str], Optional[str]],
                       glob_fn: Callable[[str], List[str]]) -> List[str]:
    found: List[str] = []
    for key in ("BLENDER_PATH", "BLENDER_BIN"):
        if env.get(key):
            found.append(env[key])
    on_path = which("blender")
    if on_path:
        found.append(on_path)
    if platform_name.startswith("win"):
        roots = [env.get("ProgramFiles", r"C:\Program Files"), env.get("ProgramFiles(x86)", r"C:\Program Files (x86)")]
        local = env.get("LOCALAPPDATA")
        pats = [os.path.join(r, "Blender Foundation", "Blender *", "blender.exe") for r in roots]
        if local:
            pats.append(os.path.join(local, "Programs", "Blender Foundation", "Blender *", "blender.exe"))
        pats.append(os.path.join(roots[1], "Steam", "steamapps", "common", "Blender", "blender.exe"))
        for pat in pats:
            found.extend(sorted(glob_fn(pat), reverse=True))
    elif platform_name == "darwin":
        found.extend(["/Applications/Blender.app/Contents/MacOS/Blender",
                      os.path.expanduser("~/Applications/Blender.app/Contents/MacOS/Blender")])
    else:
        found.extend(["/usr/bin/blender", "/usr/local/bin/blender", "/snap/bin/blender"])
    return found


def find_blender(explicit: Optional[str] = None, env: Optional[Dict[str, str]] = None,
                 which: Callable[[str], Optional[str]] = shutil.which, platform_name: str = sys.platform,
                 glob_fn: Callable[[str], List[str]] = glob.glob, is_file: Callable[[str], bool] = os.path.isfile) -> Optional[str]:
    env = dict(os.environ if env is None else env)
    candidates = ([explicit] if explicit else []) + blender_candidates(platform_name, env, which, glob_fn)
    for c in candidates:
        if c and is_file(c):
            return c
    return None


def blender_version(path: str, runner: Callable[..., Any] = subprocess.run) -> Optional[str]:
    try:
        proc = runner([path, "--version"], capture_output=True, text=True, timeout=60)
    except (OSError, subprocess.SubprocessError):
        return None
    match = re.search(r"Blender\s+(\d+\.\d+(?:\.\d+)?)", proc.stdout or "")
    return match.group(1) if match else None


def version_tuple(text: Optional[str]) -> tuple:
    return tuple(int(x) for x in (text or "0").split(".")[:2]) if text else (0, 0)


def blender_install_help(platform_name: str = sys.platform) -> str:
    base = [
        f"Blender is free and open source. Download it from {BLENDER_DOWNLOAD} (an LTS release, {MIN_BLENDER[0]}.{MIN_BLENDER[1]} or newer, is the safest choice).",
        "You do NOT have to edit PATH: point the pipeline at it with --blender <path> or the BLENDER_PATH environment variable.",
    ]
    if platform_name.startswith("win"):
        base += [
            "Windows: run the installer (or unzip the portable build). The executable is usually",
            r"  C:\Program Files\Blender Foundation\Blender 4.x\blender.exe",
            "To use the bare command `blender`: Start menu > 'Edit the system environment variables' > Environment Variables >",
            "  select Path (User) > Edit > New > the folder that contains blender.exe > OK, then open a NEW terminal.",
            "Check:  blender --version",
        ]
    elif platform_name == "darwin":
        base += [
            "macOS: open the .dmg and drag Blender into Applications. The executable is",
            "  /Applications/Blender.app/Contents/MacOS/Blender",
            "To use the bare command: add to ~/.zshrc  export PATH=\"/Applications/Blender.app/Contents/MacOS:$PATH\"  then open a new terminal.",
            "Check:  Blender --version",
        ]
    else:
        base += [
            "Linux: unpack the tarball and put its folder on PATH, or install a package (distribution packages are often old):",
            "  sudo snap install blender --classic",
            "To use the bare command from a tarball: add to ~/.bashrc  export PATH=\"$HOME/blender-4.x:$PATH\"  then open a new terminal.",
            "Check:  blender --version",
        ]
    return "\n".join(base)


# --------------------------------------------------------------------------------------------
# doctor
# --------------------------------------------------------------------------------------------
def doctor(blender_arg: Optional[str] = None, offline: bool = False, space: Optional[str] = None,
           env_file: Optional[str] = None) -> Dict[str, Any]:
    checks: List[Dict[str, Any]] = []
    steps: List[str] = []

    py = sys.version_info
    checks.append({"id": "python", "status": "ok" if py >= (3, 10) else ("warn" if py >= (3, 9) else "missing"),
                   "detail": f"Python {py.major}.{py.minor}.{py.micro} at {sys.executable}",
                   "note": "gradio_client needs Python 3.10 or newer" if py < (3, 10) else None})
    spec = importlib.util.find_spec("gradio_client")
    version = None
    if spec:
        try:
            from importlib.metadata import version as pkg_version
            version = pkg_version("gradio_client")
        except Exception:  # noqa: BLE001
            version = "unknown"
    checks.append({"id": "gradio_client", "status": "ok" if spec else "missing",
                   "detail": f"gradio_client {version}" if spec else "not importable in this interpreter"})
    if not spec:
        steps.append("python scripts/image-to-3d/image_to_glb.py setup   (creates .venv-image-to-3d and installs gradio_client)")

    blender = find_blender(blender_arg)
    if blender:
        bv = blender_version(blender)
        status = "ok" if bv and version_tuple(bv) >= MIN_BLENDER else "warn"
        checks.append({"id": "blender", "status": status, "detail": f"{blender} (version {bv or 'unknown'})",
                       "note": None if status == "ok" else f"{MIN_BLENDER[0]}.{MIN_BLENDER[1]} or newer is recommended"})
    else:
        checks.append({"id": "blender", "status": "missing", "detail": "not on PATH and not in the usual install folders"})
        steps.append("Install Blender:\n" + blender_install_help())

    checks.append({"id": "hf_token", "status": "ok" if os.environ.get("HF_TOKEN") else "info",
                   "detail": "HF_TOKEN is set (raises the ZeroGPU quota; value never printed)" if os.environ.get("HF_TOKEN")
                   else "HF_TOKEN not set (optional; anonymous quota is smaller)"})

    import gemini_media as gm  # optional stage: imported here so the rest of the toolkit never depends on it
    gcfg = gm.load_config(None, Path(env_file) if env_file else None)
    gemini_ready = gcfg.has_access() and bool(gcfg.image_model or gcfg.video_model)
    if gemini_ready:
        models = ", ".join(f"{k} {v}" for k, v in (("image", gcfg.image_model), ("video", gcfg.video_model)) if v)
        checks.append({"id": "gemini", "status": "ok", "detail": f"GEMINI_API_KEY is set ({models}); value never printed. Paid-tier key required by Google's image and video models"})
    else:
        checks.append({"id": "gemini", "status": "info", "detail": "not configured (optional): reference stills come from a user-supplied image or another approved route; "
                       "run `gemini_media.py doctor` for setup"})

    target = space or g3d.BACKENDS["trellis"].default_space
    if offline:
        checks.append({"id": "space", "status": "skipped", "detail": "--offline"})
    else:
        probe = g3d.probe_space(target)
        checks.append({"id": "space", "status": "ok" if probe["stage"] == "RUNNING" else "warn",
                       "detail": f"{target}: stage {probe['stage']}" + (f", hardware {probe['hardware']}" if probe.get("hardware") else "")})

    ready_gen = bool(spec) and not offline_blocked(checks)
    ready_post = blender is not None
    return {"ready_to_generate": ready_gen, "ready_to_post_process": ready_post, "gemini_available": gemini_ready,
            "checks": checks, "next_steps": steps}


def offline_blocked(checks: List[Dict[str, Any]]) -> bool:
    return any(c["id"] == "space" and c["status"] == "warn" for c in checks)


def cmd_doctor(args: argparse.Namespace) -> int:
    report = doctor(args.blender, args.offline, args.space, args.env_file)
    if args.json:
        print(json.dumps(report, indent=2))
    else:
        for c in report["checks"]:
            print(f"[{c['status'].upper():7}] {c['id']}: {c['detail']}" + (f" ({c['note']})" if c.get("note") else ""))
        print(f"ready to generate: {report['ready_to_generate']}   ready to post-process: {report['ready_to_post_process']}")
        for s in report["next_steps"]:
            print("\n" + s)
    return 0 if report["ready_to_generate"] and report["ready_to_post_process"] else EXIT_INCOMPLETE


# --------------------------------------------------------------------------------------------
# setup
# --------------------------------------------------------------------------------------------
def venv_python(venv_dir: Path) -> Path:
    return venv_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")


def cmd_setup(args: argparse.Namespace) -> int:
    venv_dir = Path(args.venv).resolve()
    py = venv_python(venv_dir)
    pip_cmd = [str(py), "-m", "pip", "install", "--disable-pip-version-check", "-r", str(REQUIREMENTS)]
    if args.print_only:
        print(f"would create venv: {venv_dir}\nwould run: {' '.join(pip_cmd)}")
        return 0
    if sys.version_info < (3, 10):
        print("warning: Python < 3.10; current gradio_client releases need 3.10+, the install may fail", file=sys.stderr)
    if not py.exists():
        print(f"creating venv {venv_dir}")
        venv.EnvBuilder(with_pip=True).create(str(venv_dir))
    print("installing requirements (PyPI) ...")
    proc = subprocess.run(pip_cmd, capture_output=True, text=True)
    if proc.returncode != 0:
        print(g3d.redact((proc.stderr or proc.stdout)[-1500:]), file=sys.stderr)
        print("error: pip install failed", file=sys.stderr)
        return g3d.EXIT_FAILED
    script = Path(__file__).resolve()
    print(f"ok. Run the pipeline with the venv interpreter:\n  {py} {script} doctor\n  {py} {script} run --help")
    print(f"Add {venv_dir.name}/ to the project's .gitignore.")
    return 0


# --------------------------------------------------------------------------------------------
# run
# --------------------------------------------------------------------------------------------
def build_manifest_entry(*, asset_id: str, rel_path: str, role: str, backend: str, space: str, seed: Optional[int],
                         params: Dict[str, Any], approved_by: str, size: int, processed: bool, critical: bool,
                         loading: str, fallback: Optional[str], alt: Optional[str], notes: str,
                         blender: Optional[str], today: str) -> Dict[str, Any]:
    spec = g3d.BACKENDS[backend]
    entry: Dict[str, Any] = {
        "id": asset_id,
        "type": "model3d",
        "role": role,
        "path": rel_path,
        "source": "generated",
        "generator": {
            "tool": f"image_to_glb.py (generate_3d.py via gradio_client, {space}" + (", process_mesh.py in Blender)" if processed else ")"),
            "model": spec.model_note,
            "seed": seed if seed is not None else "n/a",
            "params": {"backend": backend, "space": space, **params, **({"blender": blender} if blender else {})},
            "costApprovedBy": f"free tier; upload approved: {approved_by}",
        },
        "bytes": size,
        "format": "glb",
        "license": ("generated; TRELLIS model weights MIT; confirm you own the source image and the Space terms before commercial use"
                    if backend == "trellis" else f"generated; {spec.license_note}"),
        "usageRestrictions": ("Source-image rights stay with the image owner; AI-generated: disclose per project policy."
                              if backend == "trellis" else spec.license_note),
        "critical": critical,
        "loading": loading,
        "optimization": "optimized" if processed else "pending",
        "validation": {"status": "pending", "checkedOn": None, "notes": notes},
    }
    if fallback:
        entry["fallback"] = fallback
    if alt is not None:
        entry["alt"] = alt
    return entry


def upsert_manifest(path: Path, project: str, entry: Dict[str, Any]) -> str:
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8-sig"))
        except json.JSONDecodeError as exc:
            raise g3d.Gen3DError("invalid_input", f"{path.name} is not valid JSON ({exc}); fix it or pass --no-manifest", g3d.EXIT_USAGE) from exc
        if not isinstance(data, dict) or not isinstance(data.get("assets"), list):
            raise g3d.Gen3DError("invalid_input", f"{path.name} has no assets[] array; pass --no-manifest", g3d.EXIT_USAGE)
        action = "updated"
    else:
        data, action = {"version": "1.0", "project": project, "assets": []}, "created"
    assets = data["assets"]
    for i, existing in enumerate(assets):
        if isinstance(existing, dict) and existing.get("id") == entry["id"]:
            assets[i] = entry
            action = "updated"
            break
    else:
        assets.append(entry)
    g3d.write_json(path, data)
    return action


def merge_receipts(path: Path, asset_id: str, record: Dict[str, Any]) -> None:
    data: Dict[str, Any] = {}
    if path.exists():
        try:
            data = json.loads(path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            data = {}
    data[asset_id] = record
    g3d.write_json(path, data)


def run_blender(blender: str, raw: Path, final: Path, opts: List[str], timeout: float = 900.0,
                runner: Callable[..., Any] = subprocess.run) -> Dict[str, Any]:
    cmd = [blender, "--background", "--factory-startup", "--python-exit-code", "1",
           "--python", str(PROCESS_MESH), "--", str(raw), str(final), *opts]
    try:
        proc = runner(cmd, capture_output=True, text=True, timeout=timeout)
    except subprocess.TimeoutExpired as exc:
        raise g3d.Gen3DError("blender_timeout", f"Blender did not finish within {timeout:.0f}s", g3d.EXIT_TEMPFAIL) from exc
    except OSError as exc:
        raise g3d.Gen3DError("blender_failed", f"could not start Blender: {g3d.redact(exc)}", g3d.EXIT_FAILED) from exc
    result = None
    for line in (proc.stdout or "").splitlines():
        if line.startswith(RESULT_PREFIX + " "):
            try:
                result = json.loads(line[len(RESULT_PREFIX) + 1:])
            except json.JSONDecodeError:
                result = None
    if proc.returncode != 0 or not result or not result.get("ok"):
        tail = g3d.redact(((proc.stderr or "") + (proc.stdout or ""))[-1200:])
        why = (result or {}).get("error") or f"exit status {proc.returncode}"
        raise g3d.Gen3DError("blender_failed", f"Blender post-processing failed ({why}). Output tail:\n{tail}", g3d.EXIT_FAILED)
    return result


def resolve_inside(root: Path, rel: str, what: str) -> Path:
    target = (root / rel).resolve()
    try:
        target.relative_to(root.resolve())
    except ValueError as exc:
        raise g3d.Gen3DError("invalid_input", f"{what} must stay inside the project root", g3d.EXIT_USAGE) from exc
    return target


def cmd_run(args: argparse.Namespace) -> int:
    log = g3d._default_log
    try:
        if not ASSET_ID_RE.match(args.id):
            raise g3d.Gen3DError("invalid_input", "--id must match [A-Za-z0-9][A-Za-z0-9._-]*", g3d.EXIT_USAGE)
        root = Path(args.root).resolve()
        if not root.is_dir():
            raise g3d.Gen3DError("invalid_input", f"--root is not a directory: {root.name}", g3d.EXIT_USAGE)
        if args.reference_asset and not ASSET_ID_RE.match(args.reference_asset):
            raise g3d.Gen3DError("invalid_input", "--reference-asset must match [A-Za-z0-9][A-Za-z0-9._-]*", g3d.EXIT_USAGE)
        if args.critical and not args.fallback:
            raise g3d.Gen3DError("invalid_input", "a critical asset needs --fallback (what renders without the model)", g3d.EXIT_USAGE)
        out_dir = resolve_inside(root, args.out_dir, "--out-dir")
        src_dir = out_dir / "_sources"
        final, raw = out_dir / f"{args.id}.glb", src_dir / f"{args.id}.raw.glb"
        params = g3d.GenParams(
            seed=args.seed, preprocess=args.preprocess, ss_guidance=args.ss_guidance, ss_steps=args.ss_steps,
            slat_guidance=args.slat_guidance, slat_steps=args.slat_steps, mesh_simplify=args.mesh_simplify,
            texture_size=args.texture_size, hy_steps=args.hy_steps, hy_guidance=args.hy_guidance,
            hy_octree=args.hy_octree, hy_chunks=args.hy_chunks, hy_textured=not args.hy_untextured)
        spec = g3d.BACKENDS[args.backend]
        space = args.space or (os.environ.get("TRELLIS_SPACE") if args.backend == "trellis" else None) or spec.default_space

        if not args.dry_run and not args.overwrite and (final.exists() or raw.exists()):
            raise g3d.Gen3DError("overwrite_required", f"{final.name} or its raw source already exists; keep originals, choose another --id, "
                                 "or get the user's approval and pass --overwrite", g3d.EXIT_APPROVAL)

        blender = find_blender(args.blender)
        bver = blender_version(blender) if blender else None
        if args.dry_run:
            res = g3d.generate(Path(args.image), raw, backend=args.backend, space=space, params=params, dry_run=True,
                               receipt_path=src_dir / f"{args.id}.dry-run.json")
            summary = {"ok": True, "dry_run": True, "provider_calls": 0, "plan": res["plan"], "final": str(final),
                       "post_process": f"Blender {bver} at {blender}" if blender else "NOT AVAILABLE: " + "Blender not found (see doctor)",
                       "receipt": str(src_dir / f"{args.id}.dry-run.json")}
            print(json.dumps(summary, indent=2) if args.json else
                  f"DRY RUN (0 provider calls)\n  send:    {res['plan']['input']['file']} -> {space}\n  steps:   {', '.join(res['plan']['expected_endpoints'])}\n"
                  f"  raw:     {raw}\n  final:   {final}\n  blender: {summary['post_process']}\n  receipt: {summary['receipt']}")
            return 0

        gen = g3d.generate(Path(args.image), raw, backend=args.backend, space=space, params=params, timeout=args.timeout,
                           approve_upload=args.approve_upload, approved_by=args.approved_by,
                           accept_license=args.accept_hunyuan_license, token=os.environ.get("HF_TOKEN") or None,
                           skip_probe=args.skip_probe, receipt_path=src_dir / f"{args.id}.generate-receipt.json")
    except g3d.Gen3DError as err:
        print(json.dumps({"ok": False, "error": {"kind": err.kind, "message": err.message}}) if args.json else f"error[{err.kind}]: {err.message}",
              file=sys.stderr if not args.json else sys.stdout)
        return err.exit_code

    notes: List[str] = list(gen["warnings"])
    process_report: Optional[Dict[str, Any]] = None
    processed = False
    exit_code = 0
    opts = ["--target-size", str(args.target_size), "--pivot", args.pivot, "--texture-max-size", str(args.texture_max_size),
            "--texture-format", args.texture_format, "--max-triangles", str(args.max_triangles)] + (["--draco"] if args.draco else [])
    if blender:
        try:
            log(f"[blender] {blender} {bver or ''}".strip())
            process_report = run_blender(blender, raw, final, opts)
            g3d.inspect_glb(final)
            processed = True
            notes.extend(process_report.get("warnings", []))
        except (g3d.Gen3DError, g3d.GlbError, OSError) as err:
            msg = err.message if isinstance(err, g3d.Gen3DError) else str(err)
            notes.append(f"post-processing failed: {msg.splitlines()[0]}")
            log(f"[blender] FAILED: {msg}")
            exit_code = EXIT_INCOMPLETE
    else:
        notes.append("Blender not found: post-processing NOT RUN")
        log("Blender not found. " + blender_install_help())
        exit_code = EXIT_INCOMPLETE
    if not processed:
        if args.allow_unprocessed:
            shutil.copyfile(raw, final)
            notes.append("raw GLB shipped unprocessed (--allow-unprocessed): pivot, scale and textures not normalised")
        else:
            final_state = {"ok": False, "incomplete": True, "raw": str(raw), "reason": notes[-1],
                           "next": "install/point to Blender and rerun the post-process, or pass --allow-unprocessed to ship the raw GLB"}
            print(json.dumps(final_state, indent=2) if args.json else
                  f"INCOMPLETE: raw GLB is at {raw}\n  {notes[-1]}\n  Raw GLBs are valid but unnormalised; rerun after fixing Blender, or use --allow-unprocessed.")
            merge_receipts(src_dir / "receipts.json", args.id, {"raw": {"file": raw.name, "bytes": gen["bytes"], "sha256": gen["sha256"]},
                                                              "status": "incomplete", "notes": notes})
            return EXIT_INCOMPLETE

    final_bytes = final.stat().st_size
    if final_bytes > args.budget_bytes:
        notes.append(f"over budget: {final_bytes} > {args.budget_bytes} bytes; lower --texture-max-size/--texture-size, try --texture-format jpeg, or --draco")
        exit_code = EXIT_INCOMPLETE
    rel = final.relative_to(root).as_posix()
    entry = build_manifest_entry(
        asset_id=args.id, rel_path=rel, role=args.role, backend=args.backend, space=space, seed=gen["seed"],
        params={**{k: v for k, v in g3d.asdict(params).items() if k != "seed"},
                **({"referenceAsset": args.reference_asset} if args.reference_asset else {})}, approved_by=args.approved_by.strip(),
        size=final_bytes, processed=processed, critical=args.critical, loading=args.loading, fallback=args.fallback,
        alt=args.alt, notes=("; ".join(notes) or "generated and post-processed; run scripts/asset-validation.mjs") +
        " | receipts: " + (src_dir.relative_to(root) / "receipts.json").as_posix(),
        blender=bver if processed else None, today=time.strftime("%Y-%m-%d"))
    manifest_state = "skipped (--no-manifest)"
    if not args.no_manifest:
        manifest_path = resolve_inside(root, args.manifest, "--manifest")
        manifest_state = f"{upsert_manifest(manifest_path, root.name, entry)} {manifest_path.relative_to(root).as_posix()}"
    merge_receipts(src_dir / "receipts.json", args.id, {
        "generate": {"backend": gen["backend"], "space": gen["space"], "seed": gen["seed"], "endpoints": gen["endpoints"],
                     "glb": gen["glb"], "input": gen["plan"]["input"], "approved_by": args.approved_by.strip()},
        "process": process_report, "raw": {"file": raw.name, "bytes": gen["bytes"], "sha256": gen["sha256"]},
        "final": {"file": final.name, "bytes": final_bytes, "sha256": g3d.sha256_file(final)}, "notes": notes,
        "recorded_on": time.strftime("%Y-%m-%d")})
    summary = {"ok": exit_code == 0, "incomplete": exit_code == EXIT_INCOMPLETE, "final": rel, "bytes": final_bytes, "processed": processed,
               "seed": gen["seed"], "manifest": manifest_state, "notes": notes,
               "next": f"node <skill-dir>/scripts/asset-validation.mjs --manifest {args.manifest} --root {args.root}"}
    if args.json:
        print(json.dumps(summary, indent=2))
    else:
        print(f"{'OK' if exit_code == 0 else 'INCOMPLETE'} {rel} ({final_bytes} bytes, processed={processed}) seed={gen['seed']}\n"
              f"  manifest: {manifest_state}\n  next: {summary['next']}")
        for n in notes:
            print(f"  note: {n}")
    return exit_code


# --------------------------------------------------------------------------------------------
# CLI
# --------------------------------------------------------------------------------------------
def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(prog="image_to_glb.py", description=__doc__.split("\n\n")[0],
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="command", required=True)

    d = sub.add_parser("doctor", help="read-only environment check with install help")
    d.add_argument("--blender", help="path to the Blender executable")
    d.add_argument("--offline", action="store_true", help="skip the Space status request")
    d.add_argument("--space")
    d.add_argument("--env-file", help="read GEMINI_* settings from this file (the process environment wins)")
    d.add_argument("--json", action="store_true")
    d.set_defaults(func=cmd_doctor)

    s = sub.add_parser("setup", help="create an isolated venv and install requirements.txt")
    s.add_argument("--venv", default=".venv-image-to-3d")
    s.add_argument("--print-only", action="store_true")
    s.set_defaults(func=cmd_setup)

    r = sub.add_parser("run", help="image -> GLB (remote generation + Blender cleanup)")
    r.add_argument("--image", required=True)
    r.add_argument("--id", required=True, help="asset id (also the file name)")
    r.add_argument("--root", default=".", help="project root (manifest paths are relative to it)")
    r.add_argument("--out-dir", default="public/models", help="folder under --root for the final GLB")
    r.add_argument("--manifest", default="asset-manifest.json")
    r.add_argument("--no-manifest", action="store_true")
    r.add_argument("--role", default="product")
    r.add_argument("--loading", choices=("eager", "lazy", "on-interaction", "preload"), default="lazy")
    r.add_argument("--critical", action="store_true")
    r.add_argument("--fallback", help="what renders without the model (required with --critical)")
    r.add_argument("--alt")
    r.add_argument("--reference-asset", metavar="ASSET_ID", help="manifest id of the Gemini (or other) reference still this model was built from; recorded as provenance")
    r.add_argument("--budget-bytes", type=int, default=DEFAULT_BUDGET)
    r.add_argument("--overwrite", action="store_true", help="replace an existing GLB (needs the user's approval)")
    r.add_argument("--allow-unprocessed", action="store_true", help="ship the raw GLB if Blender is missing/fails (recorded)")
    r.add_argument("--blender", help="path to the Blender executable")
    r.add_argument("--target-size", type=float, default=2.0)
    r.add_argument("--pivot", choices=("center", "bottom"), default="center")
    r.add_argument("--texture-max-size", type=int, default=1024)
    r.add_argument("--texture-format", choices=("auto", "jpeg", "webp", "png"), default="auto")
    r.add_argument("--max-triangles", type=int, default=0)
    r.add_argument("--draco", action="store_true")
    r.add_argument("--backend", choices=sorted(g3d.BACKENDS), default="trellis")
    r.add_argument("--space")
    r.add_argument("--seed", type=int)
    r.add_argument("--preprocess", choices=("always", "never"), default="always")
    r.add_argument("--ss-guidance", type=float, default=7.5)
    r.add_argument("--ss-steps", type=int, default=12)
    r.add_argument("--slat-guidance", type=float, default=3.0)
    r.add_argument("--slat-steps", type=int, default=12)
    r.add_argument("--mesh-simplify", type=float, default=0.95)
    r.add_argument("--texture-size", type=int, default=1024)
    r.add_argument("--hy-steps", type=int, default=50)
    r.add_argument("--hy-guidance", type=float, default=7.5)
    r.add_argument("--hy-octree", type=int, default=256)
    r.add_argument("--hy-chunks", type=int, default=200000)
    r.add_argument("--hy-untextured", action="store_true")
    r.add_argument("--timeout", type=float, default=900.0)
    r.add_argument("--dry-run", action="store_true")
    r.add_argument("--approve-upload", metavar="SPACE")
    r.add_argument("--approved-by", metavar="TEXT")
    r.add_argument("--accept-hunyuan-license", action="store_true")
    r.add_argument("--skip-probe", action="store_true")
    r.add_argument("--json", action="store_true")
    r.set_defaults(func=cmd_run)
    return p


def main(argv: Optional[List[str]] = None) -> int:
    args = build_parser().parse_args(argv)
    return int(args.func(args))


if __name__ == "__main__":
    sys.exit(main())

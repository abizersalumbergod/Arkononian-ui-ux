# image-to-3d (optional Python toolkit)

Two optional stages, one module of rules: [references/image-to-3d-pipeline.md](../../references/image-to-3d-pipeline.md). This file is the quick reference.

- **Stage A, Gemini (only if you have Gemini API access):** generate reference stills, site images and video. Useful for ordinary static sites too, not only 3D.
- **Stage B, image to 3D:** one reference image becomes a web-ready GLB on a free public Hugging Face Space (TRELLIS by default), then headless Blender cleans it up, then manifest entry and receipts.

Gemini first, then 3D: a clean generated reference gives stage B a better input and doubles as the poster. **No Gemini access? Nothing breaks.** `doctor` says "not configured", and the normal procedure supplies the image or the assets (a user-supplied image, licensed retrieval, procedural assets, another approved generator). Stage B works the same on any clean image.

Neither stage is local or free of consequences: Gemini calls are paid and send your prompt (and any reference image) to Google; stage B uploads the image to a third-party Space with a free but quota-limited GPU. Both refuse to start without an explicit approval, support `--dry-run`, and submit each job once.

| File | What it does |
|---|---|
| `gemini_media.py` | Stage A: `capabilities`, `doctor`, `image`, `video`, `promote`, `status`, `cancel`. Standard library only |
| `image_to_glb.py` | Stage B entry point: `doctor` (read-only checks and install help), `setup` (isolated venv), `run` (the whole pipeline) |
| `generate_3d.py` | Image to raw GLB through a Space: approval gate, schema discovery, polling, cancel, GLB validation, receipt |
| `process_mesh.py` | Runs inside Blender: flatten, centre pivot, scale, material check, texture downscale, export |
| `.env.example` | Placeholders for the `GEMINI_*` settings (copy to a git-ignored `.env` in your project) |
| `requirements.txt` | `gradio_client` (stage B only) |

## Stage A: Gemini

Needs a Gemini API key from a billing-enabled Google project (Google lists the image and video models as paid-only, checked 2026-10-29) and current model ids from Google's docs.

```bash
cp .env.example <your-project>/.env      # fill it in; keep it out of git; never paste the key into chat
python gemini_media.py doctor --env-file .env
python gemini_media.py image --id lamp-ref --subject "a ceramic desk lamp" --clean-plate --count 3 --env-file .env --dry-run
python gemini_media.py image --id lamp-ref --subject "a ceramic desk lamp" --clean-plate --count 3 --env-file .env \
  --approve-provider gemini --approved-by "<who>, <date>, \"<their yes: 3 images>\""
python gemini_media.py promote --candidate _sources/gemini/candidates/lamp-ref-c2.png --id lamp-ref --role reference --alt "" --out-dir refs
```

- `image` generates or edits (`--input-image`, repeatable; each file name must be approved with `--approved-uploads`). `--promote` ships a single result straight into `asset-manifest.json`.
- `video` creates a background job (`--first-frame` for image-to-video, `--continue <job> --task edit|extend`), saves its id before polling, and never recreates a running or finished job. `status --job` resumes, `cancel --job` stops.
- Caps: 4 images or 1 video per run by default (`GEMINI_MAX_JOBS_PER_RUN`, `--max-jobs`), optional `--token-budget`. Create requests are re-sent only when Google rejected them before doing work, and only with `--retries`.
- The key travels only in the `x-goog-api-key` header and is redacted everywhere. Model ids are configuration (`GEMINI_IMAGE_MODEL`, `GEMINI_VIDEO_MODEL`), not code.
- Exit 77 or 69 with `normal_procedure` in `--json` means Gemini is not usable: continue with the normal procedure.

## Stage B: image to 3D

- Python 3.9+ to run the tool (`gradio_client` itself needs 3.10+), installed by `setup` into `.venv-image-to-3d/` (add it to `.gitignore`); nothing is installed system-wide.
- Blender 3.6 or newer for the cleanup step: https://www.blender.org/download/. It does not have to be on PATH; use `--blender <path>` or `BLENDER_PATH`. `doctor` prints OS-specific install steps when it is missing.
- Optional `HF_TOKEN` for a larger anonymous GPU quota (environment only; never printed or stored).

```bash
python image_to_glb.py doctor
python image_to_glb.py setup
<venv-python> image_to_glb.py run --image refs/lamp-ref.png --reference-asset lamp-ref --id lamp-3d --root . --dry-run
<venv-python> image_to_glb.py run --image refs/lamp-ref.png --reference-asset lamp-ref --id lamp-3d --root . \
  --approve-upload trellis-community/TRELLIS --approved-by "<who>, <date>, \"<their yes>\""
```

`run` without `--dry-run` refuses to start unless `--approve-upload` names the Space and `--approved-by` records the user's approval. Blender's raw-versus-final handling, the manifest entry and every exit code are in the module. Direct use of the two parts:

```bash
<venv-python> generate_3d.py --image product.png --out raw.glb --dry-run
<venv-python> generate_3d.py --probe                      # read-only: Space stage and endpoint names
blender --background --factory-startup --python-exit-code 1 --python process_mesh.py -- raw.glb final.glb --pivot bottom
```

## Defaults worth knowing

- Stage A writes candidates and job records to `_sources/gemini/`, and promoted files to `public/images/generated/` or `public/video/`. Stage B writes to `public/models`, keeps the raw GLB in `_sources/`, and overwrites nothing without `--overwrite`.
- Promoted Gemini files are raw outputs (`optimization: pending`); optimise them per the image and video pipeline modules before `asset-validation.mjs`.
- Final GLB budget 5 MiB (`--budget-bytes`); over budget is reported as incomplete, not hidden. Draco is off, so the model loads without a decoder.
- Hunyuan3D-2 is opt-in (`--backend hunyuan3d --accept-hunyuan-license`) because its licence excludes the EU, the UK and South Korea; it is experimental and was not exercised against the live Space.

## Tests

```bash
python -B -I -m unittest discover -s tests/image-to-3d -p "test_*.py"     # from the skill folder
```

They use a fake Gemini network layer and a fake Space client driven by recorded request and response shapes, so they need no network, no key, no Blender and no `gradio_client`. They do not prove a live Gemini request, a live generation or the `bpy` calls inside Blender; see the module's Verification section for what was and was not exercised.

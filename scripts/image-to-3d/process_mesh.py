#!/usr/bin/env python3
"""Headless Blender post-processing for a generated GLB: centre the pivot, scale, verify materials, re-export.

Run it with Blender, not with plain Python:

    blender --background --factory-startup --python-exit-code 1 \
        --python process_mesh.py -- <input.glb> <output.glb> [options]

``--python-exit-code 1`` makes a script error produce a non-zero exit status. Everything after the
lone ``--`` belongs to this script. The script prints one line starting with ``PROCESS_MESH_RESULT``
(JSON) and writes ``<output>.report.json``. It only uses Blender's bundled Python and ``bpy``.

What it does, in order:
  1. empty scene, import the GLB;
  2. static assets only: flatten the node hierarchy, drop cameras/lights/empties, apply transforms;
  3. move the pivot (``--pivot center`` or ``bottom``) and scale uniformly so the longest side equals
     ``--target-size`` (default 2.0 units);
  4. verify materials (give mesh slots a plain PBR fallback material if none exists, flag missing
     Principled BSDF / base-colour textures), optionally downscale textures (``--texture-max-size``)
     and decimate (``--max-triangles``, off by default because it can damage UVs);
  5. export a compatible GLB (no Draco unless ``--draco``; unknown exporter options are dropped, not fatal).

Animated or skinned assets are NOT restructured: they are re-exported as imported, with a warning.
The pure helpers (argument parsing, fit maths) are importable without Blender and are unit-tested.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from typing import Any, Dict, List, Optional, Sequence

try:  # Blender provides bpy; plain Python (tests, linters) does not.
    import bpy  # type: ignore
    from mathutils import Vector  # type: ignore
except ImportError:  # pragma: no cover - exercised only outside Blender
    bpy = None
    Vector = None

RESULT_PREFIX = "PROCESS_MESH_RESULT"
TEXTURE_FORMATS = ("auto", "jpeg", "webp", "png")


# --------------------------------------------------------------------------------------------
# Pure helpers (no bpy)
# --------------------------------------------------------------------------------------------
def argv_after_double_dash(argv: Sequence[str]) -> List[str]:
    """Blender passes its own flags first; ours follow the first ``--``."""
    argv = list(argv)
    return argv[argv.index("--") + 1:] if "--" in argv else []


def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="process_mesh.py",
        description="Headless Blender cleanup for a GLB. Run: blender --background --python process_mesh.py -- <in.glb> <out.glb> [options]")
    p.add_argument("input", help="input .glb/.gltf")
    p.add_argument("output", help="output .glb (must differ from the input: originals are kept)")
    p.add_argument("--target-size", type=float, default=2.0, help="longest side after scaling, in scene units (default 2.0)")
    p.add_argument("--pivot", choices=("center", "bottom"), default="center",
                   help="center = origin at the bounding-box centre; bottom = origin at the middle of the base (default center)")
    p.add_argument("--texture-max-size", type=int, default=1024, help="downscale textures larger than this (0 = off, default 1024)")
    p.add_argument("--texture-format", choices=TEXTURE_FORMATS, default="auto", help="image format inside the GLB (default auto)")
    p.add_argument("--jpeg-quality", type=int, default=85)
    p.add_argument("--max-triangles", type=int, default=0, help="decimate above this triangle count (0 = off)")
    p.add_argument("--draco", action="store_true", help="Draco mesh compression (the page then needs a Draco decoder)")
    p.add_argument("--report", help="report path (default: <output>.report.json)")
    return p


def validate_args(args: argparse.Namespace) -> None:
    if not args.input.lower().endswith((".glb", ".gltf")):
        raise ValueError("input must be a .glb or .gltf file")
    if not args.output.lower().endswith(".glb"):
        raise ValueError("output must end with .glb")
    if os.path.abspath(args.input) == os.path.abspath(args.output):
        raise ValueError("output must differ from input: originals are never overwritten")
    if not 0.001 <= args.target_size <= 1000:
        raise ValueError("--target-size must be between 0.001 and 1000")
    if args.texture_max_size < 0 or args.max_triangles < 0:
        raise ValueError("--texture-max-size and --max-triangles cannot be negative")
    if not 1 <= args.jpeg_quality <= 100:
        raise ValueError("--jpeg-quality must be 1..100")


def compute_fit(bbox_min: Sequence[float], bbox_max: Sequence[float], target_size: float, pivot: str) -> Dict[str, Any]:
    """Uniform scale + translation (applied BEFORE scaling) that fits the bounding box. Z is up in Blender."""
    size = [bbox_max[i] - bbox_min[i] for i in range(3)]
    largest = max(size)
    scale = (target_size / largest) if largest > 1e-9 else 1.0
    centre = [(bbox_min[i] + bbox_max[i]) / 2.0 for i in range(3)]
    if pivot == "bottom":
        translation = [-centre[0], -centre[1], -bbox_min[2]]
    else:
        translation = [-centre[0], -centre[1], -centre[2]]
    return {
        "scale": scale,
        "translation": translation,
        "size_before": size,
        "size_after": [s * scale for s in size],
        "degenerate": largest <= 1e-9,
    }


# --------------------------------------------------------------------------------------------
# Blender-side steps
# --------------------------------------------------------------------------------------------
def _require_bpy() -> None:
    if bpy is None:
        raise RuntimeError("bpy is not available: run this script with Blender "
                           "(blender --background --python process_mesh.py -- <in.glb> <out.glb>)")


def mesh_objects() -> list:
    return [o for o in bpy.context.scene.objects if o.type == "MESH"]


def is_animated() -> bool:
    if any(o.type == "ARMATURE" for o in bpy.context.scene.objects):
        return True
    return any(getattr(o, "animation_data", None) and o.animation_data.action for o in bpy.context.scene.objects)


def select_only(objs: list) -> None:
    bpy.ops.object.select_all(action="DESELECT")
    for o in objs:
        o.select_set(True)
    if objs:
        bpy.context.view_layer.objects.active = objs[0]


def apply_transforms(objs: list) -> None:
    for o in objs:  # make data single-user so transforms can be applied
        if o.data.users > 1:
            o.data = o.data.copy()
    select_only(objs)
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def flatten_hierarchy(objs: list) -> int:
    """Detach meshes keeping their world transform, then delete leftover non-mesh objects. Returns removed count."""
    for o in objs:
        world = o.matrix_world.copy()
        o.parent = None
        o.matrix_world = world
    leftovers = [o for o in bpy.context.scene.objects if o.type != "MESH"]
    for o in leftovers:
        bpy.data.objects.remove(o, do_unlink=True)
    return len(leftovers)


def world_bounds(objs: list) -> tuple:
    pts = [o.matrix_world @ Vector(c) for o in objs for c in o.bound_box]
    return ([min(p[i] for p in pts) for i in range(3)], [max(p[i] for p in pts) for i in range(3)])


def triangle_count(objs: list) -> int:
    total = 0
    for o in objs:
        o.data.calc_loop_triangles()
        total += len(o.data.loop_triangles)
    return total


def vertex_count(objs: list) -> int:
    return sum(len(o.data.vertices) for o in objs)


def principled_node(material: Any) -> Any:
    if not getattr(material, "use_nodes", False) or material.node_tree is None:
        return None
    return next((n for n in material.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)


def verify_materials(objs: list, warnings: List[str]) -> Dict[str, Any]:
    fixes: List[str] = []
    fallback = None
    for o in objs:
        if not o.data.materials:
            if fallback is None:
                fallback = bpy.data.materials.new("Fallback_Material")
                fallback.use_nodes = True
                node = principled_node(fallback)
                if node is not None:
                    node.inputs["Base Color"].default_value = (0.8, 0.8, 0.8, 1.0)
                    node.inputs["Roughness"].default_value = 0.6
            o.data.materials.append(fallback)
            fixes.append(f"{o.name}: no material, assigned plain PBR fallback")
    report: List[Dict[str, Any]] = []
    for mat in {m for o in objs for m in o.data.materials if m is not None}:
        node = principled_node(mat)
        texture = None
        if node is not None:
            link = node.inputs["Base Color"].links
            if link and link[0].from_node.type == "TEX_IMAGE" and link[0].from_node.image:
                texture = link[0].from_node.image.name
        if node is None:
            warnings.append(f"material '{mat.name}' has no Principled BSDF; the glTF exporter may drop its look")
        elif texture is None and tuple(node.inputs["Base Color"].default_value)[:3] == (0.8, 0.8, 0.8) and not node.inputs["Base Color"].links:
            warnings.append(f"material '{mat.name}' has default grey base colour and no texture; check the result visually")
        report.append({"name": mat.name, "principled": node is not None, "base_color_texture": texture})
    images = [{"name": i.name, "width": int(i.size[0]), "height": int(i.size[1])}
              for i in bpy.data.images if i.users and i.size[0] and i.name != "Render Result"]
    return {"materials": report, "textures": images, "fixes": fixes}


def downscale_textures(max_side: int, warnings: List[str]) -> List[str]:
    done: List[str] = []
    if max_side <= 0:
        return done
    for img in bpy.data.images:
        w, h = int(img.size[0]), int(img.size[1])
        if not img.users or max(w, h) <= max_side or not w or not h:
            continue
        ratio = max_side / float(max(w, h))
        try:
            img.scale(max(1, int(round(w * ratio))), max(1, int(round(h * ratio))))
            img.update()
            done.append(f"{img.name}: {w}x{h} -> {int(img.size[0])}x{int(img.size[1])}")
        except Exception as exc:  # noqa: BLE001
            warnings.append(f"could not downscale texture '{img.name}': {exc}")
    return done


def decimate(objs: list, max_triangles: int, warnings: List[str]) -> Optional[str]:
    if max_triangles <= 0:
        return None
    before = triangle_count(objs)
    if before <= max_triangles:
        return None
    ratio = max_triangles / float(before)
    for o in objs:
        select_only([o])
        mod = o.modifiers.new("Decimate_auto", "DECIMATE")
        mod.ratio = ratio
        bpy.ops.object.modifier_apply(modifier=mod.name)
    warnings.append("decimation applied: inspect UV seams and silhouette before shipping")
    return f"{before} -> {triangle_count(objs)} triangles (ratio {ratio:.3f})"


def export_glb(path: str, draco: bool, texture_format: str, jpeg_quality: int) -> Dict[str, Any]:
    wanted = {
        "filepath": path, "export_format": "GLB", "use_selection": False, "export_apply": True,
        "export_cameras": False, "export_lights": False, "export_yup": True, "export_materials": "EXPORT",
        "export_normals": True, "export_texcoords": True, "export_extras": False,
        "export_image_format": {"auto": "AUTO", "jpeg": "JPEG", "webp": "WEBP", "png": "AUTO"}[texture_format],
        "export_jpeg_quality": jpeg_quality, "export_draco_mesh_compression_enable": draco,
    }
    known = set(bpy.ops.export_scene.gltf.get_rna_type().properties.keys())
    kwargs = {k: v for k, v in wanted.items() if k in known}
    dropped = sorted(set(wanted) - set(kwargs))
    note = None
    try:
        bpy.ops.export_scene.gltf(**kwargs)
    except (TypeError, RuntimeError) as exc:
        if kwargs.get("export_image_format") in (None, "AUTO"):
            raise
        kwargs["export_image_format"] = "AUTO"
        note = f"image format '{texture_format}' rejected by this Blender ({exc}); exported with AUTO"
        bpy.ops.export_scene.gltf(**kwargs)
    return {"dropped_export_options": dropped, "note": note}


def snapshot(objs: list) -> Dict[str, Any]:
    lo, hi = world_bounds(objs) if objs else ([0, 0, 0], [0, 0, 0])
    return {"objects": len(objs), "triangles": triangle_count(objs), "vertices": vertex_count(objs),
            "bbox_size": [round(hi[i] - lo[i], 6) for i in range(3)]}


def process(args: argparse.Namespace) -> Dict[str, Any]:
    _require_bpy()
    validate_args(args)
    if not os.path.isfile(args.input):
        raise FileNotFoundError(f"input not found: {os.path.basename(args.input)}")
    warnings: List[str] = []
    steps: List[str] = []
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=args.input)
    objs = mesh_objects()
    if not objs:
        raise RuntimeError("the GLB contains no mesh objects")
    before = snapshot(objs)
    result: Dict[str, Any] = {"ok": True, "blender": bpy.app.version_string, "input_bytes": os.path.getsize(args.input),
                              "before": before, "pivot": args.pivot, "target_size": args.target_size}
    if is_animated():
        warnings.append("animated/skinned asset: hierarchy, pivot and scale were left as imported")
        steps.append("skipped restructuring (animated)")
        result["scale"] = 1.0
    else:
        removed = flatten_hierarchy(objs)
        steps.append(f"flattened hierarchy ({removed} non-mesh objects removed)")
        objs = mesh_objects()
        apply_transforms(objs)
        lo, hi = world_bounds(objs)
        fit = compute_fit(lo, hi, args.target_size, args.pivot)
        if fit["degenerate"]:
            warnings.append("mesh has zero size; scale left at 1")
        for o in objs:
            o.location = Vector(fit["translation"]) * fit["scale"]
            o.scale = (fit["scale"],) * 3
        apply_transforms(objs)
        result["scale"] = fit["scale"]
        steps.append(f"pivot={args.pivot}, uniform scale {fit['scale']:.6f}")
    decimated = decimate(objs, args.max_triangles, warnings)
    if decimated:
        steps.append("decimate " + decimated)
    mats = verify_materials(objs, warnings)
    result["materials"] = mats
    for line in downscale_textures(args.texture_max_size, warnings):
        steps.append("texture " + line)
    out_dir = os.path.dirname(os.path.abspath(args.output))
    os.makedirs(out_dir, exist_ok=True)
    export = export_glb(args.output, args.draco, args.texture_format, args.jpeg_quality)
    if export["note"]:
        warnings.append(export["note"])
    if not os.path.isfile(args.output) or os.path.getsize(args.output) == 0:
        raise RuntimeError("export produced no file")
    result.update({"after": snapshot(mesh_objects()), "output_bytes": os.path.getsize(args.output),
                   "dropped_export_options": export["dropped_export_options"], "steps": steps, "warnings": warnings})
    return result


def main(argv: Optional[Sequence[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv_after_double_dash(sys.argv) if argv is None else list(argv))
    report_path = args.report or (args.output + ".report.json")
    try:
        result = process(args)
        code = 0
    except Exception as exc:  # noqa: BLE001 - reported in the result line, exit code carries the failure
        result = {"ok": False, "error": f"{type(exc).__name__}: {exc}"}
        code = 1
    try:
        with open(report_path, "w", encoding="utf-8") as fh:
            json.dump(result, fh, indent=2)
    except OSError:
        pass
    print(f"{RESULT_PREFIX} {json.dumps(result)}")
    return code


if __name__ == "__main__":
    sys.exit(main())

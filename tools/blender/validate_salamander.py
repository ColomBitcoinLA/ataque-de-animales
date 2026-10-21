"""Validate the saved salamander and its GLB preview (Blender Python).

Run from any directory, AFTER generating both assets:
    blender --background --python-exit-code 1 --python tools/blender/validate_salamander.py

Writes docs/r1b/validation.json, including failures, then raises if invalid.
This is a destructive scene-loading script; run in a separate Blender process.
No assets are modified. Self-intersections and manual retopology are not certified.
"""

import json
import math
from pathlib import Path
import struct
import traceback

import bmesh
import bpy


ROOT = Path(__file__).resolve().parents[2]
BLEND = ROOT / "assets/characters/salamander/salamander.blend"
GLB = ROOT / "assets/characters/salamander/salamander-preview.glb"
REPORT = ROOT / "docs/r1b/validation.json"
BOUNDS_ABS_TOL = 1e-5
BOUNDS_REL_TOL = 1e-5
AREA_EPSILON = 1e-12  # world-space square Blender units

report = {
    "schema_version": 1,
    "valid": False,
    "blender_version": bpy.app.version_string,
    "inputs": {"blend": BLEND.relative_to(ROOT).as_posix(),
               "glb": GLB.relative_to(ROOT).as_posix()},
    "tolerances": {"bounds_absolute": BOUNDS_ABS_TOL,
                   "bounds_relative": BOUNDS_REL_TOL,
                   "zero_area_world": AREA_EPSILON},
    "limitations": {
        "self_intersection": "NOT CHECKED: automatic self-intersection detection is not performed.",
        "manual_retopology": "PENDING: manual retopology review remains required.",
        "scope": "Static base meshes; modifiers are rejected rather than silently ignored.",
    },
    "checks": [],
    "errors": [],
}


def check(name, passed, detail=None):
    item = {"name": name, "passed": bool(passed)}
    if detail is not None:
        item["detail"] = detail
    report["checks"].append(item)
    if not passed:
        report["errors"].append(name)


def finite(values):
    return all(isinstance(v, (int, float)) and not isinstance(v, bool)
               and math.isfinite(v) for v in values)


def has_animation(block):
    data = getattr(block, "animation_data", None)
    return bool(data and (data.action or data.drivers or data.nla_tracks))


def inspect_meshes(objects, label):
    objects = list(objects)
    meshes = sorted((o for o in objects if o.type == "MESH"), key=lambda o: o.name)
    check(label + ".meshes_present", bool(meshes))
    check(label + ".no_armatures", not bpy.data.armatures
          and not any(o.type == "ARMATURE" for o in bpy.data.objects))
    check(label + ".no_actions", len(bpy.data.actions) == 0)
    blocks = list(bpy.data.objects) + list(bpy.data.meshes) + list(bpy.data.shape_keys)
    blocks += list(bpy.data.materials) + list(bpy.data.scenes)
    blocks += [m.node_tree for m in bpy.data.materials if m.node_tree]
    check(label + ".no_animation", not any(has_animation(b) for b in blocks))
    result = {"objects": [], "vertices": 0, "faces": 0, "triangles": 0,
              "material_count": 0, "bounds_world": None}
    used_materials = set()
    lo, hi = [float("inf")] * 3, [-float("inf")] * 3
    all_finite = True
    for obj in meshes:
        mesh = obj.data
        check(label + "." + obj.name + ".no_modifiers", not obj.modifiers)
        check(label + "." + obj.name + ".no_shape_keys", mesh.shape_keys is None)
        coordinates = [tuple(obj.matrix_world @ vertex.co) for vertex in mesh.vertices]
        coords_finite = all(finite(p) for p in coordinates)
        all_finite &= coords_finite
        for point in coordinates:
            if finite(point):
                for axis in range(3):
                    lo[axis] = min(lo[axis], point[axis])
                    hi[axis] = max(hi[axis], point[axis])
        mesh.calc_loop_triangles()
        bm = bmesh.new()
        try:
            bm.from_mesh(mesh)
            bm.transform(obj.matrix_world)
            nonmanifold = sum(not edge.is_manifold for edge in bm.edges)
            # GLB splits vertices at normal/UV/material seams. Keep raw counts,
            # but test imported connectivity on a disposable position-welded copy.
            topology_nonmanifold = nonmanifold
            if label == "import":
                welded = bm.copy()
                try:
                    bmesh.ops.remove_doubles(welded, verts=list(welded.verts), dist=1e-6)
                    topology_nonmanifold = sum(not edge.is_manifold for edge in welded.edges)
                finally:
                    welded.free()
            areas = [face.calc_area() for face in bm.faces]
            zero_area = sum(not math.isfinite(a) or a <= AREA_EPSILON for a in areas)
        finally:
            bm.free()
        triangle_areas = []
        for triangle in mesh.loop_triangles:
            a, b, c = [obj.matrix_world @ mesh.vertices[i].co for i in triangle.vertices]
            triangle_areas.append((b - a).cross(c - a).length * 0.5)
        zero_triangles = sum(not math.isfinite(a) or a <= AREA_EPSILON for a in triangle_areas)
        materials = sorted({slot.material.name for slot in obj.material_slots if slot.material})
        used_materials.update(materials)
        item = {"name": obj.name, "mesh_name": mesh.name,
                "vertices": len(mesh.vertices), "faces": len(mesh.polygons),
                "triangles": len(mesh.loop_triangles), "materials": materials,
                "material_count": len(materials), "finite_coordinates": coords_finite,
                "nonmanifold_edges": nonmanifold,
                "topology_nonmanifold_edges": topology_nonmanifold,
                "topology_weld_distance": 1e-6 if label == "import" else 0,
                "zero_area_faces": zero_area,
                "zero_area_triangles": zero_triangles}
        result["objects"].append(item)
        for field in ("vertices", "faces", "triangles"):
            result[field] += item[field]
        prefix = label + "." + obj.name
        check(prefix + ".finite_coordinates", coords_finite)
        check(prefix + ".nonempty", bool(mesh.vertices) and bool(mesh.polygons))
        check(prefix + ".manifold", topology_nonmanifold == 0, topology_nonmanifold)
        check(prefix + ".nondegenerate_faces", zero_area == 0, zero_area)
        check(prefix + ".nondegenerate_triangles", zero_triangles == 0, zero_triangles)
        check(prefix + ".materials_present", bool(materials))
    result["material_count"] = len(used_materials)
    if all_finite and finite(lo + hi):
        result["bounds_world"] = {"min": lo, "max": hi}
    check(label + ".finite_bounds", result["bounds_world"] is not None)
    return result


def inspect_glb(expected_names):
    raw = GLB.read_bytes()
    if len(raw) < 20:
        raise ValueError("GLB is shorter than its header and JSON chunk header")
    magic, version, length = struct.unpack_from("<4sII", raw)
    check("glb.header", magic == b"glTF" and version == 2 and length == len(raw))
    chunks = []
    cursor = 12
    while cursor < len(raw):
        if cursor + 8 > len(raw):
            raise ValueError("Truncated GLB chunk header")
        size, kind = struct.unpack_from("<II", raw, cursor)
        cursor += 8
        if size % 4 or cursor + size > len(raw):
            raise ValueError("Unaligned or truncated GLB chunk")
        chunks.append((kind, raw[cursor:cursor + size]))
        cursor += size
    if not chunks or chunks[0][0] != 0x4E4F534A:
        raise ValueError("GLB first chunk must be JSON")
    check("glb.chunk_layout", [c[0] for c in chunks] == [0x4E4F534A, 0x004E4942])
    doc = json.loads(chunks[0][1].decode("utf-8"),
                     parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))
    binary = next((data for kind, data in chunks if kind == 0x004E4942), b"")
    nodes = doc.get("nodes", [])
    check("glb.no_cameras", not doc.get("cameras") and all("camera" not in n for n in nodes))
    check("glb.no_animations", not doc.get("animations"))
    check("glb.no_armatures", not doc.get("skins") and all("skin" not in n for n in nodes))

    def inspect_json(value):
        if isinstance(value, dict):
            for key, child in value.items():
                if key == "uri":
                    raise ValueError("GLB must be self-contained: URI is forbidden")
                if key == "KHR_lights_punctual":
                    raise ValueError("GLB contains lights")
                inspect_json(child)
        elif isinstance(value, list):
            for child in value:
                inspect_json(child)
        elif isinstance(value, float) and not math.isfinite(value):
            raise ValueError("GLB JSON contains nonfinite numbers")
    inspect_json(doc)
    check("glb.no_lights", "KHR_lights_punctual" not in doc.get("extensionsUsed", [])
          and "KHR_lights_punctual" not in doc.get("extensionsRequired", []))
    names = [n.get("name", "") for n in nodes if "mesh" in n]
    check("glb.mesh_node_names", sorted(names) == sorted(expected_names), names)
    check("glb.mesh_names", all(m.get("name") for m in doc.get("meshes", [])))
    buffers = doc.get("buffers", [])
    check("glb.one_embedded_buffer", len(buffers) == 1)
    if len(buffers) != 1:
        raise ValueError("Expected one embedded GLB buffer")
    declared = buffers[0].get("byteLength", -1)
    check("glb.buffer_length", isinstance(declared, int) and 0 <= declared <= len(binary)
          and len(binary) - declared <= 3)
    views = doc.get("bufferViews", [])
    for i, view in enumerate(views):
        offset, size = view.get("byteOffset", 0), view.get("byteLength", -1)
        check("glb.buffer_view_%d.range" % i, view.get("buffer") == 0
              and offset >= 0 and size >= 0 and offset + size <= declared)
    components = {5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4}
    dimensions = {"SCALAR": (1, 1), "VEC2": (1, 2), "VEC3": (1, 3), "VEC4": (1, 4),
                  "MAT2": (2, 2), "MAT3": (3, 3), "MAT4": (4, 4)}
    accessors = doc.get("accessors", [])
    for i, accessor in enumerate(accessors):
        prefix = "glb.accessor_%d" % i
        cols, rows = dimensions[accessor["type"]]
        component_size = components[accessor["componentType"]]
        column_size = rows * component_size
        element_size = cols * (((column_size + 3) // 4) * 4 if cols > 1 else column_size)
        for bound in ("min", "max"):
            if bound in accessor:
                check(prefix + "." + bound, len(accessor[bound]) == cols * rows
                      and finite(accessor[bound]))
        if "min" in accessor and "max" in accessor:
            check(prefix + ".ordered_bounds", all(a <= b for a, b in zip(accessor["min"], accessor["max"])))
        count = accessor.get("count", 0)
        check(prefix + ".positive_count", isinstance(count, int) and count > 0)
        # Static Blender exports should not require sparse/implicit accessors.
        check(prefix + ".dense_storage", "sparse" not in accessor and "bufferView" in accessor)
        if "bufferView" in accessor:
            view = views[accessor["bufferView"]]
            stride = view.get("byteStride", element_size)
            offset = accessor.get("byteOffset", 0)
            required = offset + max(0, count - 1) * stride + element_size
            check(prefix + ".buffer_range", offset >= 0 and stride >= element_size
                  and required <= view["byteLength"])
    triangles = 0
    for node in nodes:
        if "mesh" not in node:
            continue
        for primitive in doc["meshes"][node["mesh"]]["primitives"]:
            check("glb.triangle_primitive", primitive.get("mode", 4) == 4)
            position = accessors[primitive["attributes"]["POSITION"]]
            check("glb.position_bounds", "min" in position and "max" in position
                  and position["type"] == "VEC3")
            count = accessors[primitive["indices"]]["count"] if "indices" in primitive else position["count"]
            check("glb.triangle_count_divisible", count % 3 == 0)
            triangles += count // 3
    return {"file_bytes": len(raw), "binary_bytes": len(binary),
            "declared_buffer_bytes": declared, "node_names": names,
            "mesh_count": len(doc.get("meshes", [])), "material_count": len(doc.get("materials", [])),
            "accessor_count": len(accessors), "triangles": triangles}


def main():
    try:
        bpy.ops.wm.open_mainfile(filepath=str(BLEND))
        collection = bpy.data.collections.get("SALAMANDER")
        check("blend.SALAMANDER_collection", collection is not None)
        if collection is None:
            raise ValueError("Missing SALAMANDER collection")
        source = inspect_meshes(collection.all_objects, "blend")
        report["blend"] = source
        expected_names = [obj["name"] for obj in source["objects"]]
        report["glb_json"] = inspect_glb(expected_names)
        bpy.ops.wm.read_factory_settings(use_empty=True)
        bpy.ops.import_scene.gltf(filepath=str(GLB))
        check("import.no_cameras_lights", not any(o.type in {"CAMERA", "LIGHT"} for o in bpy.data.objects))
        imported = inspect_meshes(bpy.context.scene.objects, "import")
        report["import"] = imported
        # Both bounds are measured in Blender world coordinates: the glTF importer
        # reverses the exporter's Y-up conversion. Never compare raw glTF XYZ here.
        a, b = source["bounds_world"], imported["bounds_world"]
        same_bounds = bool(a and b) and all(
            math.isclose(x, y, rel_tol=BOUNDS_REL_TOL, abs_tol=BOUNDS_ABS_TOL)
            for bound in ("min", "max") for x, y in zip(a[bound], b[bound]))
        check("comparison.world_bounds", same_bounds)
        check("comparison.triangles", source["triangles"] == imported["triangles"]
              == report["glb_json"]["triangles"])
        check("comparison.object_names", sorted(expected_names)
              == sorted(o["name"] for o in imported["objects"]))
    except Exception as exc:
        report["errors"].append(type(exc).__name__ + ": " + str(exc))
        report["exception_traceback"] = traceback.format_exc()
    report["valid"] = not report["errors"]
    REPORT.parent.mkdir(parents=True, exist_ok=True)
    REPORT.write_text(json.dumps(report, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    print("Salamander validation: %s; report: %s" % ("PASS" if report["valid"] else "FAIL", REPORT))
    if not report["valid"]:
        raise RuntimeError("Salamander validation failed: " + "; ".join(report["errors"]))


if __name__ == "__main__":
    main()

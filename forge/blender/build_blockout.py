"""Animal Forge technical blockout renderer (Blender 5.x, headless).

Reads a deterministic blockout.json and produces a technical studio preview.
This is a verification blockout, not a final character asset.
"""
import json
import math
import os
import sys

import bpy
from mathutils import Vector

argv = sys.argv
argv = argv[argv.index("--") + 1:] if "--" in argv else []
args = {"--input": None, "--out": None}
for i, token in enumerate(argv):
    if token in args and i + 1 < len(argv):
        args[token] = argv[i + 1]
if not args["--input"] or not args["--out"]:
    raise SystemExit("usage: blender --background --python build_blockout.py -- --input blockout.json --out DIR")


def srgb_to_linear(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_rgba(hex_color, alpha=1.0):
    hex_color = hex_color.lstrip("#")
    return (srgb_to_linear(int(hex_color[0:2], 16)),
            srgb_to_linear(int(hex_color[2:4], 16)),
            srgb_to_linear(int(hex_color[4:6], 16)), alpha)


def to_blender(p):
    # Data: X right, Y up, Z forward. Blender: X right, Y forward (negated), Z up.
    return Vector((p[0], -p[2], p[1]))


def material(name, color_hex, roughness=0.8, emission=0.0):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    mat = bpy.data.materials.new(name)
    mat.use_nodes = True
    rgba = hex_rgba(color_hex)
    bsdf = mat.node_tree.nodes.get("Principled BSDF")
    bsdf.inputs["Base Color"].default_value = rgba
    bsdf.inputs["Roughness"].default_value = roughness
    if "Metallic" in bsdf.inputs:
        bsdf.inputs["Metallic"].default_value = 0.0
    if emission > 0:
        bsdf.inputs["Emission Color"].default_value = rgba
        bsdf.inputs["Emission Strength"].default_value = emission
    mat.diffuse_color = rgba
    return mat


def add_sphere(name, center, radii, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=16, radius=1.0, location=to_blender(center))
    obj = bpy.context.object
    obj.name = name
    obj.scale = (radii[0], radii[2], radii[1])  # Blender X, Y, Z <- data X, Z, Y
    obj.data.materials.append(mat)
    return obj


def add_capsule(name, p1, p2, radius, mat, vertices=16):
    a, b = to_blender(p1), to_blender(p2)
    direction = b - a
    length = direction.length
    if length <= 1e-6:
        return None
    mid = (a + b) / 2
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=length, location=mid)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    obj.data.materials.append(mat)
    return obj


def add_cone(name, base, tip, radius, mat, vertices=16):
    a, b = to_blender(base), to_blender(tip)
    direction = b - a
    length = direction.length
    if length <= 1e-6:
        return None
    mid = (a + b) / 2
    bpy.ops.mesh.primitive_cone_add(vertices=vertices, radius1=radius, radius2=0.0, depth=length, location=mid)
    obj = bpy.context.object
    obj.name = name
    obj.rotation_mode = "QUATERNION"
    obj.rotation_quaternion = Vector((0, 0, 1)).rotation_difference(direction.normalized())
    obj.data.materials.append(mat)
    return obj


with open(args["--input"], "r", encoding="utf-8") as handle:
    spec = json.load(handle)

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.unit_settings.system = "METRIC"

# Materials by colour: a small deterministic cache.
materials = {}


def mat_for(color_hex, emission=0.0):
    key = (color_hex, emission)
    if key not in materials:
        materials[key] = material(f"AF_{color_hex.lstrip('#')}_{emission}", color_hex, 0.8, emission)
    return materials[key]


for primitive in spec["primitives"]:
    add_sphere(primitive["id"], primitive["center"], primitive["radii"], mat_for(primitive["color"]))

for segment in spec["segments"]:
    add_capsule(segment["id"], segment["from"], segment["to"], (segment["r1"] + segment["r2"]) / 2, mat_for(segment["color"]))

tail = spec["tail"]
for i in range(len(tail["points"]) - 1):
    add_capsule(f'{tail["id"]}.{i + 1}', tail["points"][i], tail["points"][i + 1],
                (tail["radii"][i] + tail["radii"][i + 1]) / 2, mat_for(tail["color"]))
for i, point in enumerate(tail["points"]):
    add_sphere(f'{tail["id"]}.joint.{i + 1}', point, [tail["radii"][i]] * 3, mat_for(tail["color"]))

for flame in spec["flames"]:
    tip = [flame["base"][0], flame["base"][1] + flame["height"], flame["base"][2] + flame.get("leanZ", 0)]
    add_cone(flame["id"], flame["base"], tip, flame["halfWidthZ"], mat_for(flame["color"], 1.0))

# Ground, camera, lights, world.
bpy.ops.mesh.primitive_plane_add(size=12, location=(0, 0, 0))
ground = bpy.context.object
ground.name = "ground"
ground.data.materials.append(material("AF_ground", "#6E6A63", 0.95))

bpy.ops.object.camera_add(location=(2.8, -3.8, 1.8))
camera = bpy.context.object
camera.name = "camera"
target = Vector((0, 0, 0.55))
direction = target - camera.location
camera.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
camera.data.lens = 60
scene.camera = camera

bpy.ops.object.light_add(type="AREA", location=(3.0, -4.0, 4.0))
key = bpy.context.object
key.name = "key"
key.data.energy = 900
key.data.size = 5
key.rotation_euler = (math.radians(35), 0, math.radians(35))

bpy.ops.object.light_add(type="AREA", location=(-3.0, -2.0, 2.0))
fill = bpy.context.object
fill.name = "fill"
fill.data.energy = 300
fill.data.size = 6

world = bpy.data.worlds.new("AF_world")
world.use_nodes = True
world.node_tree.nodes["Background"].inputs[0].default_value = (0.20, 0.21, 0.22, 1.0)
world.node_tree.nodes["Background"].inputs[1].default_value = 0.6
scene.world = world

scene.render.engine = "BLENDER_WORKBENCH"
scene.display.shading.light = "STUDIO"
scene.display.shading.color_type = "MATERIAL"
scene.display.shading.show_shadows = True
scene.display.shading.show_cavity = True
scene.render.resolution_x = 1024
scene.render.resolution_y = 1024
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = "PNG"
scene.render.filepath = os.path.join(args["--out"], "studio-preview.png")

os.makedirs(args["--out"], exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(args["--out"], "blockout.blend"))
bpy.ops.export_scene.gltf(filepath=os.path.join(args["--out"], "blockout.glb"), export_format="GLB")
bpy.ops.render.render(write_still=True)
print("AF_BLOCKOUT_OK", spec["blockoutHash"])

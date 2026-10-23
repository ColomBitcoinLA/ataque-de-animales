"""Re-render V1 with V2's exact cameras, lights and world for an honest A/B. ISC.
Reads V1 assets; writes only new comparison images under docs/r1b/v2/. Saves nothing.
Run: blender --background --python-exit-code 1 --python tools/blender/render_v1_comparison.py
"""
import bpy, math, sys
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
BLEND = ROOT / 'assets/characters/salamander/salamander.blend'
DOC = ROOT / 'docs/r1b/v2'
DOC.mkdir(parents=True, exist_ok=True)
bpy.ops.wm.open_mainfile(filepath=str(BLEND))
scene = bpy.context.scene
keep = bpy.data.collections.get('SALAMANDER')
if keep is None:
    raise RuntimeError('V1 SALAMANDER collection missing')
for obj in bpy.data.objects:
    if obj.type in {'MESH', 'LIGHT', 'CAMERA'} and obj.name not in keep.objects:
        obj.hide_render = True
for obj in bpy.context.view_layer.objects:
    obj.hide_set(False)

world = bpy.data.worlds.new('AB world'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.055, .07, .095, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .30

floor_mat = bpy.data.materials.new('AB floor'); floor_mat.use_nodes = True
p = floor_mat.node_tree.nodes['Principled BSDF']
p.inputs['Base Color'].default_value = (.018, .022, .030, 1)
p.inputs['Roughness'].default_value = .82
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.012))
ground = bpy.context.object; ground.name = 'AB_ground'; ground.data.materials.append(floor_mat)


def area(name, loc, power, size, color):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = power; data.shape = 'DISK'
    data.size = size; data.color = color
    o = bpy.data.objects.new(name, data); scene.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = (Vector((0, 0, .40)) - o.location).to_track_quat('-Z', 'Y').to_euler()


area('AB Key', (-2.2, -3.1, 3.2), 260, 3.2, (1, .90, .78))
area('AB Fill', (2.6, -1.0, 1.9), 165, 3.0, (.70, .82, 1))
area('AB Rim', (0, 2.9, 2.9), 300, 2.4, (1, .66, .38))

cam_data = bpy.data.cameras.new('AB camera')
camera = bpy.data.objects.new('AB camera', cam_data)
scene.collection.objects.link(camera); scene.camera = camera
cam_data.type = 'ORTHO'
scene.render.engine = 'CYCLES'; scene.cycles.samples = 40; scene.cycles.use_denoising = True
scene.render.resolution_x = 1200; scene.render.resolution_y = 1000
scene.render.image_settings.file_format = 'PNG'
scene.view_settings.view_transform = 'AgX'
scene.render.threads_mode = 'FIXED'; scene.render.threads = 6

VIEWS = {
    'front': ((0, -4, .50), (0, 0, .48), 1.72),
    'side': ((4, .04, .50), (0, .04, .48), 2.36),
    'back': ((0, 4, .50), (0, 0, .48), 1.86),
    'three-quarter': ((2.55, -3.30, 1.55), (0, .03, .46), 2.21),
}
for name, (loc, target, scale) in VIEWS.items():
    camera.location = loc
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    cam_data.ortho_scale = scale
    scene.render.filepath = str(DOC / ('v1-comparison-' + name + '.png'))
    bpy.ops.render.render(write_still=True)
    print('AB rendered', name)
print('V1 comparison renders complete (V1 .blend not saved).')

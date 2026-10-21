"""Re-render the R1-A-distance view from the saved V2 blend (no rebuild). ISC.
Run: blender --background --python-exit-code 1 --python tools/blender/render_v2_gameplay_view.py
"""
import bpy, math
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(ROOT / 'assets/characters/salamander/v2/salamander-v2.blend'))
scene = bpy.context.scene
camera = bpy.data.objects['V2 review camera']
cam_data = camera.data
scene.camera = camera
cam_data.type = 'PERSP'
cam_data.sensor_fit = 'VERTICAL'; cam_data.sensor_height = 24
cam_data.lens = 24 / (2 * math.tan(math.radians(55) / 2))
pitch = math.radians(22); dist = 6.4
tx, ty, tz = 0.0, 0.0, .46
camera.location = (tx, ty + dist * math.cos(pitch), tz + .90 + dist * math.sin(pitch))
camera.rotation_euler = (Vector((tx, ty, tz)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.engine = 'CYCLES'; scene.cycles.samples = 40; scene.cycles.use_denoising = True
scene.render.resolution_x = 1200; scene.render.resolution_y = 1000
scene.view_settings.view_transform = 'AgX'
scene.render.filepath = str(ROOT / 'docs/r1b/v2/salamander-rear-gameplay-distance.png')
bpy.ops.render.render(write_still=True)
print('Gameplay-distance view re-rendered at 6.4 m / 55 deg vertical FOV.')

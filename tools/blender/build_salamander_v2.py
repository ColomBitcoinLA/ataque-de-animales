"""Salamander V2 — original static art-review rebuild. ISC. Blender 5.2.2 LTS.
Run: blender --background --python-exit-code 1 --python tools/blender/build_salamander_v2.py -- [--clay] [--no-render]
V1 files are never written here. No rig, no animation, no game integration.
"""
import bpy, bmesh, math, json, time, sys
from pathlib import Path
from mathutils import Vector, Matrix
import numpy as np

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/characters/salamander/v2'
DOC = ROOT / 'docs/r1b/v2'
OUT.mkdir(parents=True, exist_ok=True); DOC.mkdir(parents=True, exist_ok=True)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
CLAY = '--clay' in ARGS
NO_RENDER = '--no-render' in ARGS
START = time.perf_counter()
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.filepaths.save_version = 0
scene = bpy.context.scene
scene.unit_settings.system = 'METRIC'; scene.unit_settings.scale_length = 1
model = bpy.data.collections.new('SALAMANDER')
scene.collection.children.link(model)
sources = bpy.data.collections.new('CONSTRUCTION_SOURCE'); scene.collection.children.link(sources)
studio = bpy.data.collections.new('STUDIO_NOT_EXPORTED'); scene.collection.children.link(studio)


def mat(name, color, rough=.7, emission=None, strength=0.0, vertex=False):
    m = bpy.data.materials.new(name); m.use_nodes = True
    p = m.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = rough
    if emission:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = strength
    if vertex:
        v = m.node_tree.nodes.new('ShaderNodeVertexColor'); v.layer_name = 'Color'
        m.node_tree.links.new(v.outputs['Color'], p.inputs['Base Color'])
    m.diffuse_color = (*color, 1)
    return m


M = {
    'skin': mat('01 Basalto vivo', (.028, .026, .026), .8),
    'lava': mat('02 Magma', (.95, .16, .012), .55, (.95, .10, .004), .5),
    'belly': mat('03 Vientre igneo', (.30, .18, .10), .72),
    'ridge': mat('04 Placas dorsales', (.045, .038, .032), .62),
    'lid': mat('05 Parpados', (.022, .019, .017), .42),
    'mouth': mat('06 Boca obsidiana', (.006, .006, .007), .3),
    'iris': mat('07 Iris ambar', (.95, .30, .02), .18, (.7, .10, .002), .08, True),
    'pupil': mat('08 Pupila', (.004, .005, .006), .14),
    'glint': mat('09 Brillo', (1, .93, .78), .1),
    'claw': mat('10 Garras', (.34, .22, .11), .38),
    'fire': mat('11 Fuego - manto', (.85, .045, .001), .45, (.9, .04, .001), .10, True),
    'core': mat('12 Fuego - nucleo', (1, .40, .012), .4, (1, .22, .004), .45, True),
    'ash': mat('13 Ceniza dorsal', (.06, .05, .042), .85),
}


def put(obj, coll=model):
    for c in list(obj.users_collection):
        c.objects.unlink(obj)
    coll.objects.link(obj)
    return obj


def obj_from(name, verts, faces, material, coll=model, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces); me.update()
    o = bpy.data.objects.new(name, me); coll.objects.link(o)
    if material:
        me.materials.append(material)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(me); bm.free()
    if smooth:
        for p in me.polygons:
            p.use_smooth = True
    return o


def select_only(o):
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.context.view_layer.objects.active = o


def apply_mod(o, mod):
    select_only(o); bpy.ops.object.modifier_apply(modifier=mod.name)


def catmull(pts, samples=5):
    a = [Vector(p) for p in pts]; out = []
    for i in range(len(a) - 1):
        p0 = a[max(0, i - 1)]; p1 = a[i]; p2 = a[i + 1]; p3 = a[min(len(a) - 1, i + 2)]
        for k in range(samples):
            t = k / samples
            out.append(.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t
                             + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    out.append(a[-1].copy())
    return out


def frames(points):
    """Parallel-transport frames; avoids the reference flip of a naive tangent frame."""
    tangents = []
    for i in range(len(points)):
        t = (points[min(i + 1, len(points) - 1)] - points[max(0, i - 1)])
        tangents.append(t.normalized() if t.length > 1e-9 else Vector((0, 0, 1)))
    ref = Vector((1, 0, 0))
    if abs(tangents[0].dot(ref)) > .9:
        ref = Vector((0, 1, 0))
    u = (ref - tangents[0] * ref.dot(tangents[0])).normalized()
    result = []
    for i, t in enumerate(tangents):
        if i:
            prev = tangents[i - 1]
            axis = prev.cross(t)
            if axis.length > 1e-8:
                angle = math.atan2(axis.length, prev.dot(t))
                u = (Matrix.Rotation(angle, 3, axis.normalized()) @ u)
            u = (u - t * u.dot(t)).normalized()
        result.append((u.copy(), t.cross(u).normalized()))
    return result


def tube(name, controls, sides=18, samples=5, material=None, twist=0.0):
    """Closed swept surface with per-section elliptical radii. controls: x,y,z,ra,rb"""
    pts = catmull([p[:3] for p in controls], samples)
    radii = catmull([[0, 0, 0, p[3], p[4]] for p in controls], samples)
    fr = frames(pts); verts = []; faces = []
    for i, p in enumerate(pts):
        u, v = fr[i]; ra, rb = radii[i][3], radii[i][4]
        for j in range(sides):
            a = 2 * math.pi * j / sides + twist * i
            verts.append(tuple(p + u * (ra * math.cos(a)) + v * (rb * math.sin(a))))
    for i in range(len(pts) - 1):
        for j in range(sides):
            a = i * sides + j; b = i * sides + (j + 1) % sides
            faces.append((a, b, b + sides, a + sides))
    endcap(name, verts, faces, len(pts), sides, pts, radii)
    return obj_from(name, verts, faces, material)


def endcap(name, verts, faces, rings, sides, pts, radii):
    for idx, rev in ((0, True), (rings - 1, False)):
        c = len(verts); verts.append(tuple(pts[idx]))
        for j in range(sides):
            f = (c, idx * sides + j, idx * sides + (j + 1) % sides)
            faces.append(f[::-1] if rev else f)


def loft(name, sections, n=44, material=None, profile=None):
    """Body loft with custom vertical sculpt. sections: y, halfwidth, center_z, halfheight."""
    rings = catmull(sections, 5); verts = []; faces = []
    for y, w, cz, h in rings:
        for j in range(n):
            a = 2 * math.pi * j / n
            x = w * math.cos(a); z = cz + h * math.sin(a)
            if profile:
                z = profile(y, x, z, a)
            verts.append((x, y, z))
    for i in range(len(rings) - 1):
        for j in range(n):
            a = i * n + j; b = i * n + (j + 1) % n
            faces.append((a, b, b + n, a + n))
    faces.append(tuple(range(n - 1, -1, -1)))
    faces.append(tuple((len(rings) - 1) * n + j for j in range(n)))
    return obj_from(name, verts, faces, material)


def ico(name, loc, scale, material, seg=32, rings=20, rot=None):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=seg, ring_count=rings, location=loc)
    o = put(bpy.context.object); o.name = name; o.scale = scale
    if rot:
        o.rotation_euler = Vector(rot).to_track_quat('Z', 'Y').to_euler()
    select_only(o); bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    if material:
        o.data.materials.append(material)
    for p in o.data.polygons:
        p.use_smooth = True
    return o


def bez2(p0, p1, p2, p3, n=5):
    pts = []
    for i in range(n):
        t = i / (n - 1)
        u = 1 - t
        pts.append((u**3*p0[0] + 3*u*u*t*p1[0] + 3*u*t*t*p2[0] + t**3*p3[0],
                    u**3*p0[1] + 3*u*u*t*p1[1] + 3*u*t*t*p2[1] + t**3*p3[1]))
    return pts


def flame_outline(width, height, lean=0.18):
    """Curved three-tongue fire silhouette in the (Y,Z) plane. Not a spike row."""
    w, h = width, height
    ctrl = [
        ((-.95*w, 0), (-1.10*w, .18*h), (-.95*w, .48*h), (-.60*w, .70*h)),
        ((-.60*w, .70*h), (-.52*w, .50*h), (-.38*w, .34*h), (-.28*w, .42*h)),
        ((-.28*w, .42*h), (-.18*w, .62*h), (-.04*w, .82*h), (.03*w, 1.00*h)),
        ((.03*w, 1.00*h), (.13*w, .74*h), (.21*w, .52*h), (.30*w, .40*h)),
        ((.30*w, .40*h), (.38*w, .55*h), (.48*w, .70*h), (.58*w, .84*h)),
        ((.58*w, .84*h), (.72*w, .56*h), (.88*w, .26*h), (.95*w, 0)),
    ]
    P = []
    for i, (a, b, c, d) in enumerate(ctrl):
        seg = bez2(a, b, c, d, 4)
        P.extend(seg if i == 0 else seg[1:])
    return [(y + lean * z, z) for (y, z) in P]


def flame_sheet(name, outline, thickness, material, yaw=0.0):
    """Closed fire blade built as two offset shells plus a rim (manifold by construction).
    Avoids solidify/bevel slivers at the sharp tips while keeping the authored silhouette."""
    n = len(outline)
    cx = sum(p[0] for p in outline) / n
    cz = sum(p[1] for p in outline) / n * .35
    h = thickness * .5
    front = [(h, y, z) for (y, z) in outline]
    back = [(-h, y, z) for (y, z) in outline]
    verts = front + back + [(h, cx, cz), (-h, cx, cz)]
    cf, cb = 2 * n, 2 * n + 1
    faces = []
    for i in range(n):
        j = (i + 1) % n
        faces.append((i, j, cf))
        faces.append((j + n, i + n, cb))
        faces.append((i, i + n, j + n, j))
    o = obj_from(name, verts, faces, material)
    o.rotation_euler.z = yaw
    bpy.context.view_layer.update()
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-6)
    bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-6)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
    bm.to_mesh(o.data); bm.free(); o.data.update()
    zs = [v.co.z for v in o.data.vertices]
    lo, hi = min(zs), max(zs)
    col = o.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
    for i, v in enumerate(o.data.vertices):
        t = (v.co.z - lo) / max(1e-5, hi - lo)
        col.data[i].color = (min(1, .52 + .48 * t), .012 + .36 * t ** 1.9, .001 + .02 * t ** 4, 1)
    return o


def crest_cluster(tag, y, base_z, height, width):
    """A fan of fire blades: side view shows the silhouette, front/rear show the mass.
    Two near-perpendicular blades give the crest depth from the chase camera."""
    blades = [(-.026, .70, .84, -.024, -0.58), (-.008, .96, 1.00, -.008, -0.26),
              (.006, 1.00, 1.00, .002, 0.06), (.024, .86, .92, .012, 0.34),
              (.040, .62, .76, .026, 0.60),
              (.004, .78, .70, -.010, 1.48), (-.012, .60, .62, .006, -1.52)]
    for i, (dy, hs, ws, cy, yaw) in enumerate(blades):
        o = flame_sheet(f'{tag}_blade_{i}', flame_outline(width * ws, height * hs),
                        .022 + .014 * ws, M['fire'], yaw)
        o.location = (0, y + dy + cy, base_z - .012)
    core = flame_sheet(tag + '_core', flame_outline(width * .50, height * .68, .12), .012,
                       M['core'], 0.12)
    core.location = (0, y - .018, base_z + .002)


# ---------------------------------------------------------------- body / head / legs
def body_profile(y, x, z, a):
    # Rounder cranium, soft brow shelf, tapered jaw and a lighter chest.
    if z > .50 and -0.80 < y < -0.30:
        z += .028 * max(0, math.cos((y + .55) * 7)) * (1 - abs(x) / .26) ** 2
    # Cheek/jowl mass gives the head a friendly silhouette.
    if -0.72 < y < -0.50 and abs(x) > .13 and z < .60:
        z += .012
    return z


body_sections = [
    (0.40, .070, .280, .070), (0.33, .165, .292, .130),
    (0.22, .205, .300, .158), (0.08, .220, .302, .168),
    (-0.06, .216, .318, .170), (-0.16, .200, .350, .165),
    (-0.26, .172, .400, .155), (-0.35, .172, .462, .162),
    (-0.44, .186, .508, .174), (-0.52, .194, .532, .180),
    (-0.60, .186, .532, .172), (-0.67, .160, .516, .140),
    (-0.735, .124, .497, .100), (-0.79, .086, .483, .062),
    (-0.838, .034, .477, .026),
]
body = loft('V2 torso head neck', body_sections, 48, M['skin'], profile=body_profile)
volumes = [body]

# Chunky, readable limbs: shoulder mass, elbow, wrist, planted foot.
for s in (-1, 1):
    for hind in (False, True):
        tag = ('Hind' if hind else 'Front') + ('_L' if s < 0 else '_R')
        if hind:
            path = [(s * .150, .205, .330, .120, .135), (s * .245, .258, .282, .118, .122),
                    (s * .300, .238, .175, .085, .088), (s * .298, .168, .086, .072, .070),
                    (s * .298, .128, .050, .100, .052)]
        else:
            path = [(s * .150, -.185, .336, .112, .128), (s * .250, -.222, .274, .112, .118),
                    (s * .310, -.272, .170, .082, .090), (s * .308, -.335, .080, .070, .070),
                    (s * .308, -.378, .048, .098, .050)]
        volumes.append(tube(tag + '_limb', path, 22, 5, M['skin']))
        foot_y = path[-1][1]
        for d in range(3):
            spread = (d - 1) * .064
            x = s * (.308 + spread * .82)
            tip = foot_y - .100 - (.024 if d == 1 else 0)
            toe = [(s * .308 + spread * .55, foot_y + .022, .050, .042, .036),
                   (x, foot_y - .032, .041, .038, .032),
                   (x + s * .006, tip, .032, .028, .025),
                   (x + s * .007, tip - .016, .029, .011, .012)]
            volumes.append(tube(tag + f'_toe_{d}', toe, 12, 4, M['skin']))
            tube(tag + f'_claw_{d}',
                 [(x + s * .007, tip - .004, .031, .022, .019),
                  (x + s * .010, tip - .028, .029, .017, .015),
                  (x + s * .013, tip - .054, .021, .001, .002)], 10, 3, M['claw'])
    # Limbs already carry shoulder/haunch volume from their own section radii.
    # Extra ellipsoid blobs were removed: they read as sacs on the silhouette.

# Tail: smooth S that lifts above the rump so it reads from the chase camera.
tail = [(0, .355, .300, .105, .095), (.012, .470, .300, .092, .082),
        (.040, .600, .320, .076, .068), (.062, .730, .360, .060, .054),
        (.070, .850, .420, .044, .040), (.058, .950, .487, .029, .027),
        (.040, 1.015, .545, .013, .014)]
volumes.append(tube('Tail S-curve', tail, 22, 6, M['skin']))

# Cheek and jaw masses go into the union so the head reads as one sculpted volume.
for s in (-1, 1):
    volumes.append(ico('Cheek_' + ('L' if s < 0 else 'R'), (s * .150, -.560, .500), (.042, .072, .052), None, 24, 14))
    volumes.append(ico('Jaw_' + ('L' if s < 0 else 'R'), (s * .072, -.716, .466), (.055, .088, .036), None, 24, 14))
volumes.append(ico('Chin', (0, -.758, .464), (.052, .068, .032), None, 24, 14))

# Hidden construction copies for technical review.
for o in volumes:
    c = o.copy(); c.data = o.data.copy(); sources.objects.link(c)
    c.name = 'SOURCE_' + o.name
sources.hide_render = True; sources.hide_viewport = True

select_only(body)
for o in volumes:
    o.select_set(True)
bpy.ops.object.join()
body.name = 'SalamanderV2_body'
mod = body.modifiers.new('Unify volumes', 'REMESH'); mod.mode = 'VOXEL'
mod.voxel_size = .0062; mod.use_smooth_shade = True
apply_mod(body, mod)
mod = body.modifiers.new('Sculpt relax', 'SMOOTH'); mod.factor = .8; mod.iterations = 8
apply_mod(body, mod)
for v in body.data.vertices:
    if v.co.z < .010:
        v.co.z = 0
# Budget-aware decimation: keep the body near 58k triangles, not an arbitrary ratio.
body.data.calc_loop_triangles()
tri_before = len(body.data.loop_triangles)
mod = body.modifiers.new('Review density', 'DECIMATE')
mod.ratio = min(1.0, 40000.0 / max(1, tri_before))
apply_mod(body, mod)
bm = bmesh.new(); bm.from_mesh(body.data)
bmesh.ops.triangulate(bm, faces=list(bm.faces))
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=1e-5)
bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=1e-5)
bmesh.ops.triangulate(bm, faces=list(bm.faces))
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
bm.to_mesh(body.data); bm.free(); body.data.update()

# ---------------------------------------------------------------- face
EYES = []
for s in (-1, 1):
    center = Vector((s * .086, -.658, .604))
    normal = Vector((s * .40, -.90, .16)).normalized()
    EYES.append((s, center, normal))
    cutter = ico('TEMP_socket', center, (.091, .086, .088), None, 40, 24)
    mod = body.modifiers.new('Eye socket', 'BOOLEAN'); mod.operation = 'DIFFERENCE'
    mod.object = cutter; mod.solver = 'EXACT'
    apply_mod(body, mod)
    bpy.data.objects.remove(cutter, do_unlink=True)


# Boolean sockets can leave sub-micron slivers: clean once more after cutting.
bm = bmesh.new(); bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm, verts=list(bm.verts), dist=2e-5)
bmesh.ops.dissolve_degenerate(bm, edges=list(bm.edges), dist=2e-5)
bmesh.ops.triangulate(bm, faces=[f for f in bm.faces if len(f.verts) > 3])
bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))
bm.to_mesh(body.data); bm.free(); body.data.update()


def head_surface(y, z, side, push=.002):
    """Ray-cast the real head surface so facial details sit flush, never floating."""
    hit, loc, nrm, _ = body.ray_cast(Vector((side * 1.2, y, z)), Vector((-side, 0, 0)))
    if not hit:
        return None, None
    return loc + nrm * push, nrm


# Eyeball inside a deep socket: only the front ~55 % is exposed.
for s, c, n in EYES:
    tag = 'L' if s < 0 else 'R'
    u = Vector((1, 0, 0)); u = (u - n * u.dot(n)).normalized(); v = n.cross(u).normalized()
    eye = ico('Eye_' + tag, c, (.084, .084, .084), M['iris'])
    col = eye.data.color_attributes.new(name='Color', type='FLOAT_COLOR', domain='POINT')
    for i, vert in enumerate(eye.data.vertices):
        d = max(0.0, min(1.0, vert.co.normalized().dot(n)))
        r = .82 - .50 * d
        col.data[i].color = (min(1, .98 * r + .02), max(.02, .30 * r), .006, 1)
    ico('Pupil_' + tag, c + n * .079, (.033, .044, .013), M['pupil'], 32, 20, n)
    ico('Glint_' + tag, c + n * .092 - u * .014 + v * .020, (.005, .005, .003), M['glint'], 20, 12, n)
    # One heavy upper lid crescent, no full goggle ring. Angled down toward the nose.
    aa = np.linspace(.10, math.pi - .10, 15)
    pts = []
    for a in aa:
        p = c + u * (.092 * math.cos(a)) + v * (.094 * math.sin(a)) + n * .020
        pts.append((p.x, p.y, p.z, .012, .009))
    tube('Upper_lid_' + tag, pts, 10, 3, M['lid'])
    # Brow shelf above the socket: outer end higher, inner end lower and closer.
    brow = []
    for t in np.linspace(0, 1, 10):
        ang = math.pi * (.86 - .22 * t)
        p = c + u * (.104 * math.cos(ang)) + v * (.128 * math.sin(ang)) + n * .006
        p.z += .014 * t
        brow.append((p.x, p.y, p.z, .015 + .006 * t, .017 + .008 * t))
    tube('Brow_' + tag, brow, 12, 3, M['lid'])

# Mouth seam follows the real muzzle surface; corners lift for a subtle smile.
for s in (-1, 1):
    seam = []; lip = []
    for t in np.linspace(0, 1, 9):
        y = -.805 + .125 * t
        z = .450 + .016 * t * t
        p, nrm = head_surface(y, z, s, .0008)
        if p is None:
            continue
        seam.append((p.x, p.y, p.z, .0034 + .0018 * t, .0026 + .0012 * t))
        q, _ = head_surface(y, z - .012, s, .0008)
        if q:
            lip.append((q.x, q.y, q.z, .007 + .003 * t, .0045 + .002 * t))
    tube('Mouth_' + ('L' if s < 0 else 'R'), seam, 8, 4, M['mouth'])
    tube('Lip_' + ('L' if s < 0 else 'R'), lip, 10, 3, M['ridge'])
    # Nostril sunk into the snout top, not a bead stuck on.
    hit, loc, nrm, _ = body.ray_cast(Vector((s * .044, -.795, 1)), Vector((0, 0, -1)))
    if hit:
        ico('Nostril_' + ('L' if s < 0 else 'R'), loc - nrm * .004,
            (.013, .009, .007), M['mouth'], 24, 14, nrm)

# ---------------------------------------------------------------- flame crest
# Volumetric fire: several lens-section tongues per cluster, read from every angle.
CREST = [('Crest_A', -0.370, .290, .150), ('Crest_B', -0.145, .430, .185),
         ('Crest_C', .095, .520, .200), ('Crest_D', .300, .350, .150)]
for name, y, height, width in CREST:
    hit, loc, _, _ = body.ray_cast(Vector((0, y, 2)), Vector((0, 0, -1)))
    base_z = (loc.z - .015) if hit else .46
    crest_cluster(name, y, base_z, height, width)
    ico(name + '_root', (0, y, base_z + .006), (width * .78, width * .62, .050), M['ridge'], 24, 14)

# Repeating dorsal flame blades along the spine, shrinking toward the tail.
for i in range(4):
    y = .400 + i * .120
    hit, loc, _, _ = body.ray_cast(Vector((.012, y, 2)), Vector((0, 0, -1)))
    z = (loc.z - .010) if hit else .30
    h = .100 - i * .012
    o = flame_sheet('Spine_' + str(i), flame_outline(.042 - i * .004, h, .22), .016, M['fire'],
                    yaw=(0.22 if i % 2 else -0.22))
    o.location = (.010, y, z - .012)

# Tail flame: compact fan at the lifted tip, clear from the rear camera.
for i, (dx, dy, hs, ws, yaw) in enumerate([(0, 0, 1.0, 1.0, 0.0), (-.014, .012, .78, .8, -.30),
                                           (.016, .008, .86, .82, .30)]):
    o = flame_sheet('Tail_flame_' + str(i), flame_outline(.055 * ws, .17 * hs, .16), .022, M['fire'], yaw)
    o.location = (dx + .040, .996 + dy, .540)
core = flame_sheet('Tail_flame_core', flame_outline(.028, .115, .12), .012, M['core'])
core.location = (.040, .982, .546)

# ---------------------------------------------------------------- textures
active_uv = bpy.context.view_layer
select_only(body)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(62), island_margin=.010)
bpy.ops.object.mode_set(mode='OBJECT')

bake_mat = bpy.data.materials.new('TEMP_V2_field'); bake_mat.use_nodes = True
body.data.materials.clear(); body.data.materials.append(bake_mat)
for p in body.data.polygons:
    p.material_index = 0
nodes = bake_mat.node_tree.nodes; links = bake_mat.node_tree.links; nodes.clear()
out = nodes.new('ShaderNodeOutputMaterial'); emit = nodes.new('ShaderNodeEmission')
links.new(emit.outputs[0], out.inputs['Surface'])
geo = nodes.new('ShaderNodeNewGeometry')


def noise(scale, detail=3.0, rough=.55):
    no = nodes.new('ShaderNodeTexNoise'); no.inputs['Scale'].default_value = scale
    no.inputs['Detail'].default_value = detail; no.inputs['Roughness'].default_value = rough
    links.new(geo.outputs['Position'], no.inputs['Vector'])
    return no


def voronoi(vec_socket, scale, feature='DISTANCE_TO_EDGE'):
    vo = nodes.new('ShaderNodeTexVoronoi'); vo.voronoi_dimensions = '3D'
    vo.feature = feature; vo.distance = 'EUCLIDEAN'
    vo.inputs['Scale'].default_value = scale
    links.new(vec_socket, vo.inputs['Vector'])
    return vo


def mathnode(op, a, b=None):
    """Returns the result socket (not the node) to keep call sites simple."""
    n = nodes.new('ShaderNodeMath'); n.operation = op
    if isinstance(a, float):
        n.inputs[0].default_value = a
    else:
        links.new(a, n.inputs[0])
    if b is not None:
        if isinstance(b, float):
            n.inputs[1].default_value = b
        else:
            links.new(b, n.inputs[1])
    return n.outputs[0]


def mix(a_socket=None, b_socket=None, fac=None, a=None, b=None, blend='MIX'):
    n = nodes.new('ShaderNodeMixRGB'); n.blend_type = blend
    if fac is not None:
        if isinstance(fac, float):
            n.inputs[0].default_value = fac
        else:
            links.new(fac, n.inputs[0])
    if a_socket:
        links.new(a_socket, n.inputs[1])
    elif a:
        n.inputs[1].default_value = (*a, 1)
    if b_socket:
        links.new(b_socket, n.inputs[2])
    elif b:
        n.inputs[2].default_value = (*b, 1)
    return n


# One coordinate field with two octaves of domain warp: organic, non-uniform cracks.
n1 = noise(9.0, 3, .6); n2 = noise(31.0, 2, .5)
warp = nodes.new('ShaderNodeVectorMath'); warp.operation = 'SCALE'
links.new(n1.outputs['Color'], warp.inputs[0]); warp.inputs[3].default_value = .055
add = nodes.new('ShaderNodeVectorMath'); add.operation = 'ADD'
links.new(geo.outputs['Position'], add.inputs[0]); links.new(warp.outputs[0], add.inputs[1])
warp2 = nodes.new('ShaderNodeVectorMath'); warp2.operation = 'SCALE'
links.new(n2.outputs['Color'], warp2.inputs[0]); warp2.inputs[3].default_value = .018
add2 = nodes.new('ShaderNodeVectorMath'); add2.operation = 'ADD'
links.new(add.outputs[0], add2.inputs[0]); links.new(warp2.outputs[0], add2.inputs[1])

# Large plates + medium cracks + fine hairlines with width modulated by noise.
fine_noise = noise(2.4, 2, .4)
v_large = voronoi(add2.outputs[0], 4.6)
v_mid = voronoi(add2.outputs[0], 10.5)
v_fine = voronoi(add2.outputs[0], 24.0)


def crack_mask(v, width_base, width_var=.012):
    width = mathnode('MULTIPLY_ADD', fine_noise.outputs['Fac'], width_var)
    width.node.inputs[2].default_value = width_base
    m = nodes.new('ShaderNodeMapRange')
    links.new(v.outputs['Distance'], m.inputs['Value'])
    links.new(width, m.inputs['From Min'])
    m.inputs['From Max'].default_value = .055
    m.inputs['To Min'].default_value = 1.0
    m.inputs['To Max'].default_value = 0.0
    return m.outputs['Result']


m_large = crack_mask(v_large, .010, .010)
m_mid = crack_mask(v_mid, .007, .006)
m_fine = crack_mask(v_fine, .0035, .002)
m_a = mathnode('MULTIPLY', m_large, m_mid)
m_all = mathnode('MAXIMUM', m_a, m_fine)# Cooler, non-glowing hairline fractures separate from the live magma.
m_hot = mathnode('MULTIPLY', m_large, m_mid)
m_hair = mathnode('SUBTRACT', m_fine, m_hot)
m_hair = mathnode('MAXIMUM', m_hair, 0.0)

# Ventral plates: warm belly only under the torso, feathered at the edge.
sep = nodes.new('ShaderNodeSeparateXYZ')
links.new(geo.outputs['Position'], sep.inputs[0])
belly_x = nodes.new('ShaderNodeMapRange')
links.new(sep.outputs['X'], belly_x.inputs['Value'])
belly_x.inputs['From Min'].default_value = .0
belly_x.inputs['From Max'].default_value = .14
belly_x.inputs['To Min'].default_value = 1.0
belly_x.inputs['To Max'].default_value = 0.0
belly_z = nodes.new('ShaderNodeMapRange')
links.new(sep.outputs['Z'], belly_z.inputs['Value'])
belly_z.inputs['From Min'].default_value = .075
belly_z.inputs['From Max'].default_value = .13
belly_z.inputs['To Min'].default_value = 0.0
belly_z.inputs['To Max'].default_value = 1.0
belly_y = nodes.new('ShaderNodeMapRange')
links.new(sep.outputs['Y'], belly_y.inputs['Value'])
belly_y.inputs['From Min'].default_value = -.85
belly_y.inputs['From Max'].default_value = -.20
belly_y.inputs['To Min'].default_value = 0.0
belly_y.inputs['To Max'].default_value = 1.0
b1 = mathnode('MULTIPLY', belly_x.outputs[0], belly_z.outputs[0])
b2 = mathnode('MULTIPLY', b1, belly_y.outputs[0])
belly_mask = mathnode('MULTIPLY', b2, 0.85)

rock_var = mix(a=(.016, .015, .015), b=(.052, .042, .034), fac=n1.outputs['Fac'])
# darker in crevices, lighter on exposed plates
plate = mix(a_socket=rock_var.outputs[0], b=(.075, .060, .048), fac=m_hair, blend='MIX')
base = mix(a_socket=plate.outputs[0], b=(.34, .17, .075), fac=belly_mask)
hot = mix(a_socket=base.outputs[0], b=(.95, .115, .003), fac=m_hot)
links.new(hot.outputs[0], emit.inputs['Color'])
bpy.context.view_layer.update()
scene.render.engine = 'CYCLES'; scene.cycles.samples = 1
scene.render.bake.margin = 12; scene.render.bake.use_clear = True
scene.render.threads_mode = 'FIXED'; scene.render.threads = 6
imgs = []


def bake(image_name, socket, colorspace='sRGB'):
    image = bpy.data.images.new(image_name, width=2048, height=2048, alpha=False)
    image.colorspace_settings.name = colorspace
    target = nodes.new('ShaderNodeTexImage'); target.image = image; nodes.active = target
    links.new(socket, emit.inputs['Color'])
    bpy.ops.object.bake(type='EMIT')
    image.filepath_raw = str(OUT / (image_name + '.png')); image.file_format = 'PNG'
    image.save(); image.pack(); imgs.append(image)
    return image


img_base = bake('salamander-v2-basecolor', hot.outputs[0])
# Emission: only live fissures, zero elsewhere, so identity survives without bloom.
em = mix(a=(0, 0, 0), b=(1, .07, .002), fac=m_hot)
img_emi = bake('salamander-v2-emission', em.outputs[0])
# Roughness mask (non-color): rock rough, fissures glassier. Bake the mapped
# value so glTF consumes the texture directly without unsupported node math.
rough_map = nodes.new('ShaderNodeMapRange')
links.new(m_hot, rough_map.inputs['Value'])
rough_map.inputs['To Min'].default_value = .90
rough_map.inputs['To Max'].default_value = .38
img_rough = bake('salamander-v2-roughness', rough_map.outputs['Result'], 'Non-Color')

body_mat = bpy.data.materials.new('01 Piel volcanica V2')
body_mat.use_nodes = True
p = body_mat.node_tree.nodes['Principled BSDF']
bl = body_mat.node_tree.links
for image, socket, cs in ((img_base, 'Base Color', 'sRGB'), (img_emi, 'Emission Color', 'sRGB'),
                          (img_rough, 'Roughness', 'Non-Color')):
    tex = body_mat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image = image
    tex.image.colorspace_settings.name = cs
    bl.new(tex.outputs['Color'], p.inputs[socket])
p.inputs['Emission Strength'].default_value = .55
body.data.materials.clear(); body.data.materials.append(body_mat)
bpy.data.materials.remove(bake_mat)

# ---------------------------------------------------------------- studio & export
def stats():
    objs = [o for o in model.objects if o.type == 'MESH']
    co = []
    for o in objs:
        co.extend(o.matrix_world @ v.co for v in o.data.vertices)
        o.data.calc_loop_triangles()
    lo = [min(c[i] for c in co) for i in range(3)]
    hi = [max(c[i] for c in co) for i in range(3)]
    return {'objects': len(objs), 'vertices': sum(len(o.data.vertices) for o in objs),
            'polygons': sum(len(o.data.polygons) for o in objs),
            'triangles': sum(len(o.data.loop_triangles) for o in objs),
            'materials': sorted({m.name for o in objs for m in o.data.materials}),
            'bounds_blender': {'min': lo, 'max': hi, 'dimensions': [hi[i] - lo[i] for i in range(3)]},
            'textures': 3, 'texture_resolution': [2048, 2048],
            'rigged': False, 'animations': 0, 'blender': bpy.app.version_string}


for o in model.objects:
    if o.type == 'MESH':
        o['stage'] = 'R1-B.2A V2 static art review - NOT RIGGED'
body['topology_note'] = 'Voxel-unified sculpt; deformation retopology required before rigging.'
body['original_source'] = 'tools/blender/build_salamander_v2.py; no third-party asset input'

metrics = stats()
world = bpy.data.worlds.new('V2 studio'); scene.world = world; world.use_nodes = True
world.node_tree.nodes['Background'].inputs[0].default_value = (.055, .07, .095, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = .30
floor_mat = mat('STUDIO floor', (.018, .022, .030), .82)
bpy.ops.mesh.primitive_plane_add(size=200, location=(0, 0, -.012))
ground = put(bpy.context.object, studio); ground.name = 'STUDIO_ground'
ground.data.materials.append(floor_mat)


def area(name, loc, power, size, color):
    data = bpy.data.lights.new(name, 'AREA'); data.energy = power; data.shape = 'DISK'
    data.size = size; data.color = color
    o = bpy.data.objects.new(name, data); studio.objects.link(o); o.location = loc
    o.rotation_euler = (Vector((0, 0, .40)) - o.location).to_track_quat('-Z', 'Y').to_euler()


area('Key softbox', (-2.2, -3.1, 3.2), 260, 3.2, (1, .90, .78))
area('Fill softbox', (2.6, -1.0, 1.9), 165, 3.0, (.70, .82, 1))
area('Rim softbox', (0, 2.9, 2.9), 300, 2.4, (1, .66, .38))
cam_data = bpy.data.cameras.new('V2 review camera')
camera = bpy.data.objects.new('V2 review camera', cam_data)
studio.objects.link(camera); scene.camera = camera
cam_data.type = 'ORTHO'; cam_data.ortho_scale = 1.9
scene.render.resolution_x = 1200; scene.render.resolution_y = 1000
scene.render.resolution_percentage = 100
scene.render.image_settings.file_format = 'PNG'
scene.render.film_transparent = False
scene.view_settings.view_transform = 'AgX'
scene.render.threads_mode = 'FIXED'; scene.render.threads = 6
bpy.ops.wm.save_as_mainfile(filepath=str(OUT / 'salamander-v2.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in model.objects:
    o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.export_scene.gltf(filepath=str(OUT / 'salamander-v2-preview.glb'), export_format='GLB',
                          use_selection=True, export_yup=True, export_animations=False,
                          export_cameras=False, export_lights=False, export_extras=True,
                          export_apply=True)
metrics['build_export_seconds'] = time.perf_counter() - START
if NO_RENDER:
    (DOC / 'build-metrics.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')
    print('V2_BUILD_NO_RENDER ' + json.dumps(metrics))
    import os; sys.stdout.flush(); os._exit(0)

# ---------------------------------------------------------------- renders
VIEWS = {
    'front': ((0, -4, .50), (0, 0, .48), 1.72),
    'side': ((4, .04, .50), (0, .04, .48), 2.36),
    'back': ((0, 4, .50), (0, 0, .48), 1.86),
    'three-quarter': ((2.55, -3.30, 1.55), (0, .03, .46), 2.21),
}


def aim(view, dist=None, fov=None):
    loc, target, scale = VIEWS[view]
    camera.location = loc
    camera.rotation_euler = (Vector(target) - camera.location).to_track_quat('-Z', 'Y').to_euler()
    cam_data.ortho_scale = scale


if CLAY:
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.display.shading.light = 'STUDIO'
    scene.display.shading.color_type = 'SINGLE'
    scene.display.shading.single_color = (.62, .64, .68)
    scene.display.shading.show_cavity = True
    scene.display.shading.cavity_type = 'BOTH'
    claymat = mat('STUDIO clay', (.55, .56, .6), .6)
    for o in list(model.objects):
        if o.type == 'MESH':
            o.data.materials.clear(); o.data.materials.append(claymat)
    scene.render.resolution_percentage = 80
    for v in ('front', 'side', 'back', 'three-quarter'):
        aim(v)
        scene.render.filepath = str(DOC / ('clay-' + v + '.png'))
        bpy.ops.render.render(write_still=True)
    print('V2_CLAY_COMPLETE ' + json.dumps({k: metrics[k] for k in ('triangles', 'vertices', 'objects', 'bounds_blender')}))
    import os; sys.stdout.flush(); os._exit(0)

scene.render.engine = 'CYCLES'; scene.cycles.samples = 40; scene.cycles.use_denoising = True
for v in ('front', 'side', 'back', 'three-quarter'):
    aim(v)
    scene.render.filepath = str(DOC / ('salamander-' + v + '.png'))
    bpy.ops.render.render(write_still=True)

# Face close-up: 85 mm equivalent, shallow framing on the head.
cam_data.type = 'PERSP'; cam_data.lens = 85
camera.location = (.34, -1.28, .68)
camera.rotation_euler = (Vector((0, -.62, .57)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(DOC / 'salamander-face-closeup.png')
bpy.ops.render.render(write_still=True)

# R1-A-like gameplay distance: 6.4 m, 55° vertical FOV, 22° pitch above the feet.
# Blender is Z-up: "behind" is +Y (the muzzle points to -Y), height is +Z.
cam_data.type = 'PERSP'
cam_data.sensor_fit = 'VERTICAL'; cam_data.sensor_height = 24
cam_data.lens = 24 / (2 * math.tan(math.radians(55) / 2))  # 55° vertical, like R1-A fovBase
pitch = math.radians(22); dist = 6.4
tx, ty, tz = 0.0, 0.0, .46
camera.location = (tx, ty + dist * math.cos(pitch), tz + .90 + dist * math.sin(pitch))
camera.rotation_euler = (Vector((tx, ty, tz)) - camera.location).to_track_quat('-Z', 'Y').to_euler()
scene.render.filepath = str(DOC / 'salamander-rear-gameplay-distance.png')
bpy.ops.render.render(write_still=True)

# Wireframe over neutral clay: actual evaluated topology, not a drawn overlay.
wire_mat = mat('STUDIO wire', (.004, .012, .022), .8)
clay_mat = mat('STUDIO wireframe clay', (.30, .34, .38), .7)
wire_objs = []
for o in [x for x in model.objects if x.type == 'MESH']:
    o.data.materials.clear(); o.data.materials.append(clay_mat)
    c = o.copy(); c.data = o.data.copy(); studio.objects.link(c)
    c.name = 'WIRE_' + o.name
    c.data.materials.clear(); c.data.materials.append(wire_mat)
    wm = c.modifiers.new('Actual mesh edges', 'WIREFRAME')
    wm.thickness = .0007; wm.use_replace = True; wm.offset = 1
    wire_objs.append(c)
ground.hide_render = True
cam_data.type = 'ORTHO'; aim('three-quarter')
scene.render.filepath = str(DOC / 'salamander-wireframe.png')
bpy.ops.render.render(write_still=True)
for c in wire_objs:
    bpy.data.objects.remove(c, do_unlink=True)

# Silhouette: emission-free pure black geometry on a light neutral backdrop.
cam_data.type = 'ORTHO'; aim('side')
sil = mat('STUDIO silhouette', (0, 0, 0), 1.0)
for o in [x for x in model.objects if x.type == 'MESH']:
    o.data.materials.clear(); o.data.materials.append(sil)
world.node_tree.nodes['Background'].inputs[0].default_value = (.86, .84, .80, 1)
world.node_tree.nodes['Background'].inputs[1].default_value = 1.0
for L in [o for o in studio.objects if o.type == 'LIGHT']:
    L.data.energy = 0
scene.render.filepath = str(DOC / 'salamander-silhouette.png')
bpy.ops.render.render(write_still=True)

metrics['total_seconds'] = time.perf_counter() - START
metrics['files'] = {p.name: p.stat().st_size for p in [OUT / 'salamander-v2.blend',
                    OUT / 'salamander-v2-preview.glb', *OUT.glob('*.png'), *DOC.glob('salamander-*.png')]}
(DOC / 'build-metrics.json').write_text(json.dumps(metrics, indent=2), encoding='utf-8')
print('V2_BUILD_COMPLETE ' + json.dumps(metrics))

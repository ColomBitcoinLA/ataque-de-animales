"""Original R1-B.2 static art-review mesh. ISC. Blender 5.2.2.
Run: blender --background --python tools/blender/build_salamander.py
No downloaded geometry/textures. No armature, actions, or runtime edits.
See docs/r1b/GEOMETRY_PLAN.md BEFORE changing the proportions.
"""
from pathlib import Path
import bpy, bmesh, math, json, time, sys
NO_RENDER = '--no-render' in sys.argv
import numpy as np
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'assets/characters/salamander'
DOC = ROOT / 'docs/r1b'
OUT.mkdir(parents=True, exist_ok=True)
DOC.mkdir(parents=True, exist_ok=True)
START = time.perf_counter()
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
bpy.context.preferences.filepaths.save_version = 0
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
model = bpy.data.collections.new('SALAMANDER'); scene.collection.children.link(model)
sources = bpy.data.collections.new('CONSTRUCTION_SOURCE'); scene.collection.children.link(sources)
studio = bpy.data.collections.new('STUDIO_NOT_EXPORTED'); scene.collection.children.link(studio)

def move_to(obj, collection=model):
    for c in list(obj.users_collection): c.objects.unlink(obj)
    collection.objects.link(obj)
    return obj

def material(name, color, roughness=.7, emission=None, strength=0, vertex=False):
    mat = bpy.data.materials.new(name); mat.use_nodes = True
    p = mat.node_tree.nodes.get('Principled BSDF')
    p.inputs['Base Color'].default_value = (*color, 1)
    p.inputs['Roughness'].default_value = roughness
    if emission:
        p.inputs['Emission Color'].default_value = (*emission, 1)
        p.inputs['Emission Strength'].default_value = strength
    if vertex:
        a = mat.node_tree.nodes.new('ShaderNodeVertexColor'); a.layer_name = 'Color'
        mat.node_tree.links.new(a.outputs['Color'], p.inputs['Base Color'])
    mat.diffuse_color = (*color, 1)
    return mat

skin = material('01 Basalto - vertex pigment', (.07,.065,.06), .73, vertex=True)
lava = material('02 Grietas - ember', (.9,.15,.007), .6, (.9,.13,.005), .65, True)
belly = material('03 Vientre - piedra calida', (.16,.075,.035), .76)
lidmat = material('04 Parpados - basalto pulido', (.052,.041,.034), .57)
dark = material('05 Boca y pupilas - obsidiana', (.007,.009,.011), .24)
eye = material('06 Iris ambar', (.85,.27,.025), .22, (.7,.12,.004), .12, True)
claw = material('07 Garras - cuerno mineral', (.25,.15,.07), .48)
fire = material('08 Fuego solido - amber', (1,.26,.012), .5, (1,.055,.002), .25, True)
firecore = material('09 Nucleo fuego - oro', (1,.48,.018), .52, (1,.32,.008), .25)
shine = material('10 Catchlight', (.95,.86,.65), .16)

def mesh_obj(name, verts, faces, mat=skin, collection=model):
    me = bpy.data.meshes.new(name); me.from_pydata(verts, [], faces); me.update()
    obj = bpy.data.objects.new(name, me); collection.objects.link(obj)
    if mat: me.materials.append(mat)
    bm = bmesh.new(); bm.from_mesh(me); bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces)); bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth=True
    return obj

def active(obj):
    bpy.ops.object.select_all(action='DESELECT'); obj.select_set(True); bpy.context.view_layer.objects.active=obj

def apply(obj, mod):
    active(obj); bpy.ops.object.modifier_apply(modifier=mod.name)

def subd(obj, levels=2):
    m=obj.modifiers.new('Surface refinement','SUBSURF'); m.levels=levels; apply(obj,m)
    return obj

def catmull(points, samples=4):
    a=np.asarray(points,float); result=[]
    for i in range(len(a)-1):
        p0=a[max(0,i-1)]; p1=a[i]; p2=a[i+1]; p3=a[min(len(a)-1,i+2)]
        for k in range(samples):
            t=k/samples
            result.append(.5*((2*p1)+(-p0+p2)*t+(2*p0-5*p1+4*p2-p3)*t*t+(-p0+3*p1-3*p2+p3)*t*t*t))
    result.append(a[-1]); return result

def sweep(name, controls, sides=16, samples=4, mat=skin):
    """Closed varying elliptical cross sections on a custom curved centerline.
    controls = x,y,z, radius_a,radius_b. No cylinder/sphere objects used.
    """
    rings=catmull(controls,samples); verts=[]; faces=[]
    for i,p in enumerate(rings):
        tang=Vector(rings[min(i+1,len(rings)-1)][:3]-rings[max(0,i-1)][:3]).normalized()
        ref=Vector((1,0,0)) if abs(tang.x)<.85 else Vector((0,1,0))
        u=(ref-tang*ref.dot(tang)).normalized(); v=tang.cross(u).normalized()
        for j in range(sides):
            ang=2*math.pi*j/sides
            q=Vector(p[:3])+u*(max(.001,p[3])*math.cos(ang))+v*(max(.001,p[4])*math.sin(ang))
            verts.append(tuple(q))
    for i in range(len(rings)-1):
        for j in range(sides):
            a=i*sides+j; b=i*sides+(j+1)%sides
            faces.append((a,b,b+sides,a+sides))
    for idx,reverse in [(0,True),(len(rings)-1,False)]:
        center=len(verts); verts.append(tuple(rings[idx][:3]))
        for j in range(sides):
            f=(center,idx*sides+j,idx*sides+(j+1)%sides)
            faces.append(f[::-1] if reverse else f)
    return mesh_obj(name,verts,faces,mat)

def loft_body():
    # y, half-width, center height, half-height: tail root through muzzle.
    sections=[(.43,.075,.34,.07),(.34,.18,.36,.15),(.19,.25,.37,.22),
              (-.05,.245,.4,.235),(-.22,.205,.44,.21),(-.34,.225,.51,.205),
              (-.45,.30,.555,.215),(-.56,.318,.545,.205),(-.66,.275,.51,.16),
              (-.76,.205,.485,.12),(-.825,.13,.48,.082),(-.85,.022,.48,.025)]
    verts=[]; faces=[]; rings=catmull(sections,5); n=40
    for y,w,z,h in rings:
        for j in range(n):
            a=j*2*math.pi/n
            x=w*math.cos(a); zz=z+h*math.sin(a)
            # Sculpt a flatter throat/sole of jaw and a broad muzzle bridge.
            if math.sin(a)<-.6: zz += .012*(-math.sin(a)-.6)
            verts.append((x,y,zz))
    for i in range(len(rings)-1):
        for j in range(n):
            a=i*n+j; b=i*n+(j+1)%n; faces.append((a,b,b+n,a+n))
    faces.extend([tuple(range(n-1,-1,-1)),tuple((len(rings)-1)*n+j for j in range(n))])
    return mesh_obj('Unified body head neck',verts,faces)

body=loft_body(); volumes=[body]
# Four shaped limbs, bent elbows/knees and planted three-toed feet.
for s in [-1,1]:
    for hind in [False,True]:
        tag=('Hind' if hind else 'Front')+('_L' if s<0 else '_R')
        if hind:
            cs=[(s*.16,.23,.39,.12,.13),(s*.275,.29,.32,.13,.14),
                (s*.32,.34,.21,.095,.10),(s*.315,.22,.105,.075,.075),(s*.34,.11,.055,.10,.047)]
            foot_y=.10; foot_x=.34
        else:
            cs=[(s*.17,-.20,.46,.105,.12),(s*.28,-.22,.36,.11,.12),
                (s*.33,-.30,.245,.085,.095),(s*.33,-.43,.12,.068,.075),(s*.34,-.48,.056,.10,.049)]
            foot_y=-.49; foot_x=.34
        volumes.append(sweep(tag,cs,20,5))
        for digit in range(3):
            spread=(digit-1)*.065
            x=s*(foot_x+spread); endy=foot_y-.105-(.015 if digit==1 else 0)
            cs=[(s*(foot_x+spread*.6),foot_y+.035,.059,.043,.037),
                (x,foot_y-.035,.045,.038,.032),(x+s*.008,endy,.033,.029,.025),
                (x+s*.009,endy-.018,.030,.011,.012)]
            volumes.append(sweep(tag+f'_digit_{digit}',cs,12,4))
            sweep(tag+f'_claw_{digit}',[(x+s*.008,endy+.008,.035,.025,.020),
                 (x+s*.011,endy-.026,.032,.018,.016),(x+s*.014,endy-.053,.023,.001,.002)],12,4,claw)
# Tail integrated as a curved taper, not an appended cylinder.
# Tail arcs above the rump so it stays legible from the R1-A rear chase camera.
tail=[(0,.29,.36,.145,.125),(.01,.46,.31,.12,.105),(.045,.64,.26,.095,.082),
      (.085,.81,.33,.072,.065),(.10,.93,.45,.052,.048),(.09,1.00,.575,.032,.030),
      (.075,1.03,.66,.012,.014)]
volumes.append(sweep('Tail curved original sections',tail,24,6))
# Keep construction mesh source hidden, for editable technical inspection.
for obj in volumes:
    cp=obj.copy(); cp.data=obj.data.copy(); sources.objects.link(cp); cp.name='SOURCE_'+obj.name
sources.hide_render=True; sources.hide_viewport=True
active(body)
for o in volumes:o.select_set(True)
bpy.ops.object.join(); body.name='Salamander_continuous_sculpt'
mod=body.modifiers.new('Union voxel sculpt .0075m','REMESH'); mod.mode='VOXEL'; mod.voxel_size=.0075; mod.use_smooth_shade=True; apply(body,mod)
mod=body.modifiers.new('Relax sculpt','SMOOTH'); mod.factor=.75; mod.iterations=5; apply(body,mod)
# Ground contact is explicit, not floating beneath the body.
for v in body.data.vertices:
    if v.co.z<.015: v.co.z=0
mod=body.modifiers.new('Review mesh density','DECIMATE'); mod.ratio=.22; apply(body,mod)

# Carved eye sockets, before the fitted eyelids; eyeballs are deliberately separate anatomy.
def ellipsoid(name, loc, scale, mat, direction=None, segments=40, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, location=loc)
    o=move_to(bpy.context.object); o.name=name; o.scale=scale
    if direction: o.rotation_euler=Vector(direction).to_track_quat('Z','Y').to_euler()
    active(o); bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    if mat:o.data.materials.append(mat)
    for p in o.data.polygons:p.use_smooth=True
    return o

def tube(name, points, radius, mat, sides=10, samples=3):
    return sweep(name,[(*p,radius,radius) for p in points],sides,samples,mat)

eye_specs=[]
for s in [-1,1]:
    center=Vector((s*.234,-.580,.625)); normal=Vector((s*.57,-.78,.20)).normalized()
    eye_specs.append((s,center,normal))
    cutter=ellipsoid('TEMP_socket',center,(.133,.13,.128),None,segments=32,rings=20)
    mod=body.modifiers.new('Anatomical eye recess','BOOLEAN'); mod.operation='DIFFERENCE'; mod.object=cutter; mod.solver='EXACT'; apply(body,mod)
    bpy.data.objects.remove(cutter,do_unlink=True)

# Remove boolean slivers before export triangulation (do not relax validation).
bm=bmesh.new(); bm.from_mesh(body.data)
bmesh.ops.triangulate(bm,faces=list(bm.faces))
bmesh.ops.remove_doubles(bm,verts=list(bm.verts),dist=0.00001)
bmesh.ops.dissolve_degenerate(bm,edges=list(bm.edges),dist=0.00001)
bmesh.ops.triangulate(bm,faces=list(bm.faces))
bmesh.ops.recalc_face_normals(bm,faces=list(bm.faces))
bm.to_mesh(body.data); bm.free(); body.data.update()

# Original lava cells sampled in 3D; deterministic and embedded, no external raster images.
verts=np.array([v.co[:] for v in body.data.vertices]); rng=np.random.default_rng(2249)
seeds=np.array([(x,y,z) for x in np.arange(-.6,.7,.16) for y in np.arange(-1.1,1.25,.16) for z in np.arange(-.15,.96,.16)])
seeds += rng.uniform(-.057,.057,seeds.shape)
def fissures(coords):
    edge=np.empty(len(coords)); noise=np.empty(len(coords))
    for start in range(0,len(coords),1500):
        p=coords[start:start+1500]
        dist=np.sqrt(((p[:,None,:]-seeds[None,:,:])**2).sum(axis=2))
        nearest=np.partition(dist,1,axis=1)[:,:2]
        edge[start:start+len(p)]=np.abs(nearest[:,1]-nearest[:,0])
        noise[start:start+len(p)]=np.sin(p[:,0]*81+p[:,1]*51+p[:,2]*43)*.5+.5
    return edge,noise
edges,noise=fissures(verts)
colors=body.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
for i,v in enumerate(verts):
    # Jaw/central face clean for readability, fissures mainly torso/tail/limbs.
    clean_face=v[1]<-.40 and v[2]>.38 and (v[2]<.68 or abs(v[0])<.10)
    crack=edges[i]<.007 and not clean_face
    if crack:
        c=(.85,.12+.13*noise[i],.006,1)
    else:
        f=.77+.27*noise[i]
        c=(.032*f,.029*f,.026*f,1)
    colors.data[i].color=c
body.data.materials.clear()
for m in [skin,lava,belly]:body.data.materials.append(m)
centers=np.array([p.center[:] for p in body.data.polygons]); pe,_=fissures(centers)
for i,p in enumerate(body.data.polygons):
    x,y,z=p.center
    if pe[i]<.005 and not(y<-.40 and z>.38 and (z<.68 or abs(x)<.10)): p.material_index=1
    elif abs(x)<.16 and -.44<y<.22 and z<.24:p.material_index=2
    else:p.material_index=0
    p.use_smooth=True

# Bake original 3D fissures to portable textures. No third-party input pixels.
# A continuous procedural field removes vertex/triangle aliasing seen in v1.
active(body)
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66),island_margin=.012)
bpy.ops.object.mode_set(mode='OBJECT')
body.data.color_attributes.remove(body.data.color_attributes['Color'])
bake_mat=bpy.data.materials.new('TEMP_original_field'); bake_mat.use_nodes=True
body.data.materials.clear(); body.data.materials.append(bake_mat)
for p in body.data.polygons:p.material_index=0
nodes=bake_mat.node_tree.nodes; links=bake_mat.node_tree.links; nodes.clear()
output=nodes.new('ShaderNodeOutputMaterial'); emit=nodes.new('ShaderNodeEmission'); links.new(emit.outputs[0],output.inputs['Surface'])
pos=nodes.new('ShaderNodeNewGeometry')
noise_node=nodes.new('ShaderNodeTexNoise'); noise_node.inputs['Scale'].default_value=17; noise_node.inputs['Detail'].default_value=2
links.new(pos.outputs['Position'],noise_node.inputs['Vector'])
warp=nodes.new('ShaderNodeVectorMath'); warp.operation='SCALE'; warp.inputs[3].default_value=.045
links.new(noise_node.outputs['Color'],warp.inputs[0])
add=nodes.new('ShaderNodeVectorMath'); add.operation='ADD'; links.new(pos.outputs['Position'],add.inputs[0]); links.new(warp.outputs[0],add.inputs[1])
vor=nodes.new('ShaderNodeTexVoronoi'); vor.distance='EUCLIDEAN'; vor.feature='DISTANCE_TO_EDGE'; vor.inputs['Scale'].default_value=8.0
links.new(add.outputs[0],vor.inputs['Vector'])
mask=nodes.new('ShaderNodeValToRGB'); mask.color_ramp.elements[0].position=.012; mask.color_ramp.elements[0].color=(1,1,1,1)
mask.color_ramp.elements[1].position=.032; mask.color_ramp.elements[1].color=(0,0,0,1)
links.new(vor.outputs['Distance'],mask.inputs[0])
sep=nodes.new('ShaderNodeSeparateXYZ'); links.new(pos.outputs['Position'],sep.inputs[0])
ytest=nodes.new('ShaderNodeMath'); ytest.operation='LESS_THAN'; ytest.inputs[1].default_value=-.40; links.new(sep.outputs['Y'],ytest.inputs[0])
ztest=nodes.new('ShaderNodeMath'); ztest.operation='LESS_THAN'; ztest.inputs[1].default_value=.68; links.new(sep.outputs['Z'],ztest.inputs[0])
face=nodes.new('ShaderNodeMath'); face.operation='MULTIPLY'; links.new(ytest.outputs[0],face.inputs[0]); links.new(ztest.outputs[0],face.inputs[1])
invert=nodes.new('ShaderNodeMath'); invert.operation='SUBTRACT'; invert.inputs[0].default_value=1; links.new(face.outputs[0],invert.inputs[1])
finalmask=nodes.new('ShaderNodeMath'); finalmask.operation='MULTIPLY'; links.new(mask.outputs['Color'],finalmask.inputs[0]); links.new(invert.outputs[0],finalmask.inputs[1])
rock=nodes.new('ShaderNodeMixRGB'); rock.blend_type='MIX'; rock.inputs[1].default_value=(.018,.021,.023,1); rock.inputs[2].default_value=(.052,.042,.031,1)
links.new(noise_node.outputs['Fac'],rock.inputs[0])
base_mix=nodes.new('ShaderNodeMixRGB'); base_mix.blend_type='MIX'; links.new(finalmask.outputs[0],base_mix.inputs[0]); links.new(rock.outputs[0],base_mix.inputs[1]); base_mix.inputs[2].default_value=(.85,.10,.002,1)
# Warm ventral tint below the thorax without overriding the lava pattern.
low=nodes.new('ShaderNodeMath'); low.operation='LESS_THAN'; low.inputs[1].default_value=.25; links.new(sep.outputs['Z'],low.inputs[0])
ventral=nodes.new('ShaderNodeMixRGB'); links.new(low.outputs[0],ventral.inputs[0]); links.new(rock.outputs[0],ventral.inputs[1]); ventral.inputs[2].default_value=(.07,.033,.016,1)
links.new(ventral.outputs[0],base_mix.inputs[1])
emission_mix=nodes.new('ShaderNodeMixRGB'); links.new(finalmask.outputs[0],emission_mix.inputs[0]); emission_mix.inputs[1].default_value=(0,0,0,1); emission_mix.inputs[2].default_value=(1,.07,.001,1)
scene.render.engine='CYCLES'; scene.cycles.samples=1; scene.render.bake.margin=16
scene.render.threads_mode='FIXED'; scene.render.threads=8
images=[]
for name,source in [('salamander-basecolor',base_mix.outputs[0]),('salamander-emission',emission_mix.outputs[0])]:
    image=bpy.data.images.new(name,width=2048,height=2048,alpha=False)
    image.colorspace_settings.name='sRGB'
    target=nodes.new('ShaderNodeTexImage'); target.image=image; nodes.active=target
    links.new(source,emit.inputs['Color'])
    bpy.ops.object.bake(type='EMIT')
    image.filepath_raw=str(OUT/(name+'.png')); image.file_format='PNG'; image.save(); image.pack(); images.append(image)
# Final preview PBR is standard glTF: atlas baseColor/emissive, uniform roughness.
bodymat=material('01 Basalto y vientre - atlas original',(.035,.03,.027),.74)
p=bodymat.node_tree.nodes.get('Principled BSDF')
for image,socket in zip(images,['Base Color','Emission Color']):
    tex=bodymat.node_tree.nodes.new('ShaderNodeTexImage'); tex.image=image
    bodymat.node_tree.links.new(tex.outputs['Color'],p.inputs[socket])
p.inputs['Emission Strength'].default_value=.45
body.data.materials.clear(); body.data.materials.append(bodymat)
bpy.data.materials.remove(bake_mat)

# Expressive layered eye surfaces, iris pigment, fitted upper/lower lids.
for s,c,n in eye_specs:
    tag='L' if s<0 else 'R'
    u=Vector((1,0,0)); u=(u-n*u.dot(n)).normalized(); v=n.cross(u).normalized()
    e=ellipsoid('Eye_'+tag,c,(.116,.116,.116),eye)
    col=e.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
    for i,vert in enumerate(e.data.vertices):
        f=.75+.25*math.sin(math.atan2(vert.co.x,vert.co.z)*25)**2
        col.data[i].color=(.9*f,.245*f,.016,1)
    # Lens/pupil situated on outward-facing hemisphere, separate black pupil.
    pupil=ellipsoid('Pupil_'+tag,c+n*.107,(.045,.063,.019),dark,n,32,20)
    ellipsoid('Eye_highlight_'+tag,c+n*.124-u*.020+v*.027,(.011,.011,.006),shine,n,20,12)
    for upper in [True,False]:
        angles=np.linspace(0,math.pi,15) if upper else np.linspace(math.pi,2*math.pi,15)
        pts=[]
        for a in angles:
            pt=c+u*(.116*math.cos(a))+v*(.102*math.sin(a))+n*.039
            pts.append(tuple(pt))
        tube(('Upper_lid_' if upper else 'Lower_lid_')+tag,pts,.019 if upper else .013,lidmat,12,2)
    # Swept brow not a full donut around the eye.
    pts=[tuple(c+u*(.13*math.cos(a))+v*(.126*math.sin(a))+n*.017) for a in np.linspace(.12,math.pi-.12,10)]
    tube('Brow_'+tag,pts,.023,lidmat,12,3)

# Designed mouth seam wraps the wedge; dark slit and subtle lower lip.
for s in [-1,1]:
    pts=[(0,-.847,.446),(s*.09,-.830,.437),(s*.17,-.79,.428),(s*.222,-.716,.430),(s*.248,-.648,.448)]
    tube('Mouth_seam_'+str(s),pts,.006,dark,8,4)
    tube('Lower_lip_'+str(s),[(x,y+.002,z-.012) for x,y,z in pts],.009,lidmat,10,3)
    ellipsoid('Nostril_'+str(s),(s*.108,-.819,.528),(.018,.009,.011),dark,segments=24,rings=16)
# Cheek ridges taper into the neck, distinguish head from a spherical toy.
for s in [-1,1]:
    sweep('Cheek_ridge_'+str(s),[(s*.272,-.50,.48,.022,.027),(s*.29,-.43,.49,.032,.040),
          (s*.24,-.33,.54,.019,.035),(s*.19,-.28,.57,.002,.003)],12,4,lidmat)

# Flame tongues: varying flattened cross sections with curved, hooked tips.
# Geometry remains legible with emission/bloom disabled.
def flame(name, base, height, width, lean=.08, twist=0, mat=fire):
    x,y,z=base
    if name.startswith(('Crest_', 'Tail_ridge_', 'Tail_flame')):
        hit,location,normal,index=body.ray_cast(Vector((x,y,2)),Vector((0,0,-1)))
        if hit:
            target_top=z+height
            z=location.z-.014
            height=max(.035,target_top-z)
    profile=[(0,0,.03,.22),(.16,-.04, .44,.72),(.38,.01, .52,1),
             (.61,.16,.30,.66),(.80,.31,.17,.37),(.96,.41,.025,.10),(1,.39,.001,.002)]
    cs=[]
    for t,bend,w,d in profile:
        cs.append((x+math.sin(t*3.3+twist)*width*.18,y+lean*t+bend*width,z+height*t,max(.001,width*w),max(.001,width*d*.38)))
    o=sweep(name,cs,16,4,mat)
    if mat==fire:
        col=o.data.color_attributes.new(name='Color',type='FLOAT_COLOR',domain='POINT')
        for i,vert in enumerate(o.data.vertices):
            t=max(0,min(1,(vert.co.z-z)/height))
            col.data[i].color=(.9,.022+.16*(1-t),.001,1)
    return o

for i,(y,z,h,w) in enumerate([(-.48,.738,.255,.125),(-.25,.66,.28,.12),(.03,.60,.24,.10),(.25,.51,.20,.08)]):
    flame('Crest_main_'+str(i),(0,y,z),h,w,.045)
    for s in [-1,1]:
        flame(f'Crest_branch_{i}_{s}',(s*w*.45,y+.018,z-.015),h*.72,w*.61,.07,twist=s)
    flame('Crest_core_'+str(i),(0,y-.025,z+.007),h*.57,w*.48,.018,mat=firecore)
# Tail ember is smaller than dorsal crest.
flame('Tail_flame',(.078,1.028,.655),.172,.079,-.04)
flame('Tail_flame_core',(.078,1.006,.657),.10,.035,-.02,mat=firecore)
# Small mineral dorsal scales bridge tail into crest without particle dependence.
for i in range(4):
    y=.42+i*.12; x=.015+max(0,y-.46)*.32; z=.34 if i==0 else .29 if i==1 else .275 if i==2 else .31
    flame('Tail_ridge_'+str(i),(x,y,z),.075-i*.009,.038,.03,mat=claw)

# Ensure no loose construction object enters exported selection.
bpy.context.view_layer.update()
for obj in model.objects: obj['stage']='R1-B.2 static art review - NOT RIGGED'
body['topology_note']='Voxel-unified sculpt; deformation retopology required before rigging.'
body['original_source']='tools/blender/build_salamander.py; no third-party asset input'
# Record real bounds/counts, before any studio objects exist.
def statistics():
    objects=[o for o in model.objects if o.type=='MESH']; coords=[]
    for o in objects:
        coords.extend(o.matrix_world@v.co for v in o.data.vertices)
        o.data.calc_loop_triangles()
    low=[min(v[a] for v in coords) for a in range(3)]; high=[max(v[a] for v in coords) for a in range(3)]
    return {'objects':len(objects),'vertices':sum(len(o.data.vertices) for o in objects),
            'polygons':sum(len(o.data.polygons) for o in objects),'triangles':sum(len(o.data.loop_triangles) for o in objects),
            'materials':sorted({m.name for o in objects for m in o.data.materials}),
            'bounds_blender':{'min':low,'max':high,'dimensions':[high[i]-low[i] for i in range(3)]},
            'blender':bpy.app.version_string,'textures':2,'texture_resolution':[2048,2048],'rigged':False,'animations':0}
metrics=statistics()

# Studio: neutral charcoal, large key/fill and edge lights. No bloom compositor.
world=bpy.data.worlds.new('Neutral studio'); scene.world=world; world.use_nodes=True
world.node_tree.nodes['Background'].inputs[0].default_value=(.10,.12,.16,1)
world.node_tree.nodes['Background'].inputs[1].default_value=.35
floor_mat=material('STUDIO floor',(.023,.028,.037),.83)
bpy.ops.mesh.primitive_plane_add(size=200,location=(0,0,-.012)); ground=move_to(bpy.context.object,studio); ground.name='STUDIO_ground'; ground.data.materials.append(floor_mat)
def area(name,loc,power,size,color):
    data=bpy.data.lights.new(name,'AREA'); data.energy=power; data.shape='DISK'; data.size=size; data.color=color
    o=bpy.data.objects.new(name,data); studio.objects.link(o); o.location=loc; o.rotation_euler=(Vector((0,0,.4))-o.location).to_track_quat('-Z','Y').to_euler()
area('Key softbox',(-2.0,-3,3.3),230,3,(1,.88,.73))
area('Fill softbox',(2.4,-.7,1.8),170,2.8,(.70,.83,1))
area('Rim softbox',(0,2.7,2.7),260,2.3,(1,.71,.43))
camera_data=bpy.data.cameras.new('Review camera'); camera=bpy.data.objects.new('Review camera',camera_data); studio.objects.link(camera); scene.camera=camera
camera_data.type='ORTHO'; camera_data.ortho_scale=2.65; camera_data.lens=55
scene.render.engine='CYCLES'; scene.cycles.samples=40; scene.cycles.use_denoising=True
scene.render.resolution_x=1200; scene.render.resolution_y=1000; scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'; scene.render.film_transparent=False
scene.view_settings.view_transform='AgX'
scene.render.use_file_extension=True
scene.render.threads_mode='FIXED'; scene.render.threads=8
scene['README']='Original static Salamander. Review art & retopology before rigging. SALAMANDER exported; CONSTRUCTION_SOURCE and STUDIO excluded.'
views={'front':((0,-4,.48),(0,0,.48)), 'side':((4,.06,.48),(0,.06,.48)),
       'back':((0,4,.48),(0,0,.48)), 'three-quarter':((2.45,-3.5,1.8),(0,.04,.45))}
def set_view(view):
    loc,target=views[view]; camera.location=loc; camera.rotation_euler=(Vector(target)-camera.location).to_track_quat('-Z','Y').to_euler()
    camera_data.ortho_scale=1.72 if view in ('front','back') else 2.5
set_view('three-quarter')
# Packed original atlases + vertex color detail; no external asset dependencies.
bpy.ops.wm.save_as_mainfile(filepath=str(OUT/'salamander.blend'))
bpy.ops.object.select_all(action='DESELECT')
for o in model.objects:o.select_set(True)
bpy.context.view_layer.objects.active=body
bpy.ops.export_scene.gltf(filepath=str(OUT/'salamander-preview.glb'),export_format='GLB',use_selection=True,
                          export_yup=True,export_animations=False,export_cameras=False,export_lights=False,
                          export_extras=True,export_apply=True)
metrics['build_export_seconds']=time.perf_counter()-START
if NO_RENDER:
    (DOC/'build-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
    print('SALAMANDER_BUILD_NO_RENDER '+json.dumps(metrics))
    sys.exit(0)
for view in views:
    set_view(view); scene.render.filepath=str(DOC/f'salamander-{view}.png'); bpy.ops.render.render(write_still=True)
# Real topology render; wire edges from evaluated geometry, not a drawn illustration.
set_view('three-quarter')
wiremat=material('STUDIO wire',(0.006,.016,.025),.8)
clay=material('STUDIO clay',(.24,.31,.35),.8)
original_slots={}
for o in list(model.objects):
    original_slots[o.name]=list(o.data.materials)
    o.data.materials.clear(); o.data.materials.append(clay)
    # Wireframe modifier uses the same actual mesh topology.
    cp=o.copy(); cp.data=o.data.copy(); studio.objects.link(cp); cp.name='WIRE_'+o.name
    cp.data.materials.clear(); cp.data.materials.append(wiremat)
    mod=cp.modifiers.new('Actual mesh edges','WIREFRAME'); mod.thickness=.0008; mod.use_replace=True; mod.offset=1
scene.render.filepath=str(DOC/'salamander-wireframe.png'); bpy.ops.render.render(write_still=True)
metrics['total_build_render_seconds']=time.perf_counter()-START
metrics['files']={p.name:p.stat().st_size for p in [OUT/'salamander.blend',OUT/'salamander-preview.glb',*OUT.glob('salamander-*.png'),*DOC.glob('salamander-*.png')]}
(DOC/'build-metrics.json').write_text(json.dumps(metrics,indent=2),encoding='utf-8')
print('SALAMANDER_BUILD_COMPLETE '+json.dumps(metrics))

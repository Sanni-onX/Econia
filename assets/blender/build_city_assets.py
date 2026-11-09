"""Original Econia economic premises. Run with Blender 4.5 LTS --background --python.

World units: meters; fronts face -Y. GLB export maps Blender Z-up to Three Y-up.
No downloaded geometry, textures, plugins or fonts are required.
"""
import bpy
import math
import json
from pathlib import Path
from mathutils import Vector

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'apps/web/public/models/econia'
OUT.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
COLORS = {
    'cream': '#E9D9B9', 'plaster': '#D8C4A0', 'terracotta': '#B95F45',
    'tile': '#D4835E', 'sage': '#617B68', 'dark': '#364F52',
    'timber': '#715541', 'wood': '#AD8559', 'stone': '#B6B5A4',
    'glass': '#72A5AC', 'brass': '#D3AA59', 'bread': '#D7A45A',
    'linen': '#F2E8CD', 'brick': '#BD765E', 'blue': '#729AA5',
    'steel': '#536D75', 'grain': '#C5B171', 'soil': '#67523E',
}
MATS = {}
for name, color in COLORS.items():
    m = bpy.data.materials.new(name)
    rgb = tuple(int(color[i:i+2], 16)/255 for i in (1,3,5))
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1)
    bsdf.inputs['Roughness'].default_value = .77
    if name == 'brass': bsdf.inputs['Metallic'].default_value = .35
    MATS[name] = m

def finish(obj, name, mat, bevel=0):
    obj.name = name
    obj.data.materials.append(MATS[mat])
    if bevel:
        mod = obj.modifiers.new('Crafted edges', 'BEVEL')
        mod.width = bevel
        mod.segments = 2
    return obj

def box(name, pos, scale, mat, bevel=.025):
    bpy.ops.mesh.primitive_cube_add(size=1, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, name, mat, bevel)

def cylinder(name, pos, radius, depth, mat, vertices=16):
    bpy.ops.mesh.primitive_cylinder_add(vertices=vertices, radius=radius, depth=depth, location=pos)
    return finish(bpy.context.object, name, mat, .018)

def ball(name, pos, scale, mat):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=12, ring_count=6, radius=1, location=pos)
    obj = bpy.context.object
    obj.scale = scale
    return finish(obj, name, mat)

def roof(name, width, depth, base, height, mat, cx=0, cy=0):
    vertices = [(-width/2,-depth/2,base),(width/2,-depth/2,base),
        (-width/2,depth/2,base),(width/2,depth/2,base),
        (0,-depth/2,base+height),(0,depth/2,base+height)]
    mesh = bpy.data.meshes.new(name)
    mesh.from_pydata([(x+cx,y+cy,z) for x,y,z in vertices], [],
        [(0,1,4),(2,5,3),(0,4,5,2),(1,3,5,4),(0,2,3,1)])
    mesh.update()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.collection.objects.link(obj)
    finish(obj, name, mat, .035)
    return obj

def window(x,y,z,width=.9,height=1.15):
    box('Window deep frame',(x,y,z),(width+.16,.13,height+.16),'timber')
    box('Blue glazing',(x,y-.075,z),(width,.035,height),'glass',.008)
    box('Window center mullion',(x,y-.105,z),(.055,.06,height),'linen',.008)
    box('Window cross rail',(x,y-.105,z),(width,.06,.055),'linen',.008)
    box('Stone window sill',(x,y-.08,z-height/2-.11),(width+.28,.3,.12),'cream')

def label(text, x,y,z, size=.3):
    bpy.ops.object.text_add(location=(x,y,z), rotation=(math.pi/2,0,0))
    o = bpy.context.object
    o.data.body = text
    o.data.align_x = 'CENTER'
    o.data.align_y = 'CENTER'
    o.data.size = size
    o.data.extrude = .005
    o.data.materials.append(MATS['linen'])
    bpy.ops.object.convert(target='MESH')
    o.name = 'Carved '+text+' sign'

def crate(x,y,z=0, width=.65):
    box('Crate body',(x,y,z+.32),(width,.6,.64),'wood')
    for dz in (.1,.32,.54):
        box('Crate front slat',(x,y-.32,z+dz),(width+.04,.07,.07),'timber',.01)
    for dx in (-width*.38,width*.38):
        box('Crate strap',(x+dx,y-.37,z+.32),(.07,.04,.64),'timber',.005)

def barrel(x,y,z=0):
    cylinder('Barrel',(x,y,z+.4),.32,.8,'wood',12)
    for h in (.13,.64): cylinder('Barrel hoop',(x,y,z+h),.335,.055,'steel',12)

def base(width=6.1, depth=5.4):
    box('Stone foundation',(0,0,.12),(width,depth,.24),'stone',.06)
    for i in range(6):
        box('Front paving',(i*.8-2,-2.65,.14),(.77,.53,.16),'cream',.025)

def bakery():
    base()
    box('Cream plaster shop',(0,0,1.6),(4.6,3.6,3.0),'cream',.05)
    box('Stone shop plinth',(0,0,.38),(4.72,3.72,.35),'plaster')
    roof('Terracotta gable',5.1,4.1,3.12,1.42,'terracotta')
    # Raised tile seams give the roof readable relief without textures.
    for side in (-1,1):
        for i in range(1,7):
            x = side*i*.34
            z = 4.54-abs(x)*1.42/2.55
            box('Roof tile course',(x,0,z+.04),(.055,4.12,.065),'tile',.014)
    box('Ridge cap',(0,0,4.57),(.18,4.2,.15),'tile')
    box('Bakery entrance',(-1.45,-1.84,1.12),(.85,.16,1.9),'dark',.04)
    window(-1.45,-1.95,1.43,.57,.75)
    cylinder('Door handle',(-1.15,-2.07,.93),.055,.09,'brass',10).rotation_euler.x=math.pi/2
    window(.65,-1.84,1.5,2.1,1.4)
    for x in (-1.12,1.12): window(x,-1.83,2.75,.6,.45)
    for i in range(9):
        o=box('Striped canvas awning',(-.47+i*.29,-2.22,2.28),(.29,1.06,.08),'linen' if i%2 else 'sage',.012)
        o.rotation_euler.x=.16
        box('Awning valance',(-.47+i*.29,-2.75,2.14),(.29,.06,.22),'linen' if i%2 else 'sage',.03)
    box('Shop fascia',(.65,-1.98,2.49),(2.8,.13,.38),'sage')
    label('BAKERY',.65,-2.06,2.49,.25)
    box('Brick chimney',(1.3,.8,4.18),(.56,.62,1.8),'brick')
    box('Chimney crown',(1.3,.8,5.12),(.76,.82,.16),'cream')
    box('Chimney opening',(1.3,.8,5.21),(.4,.46,.025),'dark',0)
    crate(2.63,-1.5)
    for i in range(3): ball('Fresh loaf',(2.42+i*.22,-1.5,.77),(.16,.27,.12),'bread')
    barrel(-2.65,.9)
    box('Bread sign bracket',(-2.58,-1.8,2.95),(.08,1.3,.08),'timber')
    box('Bread sign hanger',(-2.58,-2.4,2.65),(.05,.05,.52),'brass')
    ball('Bread-shaped sign',(-2.58,-2.4,2.27),(.28,.13,.43),'bread')

def farm():
    base(6.7,5.5)
    box('Barn walls',(-.65,0,1.55),(4.3,3.7,2.9),'brick')
    roof('Green barn roof',4.8,4.2,3,1.45,'sage',-.65)
    for x in (-2.72,1.42): box('Barn corner timber',(x,-1.92,1.55),(.12,.15,2.95),'linen')
    box('Double barn door',(-.65,-1.9,1.14),(1.7,.15,2),'timber')
    for x in (-1.43,.13): box('Door frame',(x,-2.02,1.15),(.09,.07,2),'linen')
    for angle in (-.65,.65):
        o=box('Door cross brace',(-.65,-2.04,1.13),(.09,.06,2.25),'linen');o.rotation_euler.y=angle
    box('Gable plaque',(-.65,-1.98,2.78),(2.1,.12,.36),'sage')
    label('GROWERS',-.65,-2.05,2.78,.22)
    cylinder('Grain silo',(2.5,.5,1.88),.72,3.5,'stone',20)
    for z in (.5,1.4,2.3,3.2): cylinder('Silo steel band',(2.5,.5,z),.74,.055,'steel',20)
    bpy.ops.mesh.primitive_cone_add(vertices=20,radius1=.8,radius2=.06,depth=.75,location=(2.5,.5,4))
    finish(bpy.context.object,'Silo conical cap','steel')
    for i in range(7): box('Silo ladder rung',(3.23,.5,.6+i*.44),(.09,.5,.05),'steel',.008)
    for y in (.26,.74):box('Silo ladder rail',(3.23,y,1.95),(.07,.06,3.3),'steel',.008)
    for x,y in [(-2.55,-2.15),(2.1,-1.7),(2.8,-1.65)]:
        cylinder('Harvest bale',(x,y,.53),.32,.65,'grain',12)
    crate(-2.6,.5)

def mill():
    base()
    cylinder('Octagonal stone mill',(-.45,0,2),1.55,3.7,'plaster',8)
    roof('Slate mill cap',3.55,3.6,3.9,1.25,'sage',-.45)
    box('Mill doorway',(-.45,-1.45,.95),(.83,.16,1.66),'timber')
    for x in (-1.32,.45):window(x,-1.48,2.2,.45,.65)
    box('Mill front sign',(-.45,-1.62,3),(1.15,.13,.37),'dark')
    label('MILL',-.45,-1.7,3,.27)
    box('Attached flour store',(1.72,.5,1.1),(1.9,2.8,2),'cream')
    roof('Flour store roof',2.2,3.1,2.1,.9,'terracotta',1.72,.5)
    window(1.72,-.95,1.1,.7,.8)
    # Rotor is exported separately so the client can animate recorded production only.
    for x,y in [(2.45,-1.65),(1.65,-2.15),(-2.2,-1.8)]:crate(x,y)
    barrel(-2.2,.7)

def harbor():
    base(6.6,5.5)
    box('Blue warehouse',(0,0,1.6),(4.9,3.9,3),'blue')
    roof('Warehouse folded roof',5.3,4.3,3.1,1.15,'steel')
    for x in (-1.2,1.2):
        box('Loading door',(x,-2.01,1.32),(1.7,.15,2.3),'dark')
        for z in (.36,.7,1.04,1.38,1.72,2.06,2.4):box('Door horizontal rib',(x,-2.1,z),(1.62,.07,.045),'steel',.008)
    box('Warehouse name plate',(0,-2.08,2.85),(3.3,.13,.43),'dark')
    label('LOGISTICS',0,-2.16,2.85,.27)
    for x in (-1.3,0,1.3):window(x,-1.99,3.47,.5,.4)
    for x in (-2.4,2.4):box('Warehouse steel column',(x,-2,1.6),(.13,.17,3.1),'steel')
    box('Loading dock',(0,-2.4,.34),(5.2,.7,.3),'wood')
    for x in (-2,-1,0,1,2):box('Dock front framing',(x,-2.76,.32),(.08,.08,.5),'timber')
    crate(-2.7,-1.4);crate(2.7,-1.4);barrel(2.7,.8)
    box('Cargo hoist pillar',(-2.8,1.3,2.2),(.2,.2,4.1),'steel')
    box('Cargo hoist beam',(-1.9,1.3,4.21),(2,.22,.2),'steel')
    cylinder('Hoist cable',(-1.05,1.3,3.55),.025,1.3,'dark',8)

BUILDERS = {'bakery':bakery,'farm':farm,'mill':mill,'harbor':harbor}
manifest = {'author':'Econia','license':'CC0-1.0','tool':bpy.app.version_string,'assets':[]}
for name, build in BUILDERS.items():
    collection = bpy.data.collections.new('Econia '+name)
    bpy.context.scene.collection.children.link(collection)
    layer = bpy.context.view_layer.layer_collection.children[collection.name]
    bpy.context.view_layer.active_layer_collection = layer
    build()
    bpy.ops.object.select_all(action='DESELECT')
    for obj in collection.objects: obj.select_set(True)
    bpy.context.view_layer.objects.active = next(iter(collection.objects))
    # Apply bevels and merge by material in the client for compact draw calls.
    path = OUT / (name+'.glb')
    bpy.ops.export_scene.gltf(filepath=str(path),export_format='GLB',use_selection=True,
        export_apply=True,export_materials='EXPORT',export_cameras=False,export_lights=False)
    manifest['assets'].append({'file':path.name,'bytes':path.stat().st_size,'source':'assets/blender/build_city_assets.py'})
    for obj in collection.objects: obj.location.x += list(BUILDERS).index(name)*9

# Editable source and a reproducible art-review render.
scene = bpy.context.scene
bpy.ops.object.camera_add(location=(27,-34,27))
camera = bpy.context.object
direction = Vector((13,0,1.8))-camera.location
camera.rotation_euler = direction.to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO';camera.data.ortho_scale=38
scene.camera=camera
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.light='STUDIO'
scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True
scene.display.shading.cavity_type='BOTH'
scene.display.shading.background_type='WORLD'
scene.world.color=(.12,.16,.18)
scene.render.resolution_x=1600;scene.render.resolution_y=800;scene.render.resolution_percentage=100
scene.render.image_settings.file_format='PNG'
scene.render.filepath=str(ROOT/'docs/screenshots/blender-premises.png')
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/econia-premises.blend'))
bpy.ops.render.render(write_still=True)
preview_dir = ROOT/'apps/web/public/images/premises'
preview_dir.mkdir(parents=True, exist_ok=True)
scene.render.resolution_x=560;scene.render.resolution_y=440
scene.render.film_transparent=True
camera.data.ortho_scale=8.6
for i,name in enumerate(BUILDERS):
    for other in BUILDERS:
        bpy.data.collections['Econia '+other].hide_render = other != name
    center = Vector((i*9,0,2))
    camera.location=center+Vector((7,-10,6))
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(preview_dir/(name+'.png'))
    bpy.ops.render.render(write_still=True)
(OUT/'manifest.json').write_text(json.dumps(manifest,indent=2)+'\n')
(OUT/'LICENSE.txt').write_text('Original Econia premises created with Blender. CC0 1.0 Universal.\nhttps://creativecommons.org/publicdomain/zero/1.0/\n')
print('ECONIA_ASSETS_COMPLETE',json.dumps(manifest))

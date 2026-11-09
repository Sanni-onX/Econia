import bpy, math
from mathutils import Vector
def material(name,color,metal=0):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True;p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.72;p.inputs['Metallic'].default_value=metal;return m
wood=material('MAT_warm_timber',(.34,.22,.13));gold=material('MAT_brass_trim',(.62,.43,.16),.3);paper=material('MAT_ledger_paper',(.9,.85,.67));green=material('MAT_planter_foliage',(.21,.42,.25));pot=material('MAT_terracotta',(.56,.26,.16))
def box(name,location,size,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=location);o=bpy.context.object;o.name=name;o.scale=size;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat);b=o.modifiers.new('Soft crafted edges','BEVEL');b.width=.025;b.segments=2;return o
def beam(name,a,b,width,mat):
 mid=(a+b)/2;o=box(name,mid,(width,width,(b-a).length),mat);o.rotation_euler=(b-a).to_track_quat('Z','Y').to_euler();return o
for i in range(6):
 a=i*math.tau/6;b=(i+1)*math.tau/6
 beam('STRUCT_perimeter_beam_'+str(i),Vector((2.05*math.cos(a),2.05*math.sin(a),2.95)),Vector((2.05*math.cos(b),2.05*math.sin(b),2.95)),.16,wood)
 c=bpy.data.objects['STRUCT_column_'+str(i)]
 for z in (.45,2.8):
  bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=.19,depth=.12,location=(c.location.x,c.location.y,z));o=bpy.context.object;o.name='TRIM_column_collar';o.data.materials.append(gold)
for i,angle in enumerate((.25,1.8,3.0)):
 x,y=1.55*math.cos(angle),1.55*math.sin(angle)
 seat=box('PRP_bench_seat_'+str(i),(x,y,.67),(1.2,.36,.12),wood);seat.rotation_euler.z=angle+math.pi/2
 for side in (-1,1):
  dx,dy=side*.45*math.cos(angle+math.pi/2),side*.45*math.sin(angle+math.pi/2)
  box('STRUCT_bench_leg',(x+dx,y+dy,.49),(.09,.15,.26),wood)
 back=box('PRP_bench_back_'+str(i),(x+.16*math.cos(angle),y+.16*math.sin(angle),.98),(1.2,.08,.36),wood);back.rotation_euler.z=angle+math.pi/2
bpy.ops.mesh.primitive_cylinder_add(vertices=16,radius=.12,depth=.57,location=(0,0,.645));o=bpy.context.object;o.name='STRUCT_meeting_table_leg';o.data.materials.append(wood)
bpy.ops.mesh.primitive_cylinder_add(vertices=24,radius=.67,depth=.1,location=(0,0,.98));o=bpy.context.object;o.name='PRP_meeting_table';o.data.materials.append(wood)
book=box('PRP_open_ledger',(0,0,1.06),(.62,.4,.06),paper)
box('PRP_ledger_spine',(0,0,1.097),(.025,.41,.012),gold)
box('PRP_commons_sign',(0,-1.84,2.65),(1.45,.1,.38),wood)
bpy.ops.object.text_add(location=(0,-1.901,2.65),rotation=(math.pi/2,0,0));o=bpy.context.object;o.name='SIGN_commons';o.data.body='COMMONS';o.data.align_x='CENTER';o.data.align_y='CENTER';o.data.size=.23;o.data.extrude=.004;o.data.materials.append(paper);bpy.ops.object.convert(target='MESH')
for x in (-1.65,1.65):
 bpy.ops.mesh.primitive_cone_add(vertices=12,radius1=.23,radius2=.32,depth=.46,location=(x,1.05,.59));o=bpy.context.object;o.name='PRP_planter';o.data.materials.append(pot)
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=.38,location=(x,1.05,.98));o=bpy.context.object;o.name='PRP_low_foliage';o.data.materials.append(green)
scene=bpy.context.scene;scene.render.resolution_x=720;scene.render.resolution_y=720
target=artifacts.file(name='econia-commons-final.png',media_type='image/png');scene.render.filepath=str(target.path);scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
bpy.ops.render.render(write_still=True);target.publish()
result={'objects':len(bpy.data.objects),'camera':scene.camera.name,'max_mesh_height':round(max(max((o.matrix_world@Vector(c)).z for c in o.bound_box) for o in bpy.data.objects if o.type=='MESH'),3),'materials':len(bpy.data.materials)}

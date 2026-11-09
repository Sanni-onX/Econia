import bpy, math
from mathutils import Vector
def mat(name,color):
 m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
 p=m.node_tree.nodes.get('Principled BSDF');p.inputs['Base Color'].default_value=(*color,1);p.inputs['Roughness'].default_value=.78
 return m
stone=mat('MAT_warm_stone',(.64,.63,.53));sage=mat('MAT_sage_roof',(.20,.36,.29));cream=mat('MAT_cream_columns',(.83,.76,.60))
def cyl(name,r,d,z,m,vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=d,location=(0,0,z));o=bpy.context.object;o.name=name;o.data.materials.append(m);return o
cyl('ENV_pavilion_plinth',2.8,.2,.1,stone)
cyl('ENV_upper_step',2.55,.16,.28,stone)
for i in range(6):
 a=i*math.tau/6
 o=cyl('STRUCT_column_'+str(i),.13,2.65,1.68,cream);o.location.x=2.05*math.cos(a);o.location.y=2.05*math.sin(a)
bpy.ops.mesh.primitive_cone_add(vertices=6,radius1=2.55,radius2=.22,depth=1.1,location=(0,0,3.53))
o=bpy.context.object;o.name='HERO_sage_canopy';o.data.materials.append(sage)
scene=bpy.context.scene;scene.world=bpy.data.worlds.new('WORLD_daylight');scene.world.use_nodes=True
scene.world.node_tree.nodes['Background'].inputs[0].default_value=(.32,.42,.48,1)
scene.world.node_tree.nodes['Background'].inputs[1].default_value=.35
bpy.ops.object.light_add(type='SUN',location=(-5,-6,9));o=bpy.context.object;o.name='LGT_key';o.data.energy=2.4;o.rotation_euler=(.4,-.5,-.4);o.data.angle=.15
bpy.ops.object.light_add(type='POINT',location=(4,-4,6));o=bpy.context.object;o.name='LGT_fill';o.data.energy=350;o.data.shadow_soft_size=3
bpy.ops.object.camera_add(location=(8,-10,8));o=bpy.context.object;o.name='CAM_main';o.rotation_euler=(Vector((0,0,1.8))-o.location).to_track_quat('-Z','Y').to_euler();o.data.type='ORTHO';o.data.ortho_scale=8;scene.camera=o
scene.render.engine='BLENDER_EEVEE';scene.render.resolution_x=640;scene.render.resolution_y=640;scene.render.resolution_percentage=100
target=artifacts.file(name='pavilion-blockout.png',media_type='image/png');scene.render.filepath=str(target.path);scene.render.image_settings.media_type='IMAGE';scene.render.image_settings.file_format='PNG'
bpy.ops.render.render(write_still=True);target.publish()
result={'objects':len(bpy.data.objects),'footprint_m':5.6,'height_m':4.08,'camera':'CAM_main'}


"""Regenerate matching UI previews from the committed editable scene."""
import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(root/'assets/blender/econia-premises.blend'))
scene=bpy.context.scene
camera=scene.camera
names=['bakery','farm','mill','harbor']
out=root/'apps/web/public/images/premises'
out.mkdir(parents=True,exist_ok=True)
scene.render.resolution_x=560;scene.render.resolution_y=440
scene.render.film_transparent=True
camera.data.ortho_scale=8.6
for i,name in enumerate(names):
    for other in names:bpy.data.collections['Econia '+other].hide_render=other!=name
    center=Vector((i*9,0,2))
    camera.location=center+Vector((7,-10,6))
    camera.rotation_euler=(center-camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=str(out/(name+'.png'))
    bpy.ops.render.render(write_still=True)

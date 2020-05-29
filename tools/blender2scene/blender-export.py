#
# 2020 Tarpeeksi Hyvae Soft
#
# Software: Wray
#
# A barebones Blender export script for Wray. Made for Blender 2.7, may also
# work with other versions.
#

import bpy
from bpy import context
from mathutils import Vector

outFilename = "scene.wray-scene"

camera = bpy.data.scenes["Scene"].camera
materials = bpy.data.materials
textures = bpy.data.textures

with open(outFilename, 'w') as f:
    f.write("{\n")

    f.write("\tepsilon:%f,\n" % 0.000001)

    f.write("\n\tcamera:\n\t{\n")
    f.write("\t\tposition:{x:%f,y:%f,z:%f},\n" % (camera.location[0],\
                                                  camera.location[1],\
                                                  camera.location[2]))
    f.write("\t\taxisAngle:{x:%f,y:%f,z:%f,w:%f},\n" % (camera.rotation_axis_angle[1],\
                                                        camera.rotation_axis_angle[2],\
                                                        camera.rotation_axis_angle[3],\
                                                        camera.rotation_axis_angle[0]))
    f.write("\t},\n")

    f.write("\n\ttriangles:`()=>\n\t{\n")

    f.write("\t\t// Shorthands.\n")
    f.write("\t\tconst t = Wray.triangle;\n")
    f.write("\t\tconst vr = Wray.vertex\n")
    f.write("\t\tconst vc = Wray.vector3\n\n")

    # Write the materials.
    f.write("\t\t// Set up the materials.\n")
    f.write("\t\tconst m = {\n")
    for material in materials:
        f.write("\t\t\t\"%s\":" % material.name)
        if material.raytrace_mirror.use:
            f.write("Wray.material.reflective(Wray.color_rgb(%f,%f,%f),%f,%f),\n" % (material.diffuse_color[0],\
                                                                                     material.diffuse_color[1],\
                                                                                     material.diffuse_color[2],\
                                                                                     material.diffuse_intensity,\
                                                                                     material.raytrace_mirror.reflect_factor))
        elif material.emit:
            f.write("Wray.material.emissive(Wray.color_rgb(%f,%f,%f)),\n" % ((material.diffuse_color[0] * material.emit),\
                                                                             (material.diffuse_color[1] * material.emit),\
                                                                             (material.diffuse_color[2] * material.emit)))
        else:
            f.write("Wray.material.lambertian(Wray.color_rgb(%f,%f,%f),%f),\n" % (material.diffuse_color[0],\
                                                                                  material.diffuse_color[1],\
                                                                                  material.diffuse_color[2],\
                                                                                  material.diffuse_intensity))
    f.write("\t\t};\n\n")
    
    # Write the n-gons.
    f.write("\t\treturn [\n")
    visible_meshes = filter(lambda x: x.type == "MESH", context.visible_objects)
    for mesh in visible_meshes:
        f.write("\t\t\t// Mesh: %s.\n" % mesh.name)
        for poly in mesh.data.polygons:
            f.write("\t\t\tt([")
            for v, l in zip(poly.vertices, poly.loop_indices):
                # Vertices.
                vd = mesh.data.vertices[v].co
                f.write("vr(vc(%.4f,%.4f,%.4f)" % (vd[0], vd[1], vd[2]))
                # If the polygon should have smooth shading, we'll write its vertex normals
                # as well. Otherwise, the face normal can be derived from the vertex positions.
                if poly.use_smooth:
                    vn = mesh.data.vertices[v].normal
                    f.write(",vc(%.4f,%.4f,%.4f))," % (vn[0], vn[1], vn[2]))
                else:
                    f.write(",null),")
            f.write("]")
            # Material.
            if len(mesh.material_slots):
                material = mesh.material_slots[poly.material_index].material
                if material != None:
                    f.write(",m[\"%s\"]" % material.name)
            f.write("),\n")
            
    # Finalize the file.
    f.write("\t\t];\n\t}`,\n}\n")

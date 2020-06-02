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

    f.write("\t\"epsilon\":%.6f,\n" % 0.000001)

    # Camera.
    f.write("\n\t\"camera\":{\n")
    f.write("\t\t\"position\":{\"x\":%.6f,\"y\":%.6f,\"z\":%.6f},\n" % (camera.location[0],\
                                                                        camera.location[1],\
                                                                        camera.location[2]))
    f.write("\t\t\"axisAngle\":{\"x\":%.6f,\"y\":%.6f,\"z\":%.6f,\"w\":%.6f}\n" % (camera.rotation_axis_angle[1],\
                                                                                   camera.rotation_axis_angle[2],\
                                                                                   camera.rotation_axis_angle[3],\
                                                                                   camera.rotation_axis_angle[0]))
    f.write("\t},\n\n")

    # Materials.
    f.write("\t\"materials\":{\n")
    for idx, material in enumerate(materials):
        f.write("\t\t\"%s\":{\n" % material.name)
        if material.raytrace_mirror.use:
            f.write("\t\t\t\"type\":\"reflective\",\n")
            f.write("\t\t\t\"color\":{\"r\":%.6f,\"g\":%.6f,\"b\":%.6f},\n" % (material.diffuse_color[0],\
                                                                               material.diffuse_color[1],\
                                                                               material.diffuse_color[2]))
            f.write("\t\t\t\"albedo\":%.6f,\n" % material.diffuse_intensity)
            f.write("\t\t\t\"reflectance\":%.6f\n" % material.raytrace_mirror.reflect_factor)
        elif material.emit:
            f.write("\t\t\t\"type\":\"emissive\",\n")
            f.write("\t\t\t\"color\":{\"r\":%.6f,\"g\":%.6f,\"b\":%.6f},\n" % (material.diffuse_color[0],\
                                                                               material.diffuse_color[1],\
                                                                               material.diffuse_color[2]))
            f.write("\t\t\t\"intensity\":%.6f\n" % material.emit)
        else:
            f.write("\t\t\t\"type\":\"lambertian\",\n")
            f.write("\t\t\t\"color\":{\"r\":%.6f,\"g\":%.6f,\"b\":%.6f},\n" % (material.diffuse_color[0],\
                                                                               material.diffuse_color[1],\
                                                                               material.diffuse_color[2]))
            f.write("\t\t\t\"albedo\":%.6f\n" % material.diffuse_intensity)
        if idx < (len(materials) - 1):
            f.write("\t\t},\n")
        else:
            f.write("\t\t}\n")
    f.write("\t},\n\n")

    # Triangle mesh.
    f.write("\t\"triangles\":[\n")
    visible_meshes = list(filter(lambda x: x.type == "MESH", context.visible_objects))
    for meshIdx, mesh in enumerate(visible_meshes):
        for polyIdx, poly in enumerate(mesh.data.polygons):
            if polyIdx == 0:
                f.write("\t\t{\n")
            else:
                f.write("{\n")
            if len(mesh.material_slots):
                material = mesh.material_slots[poly.material_index].material
                if material != None:
                    f.write("\t\t\t\"material\":\"%s\",\n" % material.name)
            f.write("\t\t\t\"vertices\":[\n")
            vertexIdx = 0 # Temporary hack.
            for v, l in zip(poly.vertices, poly.loop_indices):
                f.write("\t\t\t\t{")
                vd = mesh.data.vertices[v].co
                f.write("\"position\":{\"x\":%.6f,\"y\":%.6f,\"z\":%.6f}" % (vd[0], vd[1], vd[2]))
                # If the polygon should have smooth shading, we'll write its vertex normals
                # as well. Otherwise, the face normal can be derived from the vertex positions.
                f.write(",\"normal\":")
                if poly.use_smooth:
                    vn = mesh.data.vertices[v].normal
                    f.write("{\"x\":%.6f,\"y\":%.6f,\"z\":%.6f}" % (vn[0], vn[1], vn[2]))
                else:
                    f.write("null")
                if vertexIdx < (len(poly.vertices) - 1):
                    f.write("},\n")
                else:
                    f.write("}")
                vertexIdx += 1
            f.write("]\n")
            if meshIdx < (len(visible_meshes) - 1) or polyIdx < (len(mesh.data.polygons) - 1):
                f.write("\t\t},")
            else:
                f.write("\t\t}\n")
    f.write("\t]\n")

    f.write("}")

/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Mesh converter: OBJ -> WM (Wray mesh), taking advantage of Syoyo Fujita's tinyobjloader.
 *
 * A throwaway quickie to get the conversion job done.
 *
 */

#include <array>
#include <string>
#include <iostream>

#define TINYOBJLOADER_IMPLEMENTATION
#include "tiny_obj_loader.h"

struct vertex3_s
{
    double x, y, z;
};

struct material_s
{
    std::array<double,3> rgb = {{0, 0, 0}};
    std::array<double,3> emission = {{0, 0, 0}};

    std::string name;
};

struct triangle_s
{
    std::array<vertex3_s,3> v;
    uint materialId;
};

static std::pair<std::vector<triangle_s>, std::vector<material_s>> data_from_obj(const char *const objFilename)
{
    // Load preliminary data from the OBJ via tinyobj.
    std::vector<tinyobj::shape_t> tinyShapes;
    std::vector<tinyobj::material_t> tinyMaterials;
    {
        const char *const matBasePath = std::string(std::string(objFilename) + std::string("/")).c_str();

        std::string err = "";
        unsigned int flags = 1;
        tinyobj::LoadObj(tinyShapes, tinyMaterials, err, objFilename, matBasePath, flags);
        assert((err == "") && "The OBJ's data could not be loaded in.");
    }

    // Convert from tinyobj materials into our own material format.
    std::vector<material_s> materials;
    for (auto material: tinyMaterials)
    {
        material_s m;
        m.rgb = {material.diffuse[0],
                 material.diffuse[1],
                 material.diffuse[2]};
        m.name = material.name;

        materials.push_back(m);
    }

    // Convert from tinyobj shapes into triangles.
    // NOTE: Expects the tinyobj shapes to also be triangles.
    std::vector<triangle_s> triangles;
    for (auto shape: tinyShapes)
    {
        const auto numFaces = shape.mesh.num_vertices.size();

        uint idxOffs = 0;
        for (uint f = 0; f < numFaces; f++)
        {
            assert((shape.mesh.num_vertices.at(f) == 3) && "Expected a mesh of triangles.");

            triangle_s t;
            for (uint i = 0; i < 3; i++)
            {
                const uint p = shape.mesh.indices[idxOffs++];
                t.v[i] = {shape.mesh.positions[3*p+0],
                          shape.mesh.positions[3*p+1],
                          shape.mesh.positions[3*p+2]};
            }
            t.materialId = shape.mesh.material_ids.at(f);
            triangles.push_back(t);
        }
    }

    return {triangles, materials};
}

static void write_data_into_wm(const std::pair<std::vector<triangle_s>, std::vector<material_s>> &data, const char *const wmaFilename)
{
    std::ofstream f(wmaFilename);
    assert(f && "Failed to open the file for export.");

    f << "// OBJ2WM. Faces: " << data.first.size() << ".\n";
    f << "const mesh = function(scale = Wray.vector3(1, 1, 1))\n{\n";

    // Write the materials.
    // Note that this defaults to lambertian in all cases, at the moment.
    f << "\tconst m = [ // Materials.\n";
    for (auto mat: data.second)
    {
        f << "\t\tWray.material.lambertian(";
        f << "Wray.color_rgb(" << mat.rgb[0] << "," << mat.rgb[1] << "," << mat.rgb[2] << "),";
        f << "0.7"; // Albedo.
        f << "), // '" << mat.name << "'\n";
    }
    f << "\t];\n";

    // Write shorthands for certain function calls. This helps shave off some kilobytes in the file's size.
    f << "\tconst t = Wray.triangle;\n";
    f << "\tconst v = (x,y,z)=>(Wray.vector3(x,y,z).scaled(scale))\n\n";

    // Write the triangles.
    f << "\treturn [\n";
    for (auto tri: data.first)
    {
        f << "\t\tt([";
        for (uint i = 0; i < 3; i++) f << "v(" << tri.v[i].x << "," << tri.v[i].y << "," << tri.v[i].z << (i < 2? ")," : ")");
        f << "],m[" << tri.materialId << "]),\n";
    }
    f << "\t];\n};\n";

    return;
}

static void obj2wm(const char *const objFilename)
{
    const auto data = data_from_obj(objFilename);
    write_data_into_wm(data, (std::string(objFilename) + std::string(".wm.js")).c_str());

    return;
}

int main(int argc, char *argv[])
{
    if (argc != 2)
    {
        std::cerr << "ERROR: No file specified, or malformed command line." << std::endl;
        return EXIT_FAILURE;
    }

    obj2wm(argv[1]);

    return EXIT_SUCCESS;
}

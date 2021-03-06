/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

Wray.triangle = function(vertices = [Wray.vertex(), Wray.vertex(), Wray.vertex()],
                         material = Wray.material.lambertian())
{
    Wray.assert((vertices instanceof Array), "Expected an array of vertices to make a triangle.");
    Wray.assert((vertices.length === 3), "Triangles are expected to have three vertices.");

    // Derive the triangle's face normal from its vertices' positions (assumes counter-
    // clockwise winding). Note that this ignores the vertices' own normals.
    const faceNormal = (()=>
    {
        const e1 = vertices[1].position.sub(vertices[0].position);
        const e2 = vertices[2].position.sub(vertices[0].position);
        return e1.cross(e2).normalized();
    })();

    // If any of the vertices are missing a normal, override all vertex normals
    // with the triangle's face normal.
    if (vertices.some(vertex=>((vertex.normal || null) === null)))
    {
        vertices = vertices.map(vertex=>Wray.vertex(vertex.position, faceNormal))
    }

    const publicInterface = Object.freeze(
    {
        vertices: Object.freeze(vertices),
        material,
        faceNormal,
    });
    return publicInterface;
}

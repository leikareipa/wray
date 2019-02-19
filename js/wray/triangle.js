/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

Wray.triangle = function(vertices = [Wray.vector3(),Wray.vector3(),Wray.vector3()],
                         material = Wray.material.lambertian())
{
    Wray.assert((vertices instanceof Array), "Expected an array of vertices to make a triangle.");
    Wray.assert((vertices.length === 3), "Triangles are expected to have three vertices.");

    // Derive the normal from the triangle's vertices (assumes counter-clockwise winding).
    const normal = (()=>
    {
        const e1 = vertices[1].sub(vertices[0]);
        const e2 = vertices[2].sub(vertices[0]);
        return e1.cross(e2).normalized();
    })();

    const publicInterface = Object.freeze(
    {
        vertices: Object.freeze(vertices),
        material,
        normal,
    });
    return publicInterface;
}

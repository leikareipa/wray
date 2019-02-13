/*
 * Tarpeeksi Hyvae Soft 2019 /
 * 
 */

"use strict";

Wray.vector3 = function(x = 0, y = 0, z = 0)
{
    Wray.assert((typeof x === "number" && typeof y === "number" && typeof z === "number"),
                "Expected numbers as parameters to the vector3 factory.");

    const publicInterface = Object.freeze(
    {
        x,
        y,
        z,

        // Expects a 4 x 4 matrix.
        rotated_by_matrix: function(m44 = [])
        {
            const x0 = ((m44[0] * x) + (m44[4] * y) + (m44[8] * z));
            const y0 = ((m44[1] * x) + (m44[5] * y) + (m44[9] * z));
            const z0 = ((m44[2] * x) + (m44[6] * y) + (m44[10] * z));

            return Wray.vector3(x0, y0, z0);
        },

        sub: function(other = {})
        {
            return Wray.vector3((x - other.x), (y - other.y), (z - other.z));
        },

        cross: function(other = {})
        {
            return Wray.vector3(((y * other.z) - (z * other.y)),
                           ((z * other.x) - (x * other.z)),
                           ((x * other.y) - (y * other.x)));
        },

        dot: function(other = {})
        {
            return ((x * other.x) + (y * other.y) + (z * other.z));
        },

        // Returns a normalized copy of the vector.
        normalized: function()
        {
            const sn = ((x * x) + (y * y) + (z * z));

            if (sn != 0 && sn != 1)
            {
                const inv = (1.0 / Math.sqrt(sn));
                return Wray.vector3((x * inv), (y * inv), (z * inv));
            }
            
            return Wray.vector3(x, y, z);
        },

        scaled: function(scale = Wray.vector3())
        {
            return Wray.vector3((x * scale.x), (y * scale.y), (z * scale.z));
        },

        reversed: function()
        {
            return Wray.vector3(x*-1, y*-1, z*-1);
        }
    });

    return publicInterface;
}

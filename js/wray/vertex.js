/*
 * Tarpeeksi Hyvae Soft 2020 /
 * 
 */

"use strict";

Wray.vertex = function(position = Wray.vector3(0, 0, 0), normal = null)
{
    const publicInterface = Object.freeze(
    {
        x: position.x,
        y: position.y,
        z: position.z,
        position,
        normal,
    });

    return publicInterface;
}

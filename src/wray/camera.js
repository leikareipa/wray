/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A rudimentary camera for tracing rays.
 * 
 */

"use strict";

Wray.camera = function(pos = Wray.vector3(0, 0, 0),
                       axis = Wray.vector3(0, 0, 1),
                       angle = 0,
                       viewPlane = Wray.surface(),
                       fov = 20,
                       antialiasing = false)
{
    const publicInterface = Object.freeze(
    {
        pos,
        axis,
        angle,
        viewPlane,
        fov,
        antialiasing,

        // Returns a ray originating at the camera's position and pointed toward the given x,y
        // pixel coordinates on the given viewing plane.
        ray_toward_viewing_plane: function(x, y)
        {
            let dir = {};
            const aspectRatio = (viewPlane.width / viewPlane.height);

            // Antialiasing algo adapted from friedlinguini's at the now-deceased ompf.org.
            if (antialiasing)
            {
                const r1 = Math.random();
                const r2 = Math.random();
                const rad = 0.49 * Math.sqrt(-Math.log(1 - r1));
                const angle = 2 * Math.PI * r2;
                dir = Wray.vector3((2 * ((x + 0.5 + rad * Math.cos(angle)) / viewPlane.width) - 1) * Math.tan(fov * Math.PI / 180) * aspectRatio,
                                   (1 - 2 * ((y + 0.5 + rad * Math.sin(angle)) / viewPlane.height)) * Math.tan(fov * Math.PI / 180),
                                   -1);
            }
            else
            {
                const a = Math.tan(fov * Math.PI / 180);
                dir = Wray.vector3((2 * ((x+0.5) / viewPlane.width)-1) * a * aspectRatio,
                                   (1 - (2 * ((y+0.5) / viewPlane.height))) * a,
                                   -1);
            }

            // Point the ray in the camera's direction by transforming it by the camera's
            // axis angle. Adapted from https://stackoverflow.com/a/42422624.
            {
                const cross = axis.cross(dir);
                const dot = axis.dot(dir);
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                dir = Wray.vector3(((dir.x * cos) + (cross.x * sin) + (axis.x * dot) * (1 - cos)),
                                   ((dir.y * cos) + (cross.y * sin) + (axis.y * dot) * (1 - cos)),
                                   ((dir.z * cos) + (cross.z * sin) + (axis.z * dot) * (1 - cos)));
            }
            
            return Wray.ray(pos, dir);
        },
    });
    return publicInterface;
}

/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A rudimentary camera for tracing rays.
 * 
 */

"use strict";

Wray.camera = function(pos = Wray.vector3(0, 0, 0),
                       dir = Wray.vector3(0, 0, 1),
                       rot = Wray.vector3(0, 0, 0),
                       viewPlane = Wray.surface(),
                       fov = 20,
                       antialiasing = false)
{
    const viewMatrix = Wray.matrix44.matrices_multiplied(Wray.matrix44.matrices_multiplied(Wray.matrix44.rotate(rot.x, 0, 0),
                                                                                           Wray.matrix44.rotate(0, rot.y, 0)),
                                                         Wray.matrix44.rotate(0, 0, rot.z));

    const publicInterface = Object.freeze(
    {
        pos,
        dir,
        rot,
        viewPlane,
        fov,
        antialiasing,

        // Returns a ray originating at the camera's position and pointed toward the given x,y
        // pixel coordinates on the given viewing plane.
        ray_toward_viewing_plane: function(x, y)
        {
            const aspectRatio = (viewPlane.width / viewPlane.height);

            // Antialiasing algo adapted from friedlinguini's at the now-deceased ompf.org.
            let newDir = {};
            if (antialiasing)
            {
                const r1 = Math.random();
                const r2 = Math.random();
                const rad = 0.49 * Math.sqrt(-Math.log(1 - r1));
                const angle = 2 * Math.PI * r2;
                newDir = Wray.vector3(dir.x + (2 * ((x + 0.5 + rad * Math.cos(angle)) / viewPlane.width) - 1) * Math.tan(fov * Math.PI / 180) * aspectRatio,
                                      dir.y + (1 - 2 * (((y) + 0.5 + rad * Math.sin(angle)) / viewPlane.height)) * Math.tan(fov * Math.PI / 180),
                                      dir.z);
            }
            else
            {
                const a = Math.tan(fov * Math.PI / 180);
                newDir = Wray.vector3(dir.x + (2 * ((x+0.5) / viewPlane.width)-1) * a * aspectRatio + dir.x,
                                      dir.y + (1 - (2 * ((y+0.5) / viewPlane.height))) * a + dir.y,
                                      dir.z);
            }

            return Wray.ray(pos, newDir.normalized().rotated_by_matrix(viewMatrix));
        },
    });
    return publicInterface;
}

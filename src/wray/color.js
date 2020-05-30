/*
 * Tarpeeksi Hyvae Soft 2019 /
 *
 */

"use strict";

// Mainly intended for RGB in the range 0..1.
Wray.color_rgb = function(red = 0.5, green = 0.5, blue = 0.5)
{
    const publicInterface = Object.freeze(
    {
        red,
        green,
        blue,

        clamped: function(min = 0, max = 1)
        {
            return Wray.color_rgb(Math.max(Math.min(max, red), min),
                                  Math.max(Math.min(max, green), min),
                                  Math.max(Math.min(max, blue), min));
        },
        
        normalized: function()
        {
            const v = Wray.vector3(red, green, blue).normalized();
            return Wray.color_rgb(v.x, v.y, v.z);
        },
    });
    return publicInterface;
}

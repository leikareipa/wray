/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

// The various sky models available for rendering with. They should take in a ray's direction
// and return the color of the sky in that direction.
Wray.skyModels = Object.freeze(
{
    // An approximation of the color of an overcast sky in the given direction.
    // The equation is roughly that of "Moon & Spencer" (date/publication unknown;
    // as cited in Preetham 1999: A practical analytic model for daylight).
    cie_overcast: function(zenithDirection = Wray.vector3(0, 1, 0), zenithLuminance = 1.3)
    {
        return (rayDir = Wray.vector3())=>
        {
            const theta = (1 - zenithDirection.dot(rayDir));
            const luminance = zenithLuminance * ((1 + 2 * Math.cos(theta)) / 3);
            return Wray.color_rgb(luminance, luminance, luminance);
        }
    },

    // A solid color in all directions.
    solid_fill: function(r, g, b)
    {
        return ()=>(Wray.color_rgb(r, g, b));
    },
});

// Which of the sky models will be used when rendering. This default setting may be
// overridden by values in the scene file.
Wray.sky_color = Wray.skyModels.solid_fill({});

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
    cie_overcast: function(rayDir = Wray.vector3())
    {
        const theta = (1 - Wray.vector3(0, 1, 0).dot(rayDir));
        const zenithLuminance = 1.3;
        const luminance = zenithLuminance * ((1 + 2 * Math.cos(theta)) / 3);
        return Wray.color_rgb(luminance, luminance, luminance);
    },

    white: ()=>(Wray.color_rgb(1, 1, 1)),

    black: ()=>(Wray.color_rgb(0, 0, 0)),
});

// Which of the sky models will be used when rendering.
Wray.sky_color = Wray.skyModels.black;

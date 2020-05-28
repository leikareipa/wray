/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A crude placeholder material system. Doesn't allow for material chaining or advanced effect x.
 * 
 */

"use strict";

Wray.material = Object.freeze(
{
    lambertian: function(color = Wray.color_rgb(0, 1, 1), albedo = 0.7)
    {
        const publicInterface = Object.freeze(
        {
            isEmissive: false,
            color,
            albedo,
            scatter: (inRay = Wray.ray(), surfaceNormal = Wray.vector3())=>
            {
                const outRay = inRay.aimAt.random_in_hemisphere_cosine_weighted(surfaceNormal);
                const brdf = surfaceNormal.dot(outRay.dir) * (albedo / Math.PI);
                const pdf = (outRay.dir.dot(surfaceNormal) / Math.PI); // For cosine-weighted.
                //const pdf = (1 / (2 * Math.PI));                     // For non-cosine-weighted.
                return {outRay, bsdf:brdf/pdf};
            }
        });
        return publicInterface;
    },

    reflective: function(color = Wray.color_rgb(0, 1, 1), reflectance = 1, albedo = 0.7)
    {
        const publicInterface = Object.freeze(
        {
            isEmissive: false,
            color,
            reflectance,
            albedo,
            scatter: (inRay = Wray.ray(), surfaceNormal = Wray.vector3())=>
            {
                if (Math.random() <= reflectance)
                {
                    return {outRay:inRay.aimAt.reflected(surfaceNormal), bsdf:1};
                }
                else
                {
                    return this.lambertian(color, albedo).scatter(inRay, surfaceNormal);
                }
            }
        });
        return publicInterface;
    },

    emissive: function(emission = Wray.color_rgb(1, 1, 1))
    {
        const publicInterface = Object.freeze(
        {
            isEmissive: true,
            emission,
        });
        return publicInterface;
    },
});

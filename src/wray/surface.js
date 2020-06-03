/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A rendering surface, i.e. a pixel buffer with attached convenience functions for
 * rendering and display.
 * 
 */

"use strict";

Wray.surface = function(width = 1280, height = 720)
{
    Wray.assert((typeof width === "number" && typeof height === "number"),
                "Expected width and height to be numeric values.");
    Wray.assert((width > 0 && height > 0), "Invalid width and/or height for the render surface.");

    // A pixel buffer that covers the size of the surface.
    const pixelBuffer = (new Array(width * height)).fill().map((element, idx)=>(
    {
        // Pixel x,y coordinates.
        x: (idx % width),
        y: Math.floor(idx / width),

        // Accumulated color channel values, incremented each time a new ray
        // is sampled for this pixel. The range 0..1 here corresponds to 0..255.
        red: 0, green: 0, blue: 0,

        // Over how many samples the RGB values have been accumulated.
        numSamples: 1,
    }));

    wipe_surface();

    // Reset all of the surface's pixels to default initial values.
    function wipe_surface()
    {
        pixelBuffer.forEach((pixel)=>
        {
            pixel.red = 0;
            pixel.green = 0;
            pixel.blue = 0;
            pixel.numSamples = 0;
        });
    };

    const publicInterface = Object.freeze(
    {
        width,
        height,
        pixelBuffer,

        wipe: wipe_surface,

        // Returns a Transferable pixel buffer array of this render surface.
        transferable_pixel_array: function()
        {
            const pixelArray = new Float64Array(width * height * 4);

            for (const pixel of pixelBuffer)
            {
                const idx = ((pixel.x + pixel.y * width) * 4);
                const surfacePixel = pixelBuffer[pixel.x + pixel.y * width];

                pixelArray[idx+0] = surfacePixel.red;
                pixelArray[idx+1] = surfacePixel.green;
                pixelArray[idx+2] = surfacePixel.blue;
                pixelArray[idx+3] = 1;
            }

            return {pixelArray, width, height};
        },

        // Returns the average number of samples per pixel on this surface.
        average_sample_count: function()
        {
            const sampleCounts = pixelBuffer.map(element=>element.numSamples).sort();
            return sampleCounts[sampleCounts.length/2];
        },

        // Flatten out all accumulated color data in the surface pixel buffer.
        clamp_accumulated: function()
        {
            pixelBuffer.forEach((pixel)=>
            {
                const color = this.pixel_color_at(pixel.x, pixel.y);
                pixel.red = color.red;
                pixel.green = color.green;
                pixel.blue = color.blue;
                pixel.numSamples = 1;
            });
        },

        // Accumulates the given color to the color buffer's x,y element.
        accumulate_to_pixel_at: function(x = 0, y = 0, color = Wray.color_rgb())
        {
            const pixel = pixelBuffer[x+y*width];
            Wray.assert((pixel != null), "Detected an attempt to access an invalid element in the surface color buffer.");

            pixel.red += color.red;
            pixel.green += color.green;
            pixel.blue += color.blue;
            pixel.numSamples++;
        },

        // Returns the color buffer's x,y element as an RGB object.
        pixel_color_at: function(x = 0, y = 0)
        {
            const pixel = pixelBuffer[x+y*width];
            Wray.assert((pixel != null), "Detected an attempt to access an invalid element in the surface color buffer.");

            return Wray.color_rgb(pixel.red / (pixel.numSamples || 1),
                                  pixel.green / (pixel.numSamples || 1),
                                  pixel.blue / (pixel.numSamples || 1));
        },
    });
    return publicInterface;
}

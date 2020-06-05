/*
 * 2020 Tarpeeksi Hyvae Soft
 * 
 * Software: Wray
 * 
 * Deals with PFM images. PFMs store uncompressed high dynamic range images, where
 * each pixel is represented as three 4-byte floating-point values (red, green, blue).
 * 
 */

"use strict";

// The pixel buffer is an array of floating-point values that define the pixels which make
// up the PFM image. They are expected as consecutive values of red, green, blue, and alpha
// (RGBA) for each pixel. The alpha channel will be ignored in the PFM image but must be
// present in the input buffer. The first pixel in the buffer will represent the bottom left
// pixel in the PFM image, and consecutive pixels fill in from left to right, bottom to top.
//
// The 'averageSampleCount' value is the average number of Wray render samples that went
// into the creation of the given pixel buffer. It will be saved into the PFM file as its
// header's byte order value.
//
Wray.pfm = function(pixelBuffer = [0.5, 0.5, 0.5, 0.5], width = 1, height = 1, averageSampleCount = 1)
{
    // Note: We only support fullcolor RGB PFMs - i.e. ones that are of type "PF".
    const type = "PF";

    // Note: For now, we only support little-endian PFMs.
    const isLittleEndian = true;

    const publicInterface = Object.freeze(
    {
        width,
        height,
        pixelBuffer: Object.freeze(pixelBuffer),
        type,
        isLittleEndian,

        // Returns the PFM's header as an array of byte values.
        header: function()
        {
            const endiannessSign = (isLittleEndian? "-" : "");
            const headerString = `${type}\x0a${width} ${height}\x0a${endiannessSign}${averageSampleCount}\x0a`

            return Array.from(headerString).map(chr=>chr.charCodeAt(0));
        },

        // Returns the PFM's body (pixel data) as an array of byte values. Each 12
        // consecutive values (bytes) represent one pixel in the PFM image (4 bytes
        // for the red channel, 4 for the green channel, and 4 for the blue channel).
        // Each 4 bytes represent a 32-bit floating-point value.
        //
        /// TODO: Deal with endianness. This currently assumes little-endian.
        //
        body: function()
        {
            // Convert each floating-point color value into its 4 individual bytes.
            return pixelBuffer.reduce((pixelArray, pixel, idx)=>
            {
                // We'll ignore the input pixel buffer's alpha channel.
                if (((idx + 1) % 4) !== 0)
                {
                    pixelArray.push(...new Uint8Array(new Float32Array([pixel]).buffer, 0, 4));
                }

                return pixelArray;
            }, []);
        },

        // The PFM file's data as an array of byte values. These can be e.g. written
        // into a binary file as a Uint8Array.
        data: function()
        {
            return this.header().concat(this.body());
        },

        // Creates and returns a new PFM image object from a PFM file's data.
        from_file: function(pfmFile)
        {
            /// TODO.
        }
    });

    return publicInterface;
}

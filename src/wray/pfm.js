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
// up the PFM image. They are expected as consecutive values of red, green, and blue for
// each pixel. The first pixel in the buffer will represent the bottom left pixel in the
// PFM image, and consecutive pixels fill in from left to right, bottom to top.
//
// The 'averageSampleCount' value is the average number of Wray render samples that went
// into the creation of the given pixel buffer. It will be saved into the PFM file as its
// header's byte order value.
//
Wray.pfm = function(width = 1, height = 1, pixelBuffer = [0.5, 0.5, 0.5], averageSampleCount = 1)
{
    Wray.assert((pixelBuffer.length == (width * height * 3)), "Invalid pixel buffer size.");

    // Note: We only support fullcolor RGB PFMs - i.e. ones that are of type "PF".
    const type = "PF";

    // Note: For now, we only support little-endian PFMs.
    const isLittleEndian = true;

    const publicInterface = Object.freeze(
    {
        width,
        height,
        pixels: Object.freeze(pixelBuffer),
        type,
        isLittleEndian,
        averageSampleCount,

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
            return pixelBuffer.reduce((pixelArray, pixel)=>
            {
                pixelArray.push(...new Uint8Array(new Float32Array([pixel]).buffer, 0, 4));
                return pixelArray;
            }, []);
        },

        // The PFM file's data as an array of byte values. These can be e.g. written
        // into a binary file as a Uint8Array.
        data: function()
        {
            return this.header().concat(this.body());
        },
    });

    return publicInterface;
}

// Returns a Promise which resolves with a Wray.pfm() object once the given PFM file's
// data has been loaded; or, in case of error, rejects with a string describing the
// error. The target file is to be given as a File object.
Wray.pfm.from_file = function(pfmFile)
{
    return new Promise((resolve, reject)=>
    {
        const fileReader = new FileReader();

        fileReader.onloadend = ()=>
        {
            // The PFM file header is three lines separated by Unix carriage returns.
            // The header itself is also separated from the pixel data in that way
            // (the pixel data may of course also include this separating character
            // by chance, but in that case it's not a separator).
            const pfmBinaryData = fileReader.result.split("\x0a");

            if (pfmBinaryData.length < 4)
            {
                reject("Malformed PFM file.");
                return;
            }

            const pfmType = pfmBinaryData[0];
            const [pfmWidth, pfmHeight] = pfmBinaryData[1].split(" ").map(v=>Number(v));
            const pfmSamplesPerPixel = Math.abs(pfmBinaryData[2]);
            const pfmIsLittleEndian = ((pfmBinaryData[2][0] || "") === "-");

            if (pfmType !== "PF")
            {
                reject("Only full-color PFM files are supported.");
                return;
            }
            
            if (!pfmIsLittleEndian)
            {
                reject("Big-endian PFM files are not supported.");
                return;
            }

            if ((pfmWidth < 0) || (pfmHeight < 0))
            {
                reject("Invalid PFM image dimensions.");
                return;
            }

            // Since the PFM pixel data may by chance include the separating carriage
            // return character, which isn't meant to separate the pixel data, let's
            // restore it and re-join the pixel data.
            const pfmPixels = Array.from(pfmBinaryData.slice(3).join("\x0a"));
            
            // Convert each run of 4 bytes in the raw PFM pixel data into a 32-bit
            // floating-point value.
            const floatPixels = (()=>
            {
                const convertedPixels = [];
                const numColorChannels = 3;

                for (let i = 0; i < (pfmWidth * pfmHeight * numColorChannels); i++)
                {
                    const floatBytes = pfmPixels.slice((i * 4), ((i * 4) + 4)).map(p=>p.charCodeAt(0));
                    const uintRep = new Uint8Array(floatBytes);
                    const floatRep = new Float32Array(uintRep.buffer);

                    convertedPixels.push(floatRep[0]);
                }

                return convertedPixels;
            })();

            resolve(Wray.pfm(pfmWidth, pfmHeight, floatPixels, pfmSamplesPerPixel));
        };

        fileReader.readAsBinaryString(pfmFile);
    });
}

/*
 * 2020 Tarpeeksi Hyvae Soft
 *
 * Software: Wray
 * 
 */

"use strict";

Wray.tonemappingModels = Wray.tonemappingModels || {};

// Drago, Myszkowski, Annen & Chiba 2003: "Adaptive Logarithmic Mapping For Displaying
// High Contrast Scenes".
//
// Code adapted with superficial modifications into JavaScript by Tarpeeksi Hyvae Soft
// 2020 from a sample implementation in C by Frédéric Drago 2003. The source of the
// original code could no longer be located. The original code also mentions the following:
//
//     "Great thanks to Erik Reinhard, the implementation of the logmapping
//      tone mapping was started from his framework posted online."
//
// Expects 'pixelBuffer' to give the pixels of the image to be tonemapped. The pixels
// are expected in floating-point RGBA values.
//
Wray.tonemappingModels.drago_2003 = function(pixelBuffer,
                                             imageWidth,
                                             imageHeight,
                                             customParams = {
                                                 /*bias = Higher values result in a darker image. Defaults to 0.85.*/
                                             })
{
    Wray.tonemappingModels.drago_2003.epsilon = 0.000001;
    const contrastParam = 0; // Contrast improvement.
    const white = 1.0;       // Maximum display luminance.
    const exposure = Math.pow(2, 0);

    // Apply the tonemapping. Code adapted with superficial modifications from sample
    // implementation by Frederic Drago.
    const [maxLuminance, minLuminance, worldLuminance] = rgb_Yxy();
    logmapping(maxLuminance, minLuminance, worldLuminance, (customParams.bias || 0.85), contrastParam, exposure, white);
    Yxy_rgb();

    // Convert double floating point RGB data to Yxy, return max and min luminance
    // and absolute value of luminance log average for automatic exposure.
    function rgb_Yxy()
    {
        let x, i;
        let W, result = new Array(3);
        let max, min;
        let sum = 0.0;
        let array_size = imageWidth * imageHeight;

        const RGB2Yxy = [
            [0.5141364, 0.3238786, 0.16036376],
            [0.265068, 0.67023428, 0.06409157],
            [0.0241188, 0.1228178, 0.84442666]
        ];

        max = Wray.tonemappingModels.drago_2003.epsilon;
        min = Infinity;
        for (x = 0; x < array_size; x++)
        {
            result[0] = result[1] = result[2] = 0.;
            for (i = 0; i < 3; i++){
                result[i] += RGB2Yxy[i][0] * pixelBuffer[x*4];
                result[i] += RGB2Yxy[i][1] * pixelBuffer[x*4+1];
                result[i] += RGB2Yxy[i][2] * pixelBuffer[x*4+2];
            }
      
            if ((W = result[0] + result[1] + result[2]) > 0.) {
              pixelBuffer[x*4] = result[1];     // Y
              pixelBuffer[x*4+1] = result[0] / W;	// x
              pixelBuffer[x*4+2] = result[1] / W;	// y
            }
            else
                pixelBuffer[x*4] = pixelBuffer[x*4+1] = pixelBuffer[x*4+2] = 0.;
      
            max = (max < pixelBuffer[x*4]) ? pixelBuffer[x*4] : max;	// Max Luminance in Scene
            min = (min > pixelBuffer[x*4]) ? pixelBuffer[x*4] : min;	// Min Luminance in Scene
            sum += Math.log(2.3e-5 + pixelBuffer[x*4]); //Contrast constant Tumblin paper
        }

        return [max, min, (sum / (imageWidth * imageHeight))];
    }

    // Convert Yxy image back to double floating point RGB
    function Yxy_rgb()
    {
        let x, i;
        let result = new Array(3);
        let X, Y, Z;
        let array_size = imageWidth * imageHeight;

        const Yxy2RGB = [
            [2.5651, -1.1665, -0.3986],
            [-1.0217, 1.9777, 0.0439],
            [0.0753, -0.2543, 1.1892]
        ];

        for (x = 0; x < array_size; x++ ) {
            Y = pixelBuffer[x*4];	        // Y
            result[1] = pixelBuffer[x*4+1];	// x
            result[2] = pixelBuffer[x*4+2];	// y
            if ((Y > Wray.tonemappingModels.drago_2003.epsilon) && (result[1] > Wray.tonemappingModels.drago_2003.epsilon) && (result[2] > Wray.tonemappingModels.drago_2003.epsilon)) {
              X = (result[1] * Y) / result[2];
              Z = (X / result[1]) - X - Y;
            } else
              X = Z = Wray.tonemappingModels.drago_2003.epsilon;
            pixelBuffer[x*4] = X;
            pixelBuffer[x*4+1] = Y;
            pixelBuffer[x*4+2] = Z;
            result[0] = result[1] = result[2] = 0.;
            for (i = 0; i < 3; i++){
                result[i] += Yxy2RGB[i][0] * pixelBuffer[x*4];
                result[i] += Yxy2RGB[i][1] * pixelBuffer[x*4+1];
                result[i] += Yxy2RGB[i][2] * pixelBuffer[x*4+2];
            }
            pixelBuffer[x*4] = result[0];
            pixelBuffer[x*4+1] = result[1];
            pixelBuffer[x*4+2] = result[2];
          }
    }

    function logmapping(Lum_max,
                        Lum_min,
                        world_lum,
                        biasParam,
                        contParam,
                        exposure,
                        white)
    {
        let Lmax, divider, av_lum, interpol, biasP;
        let x, y, i, j, index;
        let nrows, ncols;
        let L;
        let exp_adapt;
        let Average;
        let fast = 0;

        nrows = imageHeight;
        ncols = imageWidth;

        // Arbitrary Bias Parameter
        if (!biasParam)
            biasParam = 0.85;

        exp_adapt = 1;//Math.pow(biasParam,5);
        av_lum = Math.exp(world_lum) / exp_adapt;

        biasP = Math.log(biasParam)/Math.log(0.5);
        Lmax = Lum_max/av_lum;
        divider = Math.log10(Lmax+1);

        // Normal tone mapping of every pixel
        if (!fast) {
            for (x=0; x < nrows; x++)
            for (y = 0; y < ncols; y++) {
                index = x * ncols + y;

                // inverse gamma function to enhance contrast
                // Not in paper
                if (contParam)
                    pixelBuffer[index*4] = Math.pow(pixelBuffer[index*4], (1 / contParam));

                pixelBuffer[index*4] /= av_lum;
                if (exposure != 1.0)
                    pixelBuffer[index*4] *= exposure;

                interpol = Math.log(2 + Math.pow((pixelBuffer[index*4] / Lmax), biasP) * 8);

                pixelBuffer[index*4] = ((Math.log(pixelBuffer[index*4]+1)/interpol)/divider);
            }
        }

        /*
        * Approximation of Math.log(x+1)
        *x(6+x)/(6+4x) good if x < 1
        *x*(6 + 0.7662x)/(5.9897 + 3.7658x) between 1 and 2
        *http://users.pandora.be/martin.brown/home/consult/logx.htm
        */
        else {
            for (x=0; x<nrows; x+=3)
            for (y=0; y<ncols; y+=3) {
                Average = 0.;
                for (i=0; i<3; i++)
                for (j=0; j<3; j++) {
                    pixelBuffer[((x+i)*ncols+y+j)*4] /= av_lum;
                    if (exposure != 1.)
                    pixelBuffer[((x+i)*ncols+y+j)*4]*= exposure;
                    Average += pixelBuffer[((x+i)*ncols+y+j)*4];
                }
                Average = Average / 9 - pixelBuffer[(x*ncols+y)*4];
                if (Average > -1 && Average < 1) {
                interpol =
                    Math.log(2+Math.pow(pixelBuffer[((x+1)*ncols+y+1)*4]/Lmax, biasP)*8);
                for (i=0; i<3; i++)
                    for (j=0; j<3; j++) {
                    index = (x+i)*ncols+y+j;
                    if (pixelBuffer[index*4] < 1) {
                        L = pixelBuffer[index*4]*(6+pixelBuffer[index*4])/(6+4*pixelBuffer[index*4]);
                        pixelBuffer[index*4] = (L/interpol) / divider;
                    }
                    else if ( pixelBuffer[index*4] >= 1 && pixelBuffer[index*4] < 2) {
                        L = pixelBuffer[index*4]*(6+0.7662*pixelBuffer[index*4])/
                            (5.9897+3.7658*pixelBuffer[index*4]);
                        pixelBuffer[index*4] = (L/interpol) / divider;
                    }
                    else
                    pixelBuffer[index*4] =
                        (Math.log(pixelBuffer[index*4] + 1)/interpol)/divider;
                    }
                }
                else {
                for (i=0; i<3; i++)
                    for (j=0; j<3; j++) {
                    interpol =
                        Math.log(2+Math.pow(pixelBuffer[((x+i)*ncols+y+j)*4]/Lmax, biasP)*8);
                    pixelBuffer[((x+i)*ncols+y+j)*4] =
                        (Math.log(pixelBuffer[((x+i)*ncols+y+j)*4]+1)/interpol)/divider;
                    }
                }
            }
        }
    }
};

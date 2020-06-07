/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A render sample for Wray. Renders a scene and uses Wray's built-in DOM UI to
 * display the rendering to the user. 
 * 
 */

"use strict";

const wrayUI = Wray.ui(document.getElementById("wray-ui-container"), {
    save_pfm: save_latest_image_to_pfm,
    load_pfm: load_base_pfm_image,
});

const wrayRenderer = new Worker("../distributable/wray-thread-marshal.js");

// Certain settings from the scene file will be stored here for later use.
let sceneSettings = {};

// Data about the latest rendered image we've received from the renderer.
const latestImage = {
    pixels: [],
    width: 0,
    height: 0,
    averageSamplesPerPixel: 0,
}

wrayUI.initialize();

// Maps the message handlers from above to incoming messages from Wray's thread.
wrayRenderer.onmessage = (message)=>
{
    message = message.data;
    const payload = message.payload;

    switch (message.name)
    {
        case Wray.thread_message.from.marshal.threadInitialized().name:
        {
            const sceneFileName = "./assets/sample1/colorball.wray-scene";

            Wray.log(`Loading scene from ${sceneFileName}...`);
            
            fetch(sceneFileName)
            .then((response)=>response.json())
            .then((sceneFile)=>
            {
                sceneFile.outputResolution = wrayUI.settings.resolution;
                sceneFile.renderThreadCount = wrayUI.settings.threadCount;

                sceneSettings.tonemapping = (sceneFile.tonemapping || {model: "none"});
                
                wrayRenderer.postMessage(Wray.thread_message.to.marshal.assignRenderSettings(sceneFile));
            })
            .catch((error)=>Wray.assert(0, "Attempt to fetch file \"" + sceneFileName +
                                        "\" returned with error \"" + error + "\"."));

            break;
        }

        case Wray.thread_message.from.marshal.readyToRender().name:
        {
            wrayRenderer.postMessage(Wray.thread_message.to.marshal.render(1000));

            break;
        }

        // Copy the render buffer's pixel data data into a HTML5 canvas for display.
        case Wray.thread_message.from.marshal.renderBuffer().name:
        {
            if (payload.pixels)
            {
                const width = payload.width;
                const height = payload.height;
                const pixelBufferView = new Float64Array(payload.pixels);

                latestImage.width = width;
                latestImage.height = height;
                latestImage.pixels = Array.from(pixelBufferView);

                // Copy the rendering's pixels onto the canvas element.
                {
                    const uiWidth = Math.min((width * wrayUI.settings.pixelSize), document.documentElement.clientWidth);

                    if (!wrayUI.isVisible)
                    {
                        wrayUI.reveal();
                        document.getElementById("wray-init-notice").remove();
                    }
                    
                    wrayUI.elements.canvas.setAttribute("width", width);
                    wrayUI.elements.canvas.setAttribute("height", height);

                    wrayUI.container.style.width = (uiWidth + "px");
                    wrayUI.container.style.height = "auto";

                    // Tonemap the rendered image and paint it onto the UI's canvas.
                    {
                        switch (sceneSettings.tonemapping.model)
                        {
                            default:
                            case "drago-2003":
                            {
                                Wray.tonemappingModels.drago_2003(pixelBufferView,
                                                                  width,
                                                                  height,
                                                                  {...sceneSettings.tonemapping});

                                break;
                            }
                        }
                        
                        const canvasPixelMap = new ImageData(width, height);
                        for (let i = 0; i < (width * height * 4); i++)
                        {
                            canvasPixelMap.data[i] = (pixelBufferView[i] * 255);
                        }

                        const renderContext = wrayUI.elements.canvas.getContext("2d");
                        if (renderContext)
                        {
                            renderContext.putImageData(canvasPixelMap, 0, 0);
                        }
                        else
                        {
                            Wray.log("Failed to obtain the canvas's render context; can't display the rendering.");
                        }
                    }
                }
            }

            // Ask Wray to keep rendering. It'll send us the frame buffer again when it's done.
            if (!Wray.assertionFailedFlag)
            {
                const renderTime = 3500;

                // If the user hasn't paused the rendering, request the thread marshal to
                // render some more. Otherwise, wait until the rendering  isn't paused
                // anymore before asking for more rendering.
                if (!wrayUI.settings.paused)
                {
                    wrayRenderer.postMessage(Wray.thread_message.to.marshal.render(renderTime));
                }
                else
                {
                    const intervalId = setInterval(request_more_rendering, 2000);

                    function request_more_rendering()
                    {
                        if (!wrayUI.settings.paused)
                        {
                            wrayRenderer.postMessage(Wray.thread_message.to.marshal.render(renderTime));
                            clearInterval(intervalId);
                        }
                    }
                }
            }

            break;
        }

        case Wray.thread_message.log().name:
        {
            Wray.log(payload.string);
            
            break;
        }

        case Wray.thread_message.assert().name:
        {
            Wray.assert(payload.condition, payload.failMessage);
            
            break;
        }

        case Wray.thread_message.from.marshal.renderingFailed().name:
        {
            window.alert(`Wray: Rendering failed. Reason: ${payload.why}`);

            break;
        }

        case Wray.thread_message.from.marshal.renderingFinished().name:
        {
            latestImage.averageSamplesPerPixel = payload.avgSamplesPerPixel;

            wrayUI.elements.status.innerHTML = "";
            wrayUI.elements.status.appendChild(document.createTextNode("~" + payload.avgSamplesPerPixel + " sample" +
                                                                       (payload.avgSamplesPerPixel === 1? "" : "s") +
                                                                       " per pixel (" + Math.floor(payload.samplesPerSecond/1000) +
                                                                       "k samples/sec)"));

            wrayRenderer.postMessage(Wray.thread_message.to.marshal.uploadRenderBuffer());

            break;
        }

        default: Wray.log(`Unhandled thread message: ${message.name}`); break;
    }
};

function save_latest_image_to_pfm()
{
    const width = latestImage.width;
    const height = latestImage.height;
    const srcPixels = latestImage.pixels;

    // PFM images only contain the red, green, and blue color channels, but our
    // rendering also includes an alpha channel. So let's remove the alpha.
    const rgbPixels = srcPixels.reduce((pixelArray, pixel, idx)=>
    {
        if (((idx + 1) % 4) !== 0)
        {
            pixelArray.push(pixel);
        }

        return pixelArray;
    }, []);

    // PFM files store pixels from bottom to top rather than top to bottom,
    // so let's flip the image so it displays correctly when exported.
    for (let y = 0; y < (height / 2); y++)
    {
        for (let x = 0; x < width; x++)
        {
            const numColorChannels = 3;
            const idxTop = ((x + y * width) * numColorChannels);
            const idxBottom = ((x + (height - y - 1) * width) * numColorChannels);

            for (let i = 0; i < numColorChannels; i++)
            {
                [rgbPixels[idxTop + i], rgbPixels[idxBottom + i]] = [rgbPixels[idxBottom + i], rgbPixels[idxTop + i]];
            }
        }
    }

    const pfm = Wray.pfm(width, height, rgbPixels, latestImage.averageSamplesPerPixel);
    const pfmDataBlob = new Blob([new Uint8Array(pfm.data())], {type: "application/octet-stream"});
    const randomFileName = new Array(7).fill().map(v=>String.fromCharCode(97 + Math.floor(Math.random() * 25))).join("");

    // Using FileSaver.js.
    saveAs(pfmDataBlob, `${randomFileName}.pfm`);
}

// Loads the given PFM image (provided as a File object), and asks the renderer to
// use the image's pixel data as a basis for the current rendering.
function load_base_pfm_image(pfmFile)
{
    Wray.pfm.from_file(pfmFile)
        .then((pfmImage)=>
        {
            // PFM files store pixels from bottom to top, while the rendered image is
            // top to bottom; so let's flip the PFM image so that it can be correctly
            // appended to the renedering.
            let flippedPixels = Array.from(pfmImage.pixels);
            for (let y = 0; y < (pfmImage.height / 2); y++)
            {
                for (let x = 0; x < pfmImage.width; x++)
                {
                    const numColorChannels = 3;
                    const idxTop = ((x + y * pfmImage.width) * numColorChannels);
                    const idxBottom = ((x + (pfmImage.height - y - 1) * pfmImage.width) * numColorChannels);

                    for (let i = 0; i < numColorChannels; i++)
                    {
                        [flippedPixels[idxTop + i], flippedPixels[idxBottom + i]] = [flippedPixels[idxBottom + i], flippedPixels[idxTop + i]];
                    }
                }
            }

            wrayRenderer.postMessage(Wray.thread_message.to.marshal.appendSamples({
                width: pfmImage.width,
                height: pfmImage.height,
                pixels: flippedPixels,
                avgSamplesPerPixel: pfmImage.averageSampleCount,
            }));
        })
        .catch((error)=>Wray.alert(`Failed to set base PFM image: ${error}`));
}

/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A render sample for Wray. Renders a scene and uses Wray's built-in DOM UI to
 * display the rendering to the user. 
 * 
 */

"use strict";

const wrayUI = Wray.ui(document.getElementById("wray-ui-container"));
const wrayRenderer = new Worker("../distributable/wray-thread-marshal.js");

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
            .then((sceneSettings)=>
            {
                sceneSettings.outputResolution = wrayUI.settings.resolution;
                sceneSettings.renderThreadCount = wrayUI.settings.threadCount;
                
                wrayRenderer.postMessage(Wray.thread_message.to.marshal.assignRenderSettings(sceneSettings));
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
                        Wray.tonemappingModels.drago_2003(pixelBufferView, width, height);

                        const canvasPixelMap = new ImageData(width, height);
                        for (let i = 0; i < (width * height * 4); i++)
                        {
                            canvasPixelMap.data[i] = pixelBufferView[i]*255;
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

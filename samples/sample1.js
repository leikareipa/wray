/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A barebones user interface sample for Wray.
 * 
 */

// Initialize Wray by creating a thread for it to run in.
// Note that we don't yet tell it to start the rendering; we'll do that later down the file, here.
Wray.log("Initializing...");
wrayThread = new Worker("../js/wray/thread-marshal.js");

let numFramesRendered = 0;

// Maps the message handlers from above to incoming messages from Wray's thread.
wrayThread.onmessage = (message)=>
{
    message = message.data;
    const payload = message.payload;

    switch (message.name)
    {
        case Wray.thread_message.from.marshal.threadInitialized().name:
        {
            const sceneFileName = "./assets/sample1/monkey.wray-scene.json";

            Wray.log(`Loading scene from ${sceneFileName}`);
            
            fetch(sceneFileName)
            .then((response)=>response.json())
            .then((sceneSettings)=>
            {
                sceneSettings.outputResolution.width /= Wray.ui.renderDownscale;
                sceneSettings.outputResolution.height /= Wray.ui.renderDownscale;

                // If a mesh's filename was given, assume it's relative and needs an absolute
                // address path prefixed.
                if (typeof sceneSettings.meshFile !== "undefined" &&
                    typeof sceneSettings.meshFile.filename !== "undefined")
                {
                    // Convert Wray's URL into a base path.
                    // E.g. 'http://localhost/wray/index.html?a=2' -> 'http://localhost/wray/'.
                    const lastSlashIdx = window.location.pathname.lastIndexOf('/');
                    Wray.assert((lastSlashIdx >= 0), "Failed to find a trailing forward slash in Wray's base URL.");
                    const basePath = (window.location.origin +
                                      window.location.pathname.substring(0, lastSlashIdx + 1));

                    sceneSettings.meshFile.filename = (basePath + sceneSettings.meshFile.filename);
                }

                wrayThread.postMessage(Wray.thread_message.to.marshal.assignRenderSettings(sceneSettings));
            })
            .catch((error)=>Wray.assert(0, "Attempt to fetch file \"" + sceneFileName +
                                        "\" returned with error \"" + error + "\"."));

            break;
        }

        case Wray.thread_message.from.marshal.readyToRender().name:
        {
            wrayThread.postMessage(Wray.thread_message.to.marshal.render(1000));

            break;
        }

        // Copy the render buffer's pixel data data into a HTML5 canvas for display.
        case Wray.thread_message.from.marshal.renderBuffer().name:
        {
            if (payload.pixels)
            {
                numFramesRendered++;

                const width = payload.width;
                const height = payload.height;
                const pixelBufferView = new Float64Array(payload.pixels);

                // Copy the rendering's pixels onto the canvas element.
                {
                    const uiWidth = Math.min(width * Wray.ui.renderDownscale, document.documentElement.clientWidth);
                    const uiHeight = (uiWidth * (height / width));

                    // If this is our first time receiving data from the renderer, create
                    // an animation that slides the canvas onto the screen.
                    if (Wray.ui.wrayIsInitializing) Wray.ui.reveal_ui();

                    Wray.ui.elements.rendererCanvas.setAttribute("width", width);
                    Wray.ui.elements.rendererCanvas.setAttribute("height", height);

                    Wray.ui.elements.statusContainer.style.width = uiWidth + "px";
                    Wray.ui.elements.rendererCanvas.style.width = uiWidth + "px";
                    Wray.ui.elements.rendererCanvas.style.height = uiHeight + "px";

                    const pixelMap = new ImageData(width, height);
                    for (let i = 0; i < (width * height * 4); i++)
                    {
                        pixelMap.data[i] = pixelBufferView[i]*255;
                    }

                    const renderContext = Wray.ui.elements.rendererCanvas.getContext("2d");
                    if (renderContext) renderContext.putImageData(pixelMap, 0, 0);
                    else Wray.log("Failed to obtain the canvas's render context; can't display the rendering.");
                }
            }

            // Ask Wray to keep rendering. It'll send us the frame buffer again when it's done.
            if (!Wray.assertionFailedFlag) wrayThread.postMessage(Wray.thread_message.to.marshal.render(3000));

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
            Wray.ui.elements.rendererStatus.innerHTML = "";
            Wray.ui.elements.rendererStatus.appendChild(document.createTextNode("~" + payload.avgSamplesPerPixel + " sample" +
                                                                (payload.avgSamplesPerPixel === 1? "" : "s") +
                                                                " per pixel (" + Math.floor(payload.samplesPerSecond/1000) +
                                                                "k samples/sec)"));

            wrayThread.postMessage(Wray.thread_message.to.marshal.uploadRenderBuffer());

            break;
        }

        default: Wray.log(`Unhandled thread message: ${message.name}`); break;
    }
};

Wray.ui = {};

// We'll downscale the image's resolution by this multiplier when rendering it, and upscale
// it by the same amount for display; resulting in other words in fewer but larger pixels.
Wray.ui.renderDownscale = 4;

// Will be set to false once Wray is ready to start rendering.
Wray.ui.wrayIsInitializing = true;

// Pre-fetch the UI's HTML elements.
Wray.ui.elements = Object.freeze(
{
    statusContainer: document.getElementById("wray-status-container"),
    rendererStatus: document.getElementById("wray-status"),
    initNotice: document.getElementById("wray-init-notice"),
    rendererCanvas: document.getElementById("wray-render-target"), // Expected to be a <canvas> element.
});
Wray.assert(Object.getOwnPropertyNames(Wray.ui.elements).every((element)=>(element !== null)),
            "Failed to initialize the UI elements.")

// Will cause a sliding animation to bring the UI (and canvas) onto the screen.
// Prior to this, they're hidden away outside of the window.
Wray.ui.reveal_ui = function()
{
    Wray.ui.wrayIsInitializing = false;

    Wray.ui.elements.statusContainer.style.display = "inline-block";
    Wray.ui.elements.rendererCanvas.style.display = "inline-block";

    Wray.ui.elements.initNotice.remove();

    return;
};

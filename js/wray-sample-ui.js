/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A barebones user interface example for Wray.
 * 
 * Initializes the Wray renderer, feeds it a scene from a JSON file, and draws the resulting
 * rendering into a HTML5 canvas for the user to peruse.
 * 
 * Expects the following elements to be found in its parent HTML's <body>:
 * 
 *      <!-- A note displayed while Wray initializes (i.e. while it's not rendering anything). Will be hidden once rendering starts.-->
 *      <div id="wray-init-notice">
 *          <div id="wray-init-spinner"></div>
 *          <div>initializing wray</div>
 *      </div>
 *
 *      <!-- The rendering goes here.-->
 *      <canvas id="wray-render-target"></canvas><br>
 *      <div id="wray-status-container">
 *          <div id="wray-render-spinner"></div>
 *          <div id="wray-status"></div>
 *      </div>
 * 
 * After which you'd include the following Wray source files:
 * 
 *      <script src="./js/wray/wray.js"></script>
 *      <script src="./js/wray/assert.js"></script>
 *      <script src="./js/wray/log.js"></script>
 *      <script src="./js/wray-sample-ui.js"></script>
 * 
 */

Wray.ui = {};

// We'll downscale the image's resolution by this multiplier when rendering it, and upscale
// it by the same amount for display; resulting in other words in fewer but larger pixels.
Wray.ui.renderDownscale = 1;

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

    Wray.ui.elements.statusContainer.style.visibility = "visible";
    Wray.ui.elements.statusContainer.style.left = "0";

    Wray.ui.elements.rendererCanvas.style.visibility = "visible";
    Wray.ui.elements.rendererCanvas.style.left = "0";

    // Once the sliding is finished...
    Wray.ui.elements.rendererCanvas.addEventListener("transitionend", ()=>
    {
        // We can allow overflow to be shown again, since the canvas element
        // is no longer positioned outside the window (which would otherwise
        // trigger scroll bars to be shown, and we don't want that).
        document.body.style.overflow = "auto";

        Wray.ui.elements.initNotice.remove();
    }, {once:true});
};

// Initialize Wray by creating a thread for it to run in. by creating its thread and telling it what and how we want it to render.
// Note that we don't yet tell it to start the rendering; we'll do that later down the file, here.
Wray.log("Initializing...");
wrayThread = new Worker("./js/wray/main-thread.js");

// Establish handlers for the various messages Wray may send us from its thread.
wrayThread.messageCallbacks =
{
    // Once Wray's thread has finished setting itself up, it'll emit this message.
    /// TODO: Could there be a problem here where the worker thread sends this message before
    ///       we've initialized the callback? I.e. if the thread for whatever initializes faster
    ///       than we can set up these callbacks.
    "wray-has-initialized":()=>
    {
        const sceneFileName = "./assets/scene-descr/monkey.wray-scene.json";

        Wray.log("Loading the scene from '" + sceneFileName + "'...");
        fetch(sceneFileName)
                .then((response)=>response.json())
                .then((sceneJson)=>
                {
                    sceneJson.outputResolution.width /= Wray.ui.renderDownscale;
                    sceneJson.outputResolution.height /= Wray.ui.renderDownscale;

                    // If a mesh's filename was given, assume it's relative and needs the absolute
                    // Location host path prefixed.
                    if (typeof sceneJson.meshFile !== "undefined" &&
                        typeof sceneJson.meshFile.filename !== "undefined")
                    {
                        const basePath = (window.location.origin + window.location.pathname);
                        sceneJson.meshFile.filename = (basePath + sceneJson.meshFile.filename);
                    }

                    wrayThread.postMessage({what:"wray-settings", payload: {...sceneJson}});
                    wrayThread.postMessage({what:"run-renderer", payload:{durationMs:1000}});
                })
                .catch((error)=>Wray.assert(0, "Attempt to fetch file \"" + sceneFileName +
                                            "\" returned with error \"" + error + "\"."));
    },
    // Will be emittd when Wray's thread is sending us its current frame buffer's contents as a
    // pixel array. We'll then copy its data into a HTML5 canvas for display.
    "rendering-upload":(payload)=>
    {
        if (payload.pixels)
        {
            Wray.assert(((payload.width * payload.height * (payload.bpp/8)) === payload.pixels.byteLength),
                        "Invalid pixel buffer dimensions.");

            Wray.assert((payload.bpp === 32), "Expected a 32-bit pixel buffer.");

            const width = payload.width;
            const height = payload.height;
            const pixelBufferView = new Uint8Array(payload.pixels);

            // Copy the rendering's pixels onto the canvas element.
            {
                const uiWidth = Math.min(width*Wray.ui.renderDownscale, document.documentElement.clientWidth-8);
                const uiHeight = uiWidth * (height/width);

                // If this is our first time receiving data from the renderer, create
                // an animation that slides the canvas onto the screen.
                if (Wray.ui.wrayIsInitializing) Wray.ui.reveal_ui();

                Wray.ui.elements.rendererCanvas.setAttribute("width", width);
                Wray.ui.elements.rendererCanvas.setAttribute("height", height);

                Wray.ui.elements.statusContainer.style.width = uiWidth-40 + "px";
                Wray.ui.elements.rendererCanvas.style.width = uiWidth + "px";
                Wray.ui.elements.rendererCanvas.style.height = uiHeight + "px";

                const pixelMap = new ImageData(width, height);
                for (let i = 0; i < (width * height * 4); i++)
                {
                    pixelMap.data[i] = pixelBufferView[i];
                }

                const renderContext = Wray.ui.elements.rendererCanvas.getContext("2d");
                if (renderContext) renderContext.putImageData(pixelMap, 0, 0);
                else Wray.log("Failed to obtain the canvas's render context; can't display the rendering.");
            }
        }

        // Ask Wray to keep rendering. It'll send us the frame buffer again when it's done.
        if (!Wray.assertionFailedFlag) wrayThread.postMessage({what:"run-renderer", payload:{durationMs:2000}});
    },
    "log":(payload)=>
    {
        Wray.log(payload.string);
    },
    "assert":(payload)=>
    {
        Wray.assert(payload.condition, payload.failMessage);
    },
    // Emitted to let us know the speed at which the renderer is running, etc.
    "statistics":(payload)=>
    {
        Wray.ui.elements.rendererStatus.innerHTML = "";
        Wray.ui.elements.rendererStatus.appendChild(document.createTextNode("~" + payload.avg_samples_per_pixel + " sample" +
                                                            (payload.avg_samples_per_pixel === 1? "" : "s") +
                                                            " per pixel (" + Math.floor(payload.samples_per_second/1000) +
                                                            "k samples/sec)"));
    },
};

// Maps the message handlers from above to incoming messages from Wray's thread.
wrayThread.onmessage = (message)=>
{
    wrayThread.messageCallbacks[message.data.what](message.data.payload);
};

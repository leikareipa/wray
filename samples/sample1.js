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
            const sceneFileName = "./assets/sample1/cube-on-floor.wray-scene";

            sampleUI.initialize();

            Wray.log(`Loading scene from ${sceneFileName}...`);
            
            fetch(sceneFileName)
            .then((response)=>response.text())
            .then((sceneSettings)=>
            {
                sceneSettings = Function(`"use strict"; return (${sceneSettings})`)();

                sceneSettings.outputResolution =
                {
                    width: (1280 / sampleUI.settings.pixelSize),
                    height: (720 / sampleUI.settings.pixelSize),
                };

                sceneSettings.renderThreads = (new URLSearchParams(window.location.search).get("threads") || "all");

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
                    const uiWidth = Math.min((width * sampleUI.settings.pixelSize), document.documentElement.clientWidth);

                    if (!sampleUI.isVisible)
                    {
                        sampleUI.reveal();
                        document.getElementById("wray-init-notice").remove();
                    }
                    
                    sampleUI.elements.canvas.setAttribute("width", width);
                    sampleUI.elements.canvas.setAttribute("height", height);

                    sampleUI.container.style.width = (uiWidth + "px");
                    sampleUI.container.style.height = "auto";

                    const pixelMap = new ImageData(width, height);
                    for (let i = 0; i < (width * height * 4); i++)
                    {
                        pixelMap.data[i] = pixelBufferView[i]*255;
                    }

                    const renderContext = sampleUI.elements.canvas.getContext("2d");
                    if (renderContext) renderContext.putImageData(pixelMap, 0, 0);
                    else Wray.log("Failed to obtain the canvas's render context; can't display the rendering.");
                }
            }

            // Ask Wray to keep rendering. It'll send us the frame buffer again when it's done.
            if (!Wray.assertionFailedFlag)
            {
                const renderTime = 3000;

                // If the user hasn't paused the rendering, request the thread marshal to
                // render some more. Otherwise, wait until the rendering  isn't paused
                // anymore before asking for more rendering.
                if (!sampleUI.settings.paused)
                {
                    wrayThread.postMessage(Wray.thread_message.to.marshal.render(renderTime));
                }
                else
                {
                    const intervalId = setInterval(request_more_rendering, 2000);

                    function request_more_rendering()
                    {
                        if (!sampleUI.settings.paused)
                        {
                            wrayThread.postMessage(Wray.thread_message.to.marshal.render(renderTime));
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
            sampleUI.elements.status.innerHTML = "";
            sampleUI.elements.status.appendChild(document.createTextNode("~" + payload.avgSamplesPerPixel + " sample" +
                                                                (payload.avgSamplesPerPixel === 1? "" : "s") +
                                                                " per pixel (" + Math.floor(payload.samplesPerSecond/1000) +
                                                                "k samples/sec)"));

            wrayThread.postMessage(Wray.thread_message.to.marshal.uploadRenderBuffer());

            break;
        }

        default: Wray.log(`Unhandled thread message: ${message.name}`); break;
    }
};

sampleUI =
{
    settings:
    {
        // Whether rendering should be in a paused state.
        paused: false,

        // The render resolution gets scaled down by the inverse of this value, but
        // such that the display resolution is the same as the unscaled render
        // resolution (i.e. the displayed pixels are larger).
        pixelSize: (Math.max(1, Math.min(16, (new URLSearchParams(window.location.search).get("pixelSize") || "1")))),
    },

    container: document.getElementById("wray-ui-container"),

    elements:
    {
        statusContainer:      null,
        controlsContainer:    null,
        status:               null,
        canvas:               null,
        pauseButton:          null,
        pauseButtonLabel:     null,
        pauseButtonContainer: null,
    },

    isVisible: false,

    initialize: function()
    {
        // Create the UI's DOM elements inside the UI container.
        {
            this.elements.canvas               = document.createElement("canvas");
            this.elements.statusContainer      = document.createElement("div");
            this.elements.controlsContainer    = document.createElement("div");
            this.elements.status               = document.createElement("div");
            this.elements.pauseButton          = document.createElement("i");
            this.elements.pauseButtonLabel     = document.createElement("div");
            this.elements.pauseButtonContainer = document.createElement("div");

            Wray.assert(Object.getOwnPropertyNames(this.elements).every((element)=>(element !== null)),
                        "Invalid UI DOM elements!");

            this.elements.canvas              .setAttribute("class", "canvas");
            this.elements.status              .setAttribute("class", "status");
            this.elements.statusContainer     .setAttribute("class", "status-container");
            this.elements.controlsContainer   .setAttribute("class", "controls-container");
            this.elements.pauseButton         .setAttribute("class", "fas fa-fw fa-sm fa-pause");
            this.elements.pauseButtonLabel    .setAttribute("class", "button-label");
            this.elements.pauseButtonContainer.setAttribute("class", "button pause");

            // Add the main elements.
            this.container.appendChild(this.elements.canvas);
            this.container.appendChild(this.elements.statusContainer);

            // Populate the status element.
            {
                this.elements.statusContainer.appendChild(this.elements.status);
                this.elements.statusContainer.appendChild(this.elements.controlsContainer);

                // Add the pause button.
                this.elements.controlsContainer.appendChild(this.elements.pauseButtonContainer);
                this.elements.pauseButtonContainer.appendChild(this.elements.pauseButtonLabel);
                this.elements.pauseButtonContainer.appendChild(this.elements.pauseButton);
            }
        }

        this.elements.pauseButton.pressed = false;
        this.redraw_pause_button();

        this.elements.pauseButton.onclick = ()=>
        {
            this.settings.paused = !this.settings.paused;
            this.redraw_pause_button();
        }

        return;
    },

    reveal: function()
    {
        this.isVisible = true;
        this.container.style.display = "inline-block";

        return;
    },

    redraw_pause_button: function()
    {
        this.elements.pauseButton.setAttribute("class", this.settings.paused
                                                        ? "fas fa-fw fa-sm fa-play"
                                                        : "fas fa-fw fa-sm fa-pause");
        this.elements.pauseButton.setAttribute("title", this.settings.paused
                                                        ? "Resume"
                                                        : "Pause");
        this.elements.pauseButtonLabel.textContent = this.settings.paused
                                                     ? "paused"
                                                     : "";
    },
}

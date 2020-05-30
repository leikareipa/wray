/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * Provides a user interface for rendering. The interface contains a canvas
 * in which the rendered image will be displayed, as well as some metadata
 * about the rendering (like count of samples per second) and some buttons
 * for the user to interact with the renderer (e.g. to pause it).
 * 
 */

"use strict";

// USAGE:
//
//   1. Call Wray.ui() with the DOM container in which you want the UI placed.
//
//   2. Call .initialize() to initialize the UI.
//
//   3. Call .reveal() to make the UI visible on the page.
//
Wray.ui = function(container = null)
{
    Wray.assert((container instanceof HTMLElement), "Invalid UI container.");

    return {
        // If you modify these values while the code is running, make sure to
        // update the UI's state to reflect the new value(s).
        settings:
        {
            // Whether rendering should be in a paused state.
            paused: false,

            // The render resolution gets scaled down by the inverse of this value, but
            // such that the display resolution is the same as the unscaled render
            // resolution (i.e. the displayed pixels are larger).
            pixelSize: (Math.max(1, Math.min(128, (new URLSearchParams(window.location.search).get("pixelSize") || "1")))),

            // The number of threads to render with. Valid values are "all" to use all
            // available threads, "half" to use half of the available threads, or a positive
            // number specifying the exact thread count.
            threadCount: (new URLSearchParams(window.location.search).get("threads") || "all"),
        },

        container: container,

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
    };
}

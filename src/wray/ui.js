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
Wray.ui = function(container = null,
                   callbacks = {})
{
    Wray.assert((container instanceof HTMLElement), "Invalid UI container.");

    callbacks = {
        ...{
            // Called when the user asks to save the current rendering into a PFM file.
            save_fpm: ()=>{Wray.warning("Unimplemented callback.")},

            // Called when the user asks to load an FPM image as the basis for the current
            // rendering. Takes one parameter: a File object corresponding to the PFM image
            // file that the user has chosen via an <input> field.
            load_fpm: (file)=>{Wray.warning("Unimplemented callback.")},
        },
        ...callbacks,
    };

    const urlParams = new URLSearchParams(window.location.search);

    // The render resolution gets scaled down by the inverse of this value, but
    // such that the display resolution is the same as the unscaled render
    // resolution (i.e. the displayed pixels are larger).
    const pixelSize = (Math.max(1, Math.min(128, ~~(urlParams.get("pixelSize") || "1"))));

    // The pixel size of the rendered image when displayed. The resolution in
    // which the image is rendered is (resolution / pixelSize). Note that the
    // given resolution will be adjusted so that the width and height divided
    // by the pixel size result in integers.
    const resolution = (()=>
    {
        const userSuppliedValue = (urlParams.get("resolution") || "1280x720").replace(/\s+/g, "");
        const [width, height] = userSuppliedValue.split("x");

        return {
            width: ~~((~~Number(width) || 1280) / pixelSize),
            height: ~~((~~Number(height) || 720) / pixelSize),
        }
    })();

    // The number of threads to render with. Valid values are "all" to use all
    // available threads, "half" to use half of the available threads, or a positive
    // number specifying the exact thread count.
    const threadCount = (urlParams.get("threads") || "all");

    return {
        // If you modify these values while the code is running, make sure to
        // update the UI's state to reflect the new value(s).
        settings:
        {
            // Whether rendering should be in a paused state.
            paused: false,

            pixelSize: pixelSize,
            resolution: resolution,
            threadCount: threadCount,
        },

        container: container,

        elements:
        {
            statusContainer:        null,
            controlsContainerLeft:  null,
            controlsContainerRight: null,
            status:                 null,
            canvas:                 null,
            pauseButton:            null,
            pauseButtonLabel:       null,
            pauseButtonContainer:   null,
            menuButtonContainer:    null,
            menuButton:             null,
            menu:                   null,
        },

        isVisible: false,

        initialize: function()
        {
            // Create the UI's DOM elements inside the UI container.
            {
                this.elements.canvas                 = document.createElement("canvas");
                this.elements.statusContainer        = document.createElement("div");
                this.elements.controlsContainerLeft  = document.createElement("div");
                this.elements.controlsContainerRight = document.createElement("div");
                this.elements.status                 = document.createElement("div");
                this.elements.pauseButton            = document.createElement("i");
                this.elements.pauseButtonLabel       = document.createElement("div");
                this.elements.pauseButtonContainer   = document.createElement("div");
                this.elements.menuButtonContainer    = document.createElement("div");
                this.elements.menuButton             = document.createElement("i");
                this.elements.menu                   = document.createElement("div");

                Wray.assert(Object.getOwnPropertyNames(this.elements).every((element)=>(element !== null)),
                            "Invalid UI DOM elements!");

                this.elements.canvas                .setAttribute("class", "canvas");
                this.elements.status                .setAttribute("class", "status");
                this.elements.statusContainer       .setAttribute("class", "status-container");
                this.elements.controlsContainerLeft .setAttribute("class", "controls-container left");
                this.elements.controlsContainerRight.setAttribute("class", "controls-container right");
                this.elements.pauseButton           .setAttribute("class", "fas fa-fw fa-sm fa-pause");
                this.elements.pauseButtonLabel      .setAttribute("class", "button-label");
                this.elements.pauseButtonContainer  .setAttribute("class", "button pause");
                this.elements.menuButton            .setAttribute("class", "fas fa-fw fa-sm fa-bars");
                this.elements.menuButtonContainer   .setAttribute("class", "button menu");
                this.elements.menu                  .setAttribute("class", "dropdown-menu");

                // Add the main elements.
                this.container.appendChild(this.elements.canvas);
                this.container.appendChild(this.elements.statusContainer);

                // Populate the status element.
                {
                    this.elements.statusContainer.appendChild(this.elements.status);
                    this.elements.statusContainer.appendChild(this.elements.controlsContainerLeft);
                    this.elements.statusContainer.appendChild(this.elements.controlsContainerRight);

                    // Add the menu button.
                    this.elements.controlsContainerRight.appendChild(this.elements.menuButtonContainer);
                    this.elements.menuButtonContainer.appendChild(this.elements.menuButton);

                    // Add the pause button.
                    this.elements.controlsContainerRight.appendChild(this.elements.pauseButtonContainer);
                    this.elements.pauseButtonContainer.appendChild(this.elements.pauseButtonLabel);
                    this.elements.pauseButtonContainer.appendChild(this.elements.pauseButton);

                    // Create the menu button's menu.
                    {
                        this.elements.menuButtonContainer.appendChild(this.elements.menu);
                        
                        const savePFM = document.createElement("div");
                        savePFM.setAttribute("class", "dropdown-menu-element");
                        savePFM.appendChild(document.createTextNode("Save as PFM"));
                        this.elements.menu.appendChild(savePFM);

                        const continueFromPFM = document.createElement("div");
                        continueFromPFM.setAttribute("class", "dropdown-menu-element");
                        continueFromPFM.appendChild(document.createTextNode("Continue from PFM..."));
                        this.elements.menu.appendChild(continueFromPFM);
                        
                        // A file-opening dialog to allow the user to select a PFM file. This
                        // will be an invisible DOM element, i.e. it's not added to the DOM as
                        // such - it just has its click() function called when we want to bring
                        // up the selector dialog.
                        const fpmSelector = document.createElement("input");
                        fpmSelector.setAttribute("type", "file");
                        fpmSelector.setAttribute("accept", ".pfm");
                        fpmSelector.onchange = ()=>
                        {
                            if (fpmSelector.files.length)
                            {
                                callbacks.load_fpm(fpmSelector.files[0]);
                            }

                            // Reset the selection, so the user can select the same file twice.
                            fpmSelector.value = "";
                        }

                        continueFromPFM.onclick = ()=>
                        {
                            this.close_menu();

                            // Ask the user to select a file. When the selector's onchange() detects
                            // that a file has been selected, it will inform the proper callback
                            // function.
                            fpmSelector.click();
                        }

                        savePFM.onclick = ()=>
                        {
                            this.close_menu();
                            callbacks.save_pfm();
                        }
                    }
                }
            }

            // Give the pause button a click handler.
            {
                this.elements.pauseButton.pressed = false;
                this.redraw_pause_button();

                this.elements.pauseButton.onclick = ()=>
                {
                    this.settings.paused = !this.settings.paused;
                    this.redraw_pause_button();

                    this.close_menu();
                    this.redraw_menu_button();
                }
            }

            // Give the menu button a click handler.
            {
                this.elements.menuButton.pressed = false;
                this.redraw_menu_button();

                this.elements.menuButton.onclick = ()=>
                {
                    this.elements.menuButton.pressed = !this.elements.menuButton.pressed;
                    this.redraw_menu_button();
                }
            }

            return;
        },

        reveal: function()
        {
            this.isVisible = true;
            this.container.style.display = "inline-block";
        },

        close_menu: function()
        {
            this.elements.menuButton.pressed = false;
            this.redraw_menu_button();
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
                                                         ? "PAUSED"
                                                         : "";
        },

        redraw_menu_button: function()
        {
            this.elements.menuButtonContainer.style.visibility = this.settings.paused
                                                                 ? "hidden"
                                                                 : "visible";

            const isPressed = this.elements.menuButton.pressed;

            this.elements.menuButton.setAttribute("class", this.settings.paused
                                                            ? `fas fa-fw fa-sm fa-bars ${isPressed? "active" : ""}`
                                                            : `fas fa-fw fa-sm fa-bars ${isPressed? "active" : ""}`);
            this.elements.menuButton.setAttribute("title", this.settings.paused
                                                            ? "Options"
                                                            : "Options");
            this.elements.menu.style.visibility = isPressed
                                                  ? "visible"
                                                  : "hidden";
        },
    };
}

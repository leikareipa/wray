// WHAT: Concatenated JavaScript source files
// PROGRAM: Wray
// VERSION: live (30 May 2020 19:41:45 UTC)
// AUTHOR: Tarpeeksi Hyvae Soft
// LINK: https://www.github.com/leikareipa/wray/
// LINK: https://www.tarpeeksihyvaesoft.com/
// FILES:
//	./js/wray/wray.js
//	./js/wray/ui.js
//	./js/wray/thread-message.js
//	./js/wray/assert.js
//	./js/wray/log.js
//	./js/wray/matrix44.js
//	./js/wray/color.js
//	./js/wray/vertex.js
//	./js/wray/vector.js
//	./js/wray/ray.js
//	./js/wray/surface.js
//	./js/wray/sky.js
//	./js/wray/material.js
//	./js/wray/triangle.js
//	./js/wray/camera.js
//	./js/wray/bvh.js
/////////////////////////////////////////////////

/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

// Master namespace.
const Wray = {};

Wray.epsilon = 0.000001;
Wray.maxRayDepth = 20;

// Returns false if the caller is (likely) running inside a Web Worker thread; and true otherwise.
Object.defineProperty(Wray, "in_window_thread", {value:()=>(Boolean(typeof importScripts !== "function")), writable:false});
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
/*
 * 2019, 2020 Tarpeeksi Hyvae Soft
 *
 * Software: Wray
 * 
 * A wrapper for messages sent to and from Wray's worker thread via postMessage().
 * 
 */

"use strict";

Wray.thread_message_body = function(name = "", payload = {})
{
    const publicInterface =
    {
        name,
        payload
    };

    return publicInterface;
}

Wray.thread_message =
{
    // Can be sent to the main thread to ask it to log the given string (e.g.
    // into the console).
    log: (string = "")=>Wray.thread_message_body("thread-log", {string}),

    // Can be sent to the main thread to ask it to assert the given condition.
    // The given failure message will be used if the assertion fails.
    assert: (condition = (1 === 1), failMessage = "")=>Wray.thread_message_body("thread-assert", {condition, failMessage}),

    to:
    {
        marshal:
        {
            // Ask the marshal to render the current scene for the given number of
            // milliseconds.
            render: (durationMs = 1000)=>Wray.thread_message_body("marshal-render", {durationMs}),
    
            // Tell the marshal to adopt the given render settings, e.g. resolution.
            assignRenderSettings: (settings = {})=>Wray.thread_message_body("marshal-assign-render-settings", settings),

            // Ask the marshal to send a copy of its render buffer to the parent
            // thread.
            uploadRenderBuffer: ()=>Wray.thread_message_body("marshal-upload-render-buffer"),
        },

        worker:
        {
            // Ask the worker to render the current scene for the given number of
            // milliseconds.
            render: (durationMs = 1000)=>Wray.thread_message_body("worker-render", {durationMs}),

            // Tell a worker to adopt the given id, with which this worker can then be
            // told apart from other workers.
            setId: (id = null)=>Wray.thread_message_body("worker-set-id", {id}),

            // Tell the worker to adopt the given render settings, e.g. resolution.
            assignRenderSettings: (settings = {})=>Wray.thread_message_body("worker-assign-render-settings", settings),

            // Ask the worker to send a copy of its render buffer to the parent
            // thread.
            uploadRenderBuffer: ()=>Wray.thread_message_body("worker-upload-render-buffer"),
        },
    },

    from:
    {
        marshal:
        {
            // Sent by the marshal to inform the parent thread that the marshal has
            // finished rendering.
            renderingFinished: ()=>Wray.thread_message_body("marshal-rendering-finished"),

            // Sent by a marshal thread when it has finished initializing itself and
            // is thus ready to accept messages.
            threadInitialized: ()=>Wray.thread_message_body("marshal-thread-initialized"),

            // Sent by a marshal thread to inform its parent that the marshal is now
            // ready to begin rendering.
            readyToRender: ()=>Wray.thread_message_body("marshal-ready-to-render"),

            // Sent by a marshal to upload its render buffer to the parent thread.
            renderBuffer: (renderBuffer = {})=>Wray.thread_message_body("marshal-render-buffer", renderBuffer),

            // Sent by a marshal if it fails to properly initialize its worker threads.
            workerInitializationFailed: (why = "")=>Wray.thread_message_body("marshal-worker-initialization-failed", {why}),

            // Sent by a marshal thread to inform its parent that it has failed to
            // render.
            renderingFailed: (why = "")=>Wray.thread_message_body("marshal-rendering-failed", {why}),

            // Sent by a marshal thread to inform its parent that it has finished
            // its requested rendering. (The parent might then e.g. send a message
            // to the marshal to have the marshal upload its render buffer.)
            renderingFinished: (avgSamplesPerPixel = 0, samplesPerSecond = 0)=>Wray.thread_message_body("marshal-rendering-finished", {avgSamplesPerPixel, samplesPerSecond}),
        },

        worker:
        {
            // Sent by a worker thread when it has finished initializing itself and
            // is thus ready to accept messages.
            threadInitialized: ()=>Wray.thread_message_body("worker-thread-initialized"),

            // Sent by a worker thread to inform its parent that the worker is now
            // ready to begin rendering.
            readyToRender: (workerId = -1)=>Wray.thread_message_body("worker-ready-to-render", {workerId}),

            // Sent by a worker to upload its render buffer to the parent thread.
            renderBuffer: (workerId = -1, renderBuffer = {})=>Wray.thread_message_body("worker-render-buffer", {workerId, ...renderBuffer}),

            // Sent by a worker thread to inform its parent that it has failed to
            // render.
            renderingFailed: (workerId = -1, why = "")=>Wray.thread_message_body("worker-rendering-failed", {workerId, why}),

            // Sent by a worker thread to inform its parent that it has finished
            // its requested rendering. (The parent might then e.g. send a message
            // to the worker to have the worker upload its render buffer.)
            renderingFinished: (workerId = -1, avgSamplesPerPixel = 0, samplesPerSecond = 0)=>Wray.thread_message_body("worker-rendering-finished", {workerId, avgSamplesPerPixel, samplesPerSecond}),
        },
    },
};
/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

// Bails noisily with the given failure message if the given condition is false.
Wray.assert = function(condition = false, failMessage = "")
{
    if ((typeof failMessage !== "string") || (failMessage.length < 1))
    {
        Wray.assert(0, "Empty assertion messages are discouraged.");
    }

    if (!condition)
    {
        if (!Wray.assertionFailedFlag)
        {
            Object.defineProperty(Wray, "assertionFailedFlag", {value:true, writable:false});
            
            if (Wray.in_window_thread())
            {
                alert("Wray assertion: " + failMessage);
                throw Error("Wray assertion: " + failMessage);
            }
            else
            {
                postMessage(Wray.thread_message.assert(condition, failMessage));
            }
        }
        else
        {
            Wray.error("Assertion failure (ignored): " + failMessage);
        }
    }
}
/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

Wray.warning = function(string = "")
{
    Wray.log(string, "warning");
}

Wray.error = function(string = "")
{
    Wray.log(string, "error");
}

Wray.log = function(string = "", priority = "normal")
{
    string = String(string);

    if (string.length < 1)
    {
        Wray.assert(0, "Empty log messages are discouraged.");
    }

    if (Wray.in_window_thread())
    {
        const logger_fn = (()=>
        {
            switch (priority)
            {
                default: case "normal": return console.log;
                case "warning": return console.warn;
                case "error": return console.error;
            }
        })();

        logger_fn(`Wray: ${string}`);
    }
    else
    {
        postMessage(Wray.thread_message.log(string));
    }
}
/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Retro n-gon renderer
 *
 * 4-by-4 matrix manipulation.
 * 
 * Adapted and modified from code written originally by Benny Bobaganoosh for his 3d software
 * renderer (https://github.com/BennyQBD/3DSoftwareRenderer). Full attribution:
 * {
 *     Copyright (c) 2014, Benny Bobaganoosh
 *     All rights reserved.
 *
 *     Redistribution and use in source and binary forms, with or without
 *     modification, are permitted provided that the following conditions are met:
 *
 *     1. Redistributions of source code must retain the above copyright notice, this
 *         list of conditions and the following disclaimer.
 *     2. Redistributions in binary form must reproduce the above copyright notice,
 *         this list of conditions and the following disclaimer in the documentation
 *         and/or other materials provided with the distribution.
 *
 *     THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
 *     ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 *     WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 *     DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT OWNER OR CONTRIBUTORS BE LIABLE FOR
 *     ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 *     (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 *     LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 *     ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 *     (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
 *     SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 * }
 *
 */

"use strict";

// Provides manipulation of 4-by-4 matrices.
Wray.matrix44 = (()=>
{
    return Object.freeze(
    {
        identity: function()
        {
            return Object.freeze([1, 0, 0, 0,
                                  0, 1, 0, 0,
                                  0, 0, 1, 0,
                                  0, 0, 0, 1]);
        },

        scale: function(x = 0, y = 0, z = 0)
        {
            return Object.freeze([x, 0, 0, 0,
                                  0, y, 0, 0,
                                  0, 0, z, 0,
                                  0, 0, 0, 1]);
        },

        translate: function(x = 0, y = 0, z = 0)
        {
            return Object.freeze([1, 0, 0, 0,
                                  0, 1, 0, 0,
                                  0, 0, 1, 0,
                                  x, y, z, 1]);
        },

        rotate: function(x = 0, y = 0, z = 0)
        {
            const mx = [1,            0,            0,            0,
                        0,            Math.cos(x),  -Math.sin(x), 0,
                        0,            Math.sin(x),  Math.cos(x),  0,
                        0,            0,            0,            1];

            const my = [Math.cos(y),  0,            -Math.sin(y), 0,
                        0,            1,            0,            0,
                        Math.sin(y),  0,             Math.cos(y), 0,
                        0,            0,            0,            1];

            const mz = [Math.cos(z),  -Math.sin(z), 0,            0,
                        Math.sin(z),  Math.cos(z),  0,            0,
                        0,            0,            1,            0,
                        0,            0,            0,            1];

            const temp = Wray.matrix44.matrices_multiplied(my, mz);
            const mResult = Wray.matrix44.matrices_multiplied(temp, mx);

            Wray.assert((mResult.length === 16), "Expected a 4 x 4 matrix.");
            return Object.freeze(mResult);
        },

        perspective: function(fov = 0, aspectRatio = 0, zNear = 0, zFar = 0)
        {
            const fovHalf = Math.tan(fov / 2);
            const zRange = (zNear - zFar);

            return Object.freeze([(1 / (fovHalf * aspectRatio)), 0,             0,                             0,
                                   0,                            (1 / fovHalf), 0,                             0,
                                   0,                            0,             ((-zNear - zFar) / zRange),    1,
                                   0,                            0,             (2 * zFar * (zNear / zRange)), 0]);
        },

        screen_space: function(width = 0, height = 0)
        {
            return Object.freeze([(width/2),     0,              0, 0,
                                  0,             -(height/2),    0, 0,
                                  0,             0,              1, 0,
                                  (width/2)-0.5, (height/2)-0.5, 0, 1]);
        },
        
        matrices_multiplied: function(m1 = [], m2 = [])
        {
            Wray.assert(((m1.length === 16) && (m2.length === 16)), "Expected 4 x 4 matrices.");

            let mResult = [];
            for (let i = 0; i < 4; i++)
            {
                for (let j = 0; j < 4; j++)
                {
                    mResult[i + (j * 4)] = (m1[i + (0 * 4)] * m2[0 + (j * 4)]) +
                                           (m1[i + (1 * 4)] * m2[1 + (j * 4)]) +
                                           (m1[i + (2 * 4)] * m2[2 + (j * 4)]) +
                                           (m1[i + (3 * 4)] * m2[3 + (j * 4)]);
                }
            }

            Wray.assert((mResult.length === 16), "Expected a 4 x 4 matrix.");
            return Object.freeze(mResult);
        },
    });
})();
/*
 * Tarpeeksi Hyvae Soft 2019 /
 *
 */

"use strict";

// Mainly intended for RGB in the range 0..1.
Wray.color_rgb = function(red = 0.5, green = 0.5, blue = 0.5)
{
    const publicInterface = Object.freeze(
    {
        red,
        green,
        blue,

        clamped: function(min = 0, max = 1)
        {
            return Wray.color_rgb(Math.max(Math.min(max, red), min),
                                  Math.max(Math.min(max, green), min),
                                  Math.max(Math.min(max, blue), min));
        },
        
        normalized: function()
        {
            const v = Wray.vector3(red, green, blue).normalized();
            return Wray.color_rgb(v.x, v.y, v.z);
        },
    });
    return publicInterface;
}
/*
 * Tarpeeksi Hyvae Soft 2020 /
 * 
 */

"use strict";

Wray.vertex = function(position = Wray.vector3(0, 0, 0), normal = null)
{
    const publicInterface = Object.freeze(
    {
        x: position.x,
        y: position.y,
        z: position.z,
        position,
        normal,
    });

    return publicInterface;
}
/*
 * Tarpeeksi Hyvae Soft 2019 /
 * 
 */

"use strict";

Wray.vector3 = function(x = 0, y = 0, z = 0)
{
    Wray.assert((typeof x === "number" && typeof y === "number" && typeof z === "number"),
                "Expected numbers as parameters to the vector3 factory.");

    const publicInterface = Object.freeze(
    {
        x,
        y,
        z,

        // Expects a 4 x 4 matrix.
        rotated_by_matrix: function(m44 = [])
        {
            const x0 = ((m44[0] * x) + (m44[4] * y) + (m44[ 8] * z));
            const y0 = ((m44[1] * x) + (m44[5] * y) + (m44[ 9] * z));
            const z0 = ((m44[2] * x) + (m44[6] * y) + (m44[10] * z));

            return Wray.vector3(x0, y0, z0);
        },

        sub: function(other = {})
        {
            return Wray.vector3((x - other.x), (y - other.y), (z - other.z));
        },

        cross: function(other = {})
        {
            return Wray.vector3(((y * other.z) - (z * other.y)),
                                ((z * other.x) - (x * other.z)),
                                ((x * other.y) - (y * other.x)));
        },

        dot: function(other = {})
        {
            return ((x * other.x) + (y * other.y) + (z * other.z));
        },

        // Returns a normalized copy of the vector.
        normalized: function()
        {
            const sn = (Math.sqrt((x * x) + (y * y) + (z * z)) || 1);

            return Wray.vector3((x / sn), (y / sn), (z / sn));
        },

        scaled: function(scale = Wray.vector3())
        {
            return Wray.vector3((x * scale.x), (y * scale.y), (z * scale.z));
        },

        reversed: function()
        {
            return Wray.vector3(x*-1, y*-1, z*-1);
        }
    });

    return publicInterface;
}
/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

Wray.ray = function(pos = Wray.vector3(0, 0, 0), dir = Wray.vector3(0, 0, 1))
{
    const publicInterface = Object.freeze(
    {
        pos,
        dir,

        // Convenience functions for altering the ray's direction.
        aimAt: Object.freeze(
        {
            direction: function(direction = Wray.vector3())
            {
                return Wray.ray(pos, direction);
            },

            // Returns a ray at this position but pointed at a random direction about
            // the hemisphere of the given normal.
            random_in_hemisphere: function(normal = Wray.vector3())
            {
                let newDir = Wray.vector3((Math.random() - Math.random()),
                                          (Math.random() - Math.random()),
                                          (Math.random() - Math.random())).normalized();

                if (normal.dot(newDir) < 0)
                {
                    newDir = Wray.vector3((newDir.x * -1),
                                          (newDir.y * -1),
                                          (newDir.z * -1));
                }
                
                return Wray.ray(pos, newDir);
            },

            // Returns a ray at this position but pointed at a random direction about
            // the hemisphere of the given normal. The direction is cosine-weighted,
            // i.e. more likely to be closer to the normal.
            random_in_hemisphere_cosine_weighted: function(normal = Wray.vector3())
            {
                const rand1 = Math.random();
                const rand2 = Math.random();

                // Adapted from http://www.rorydriscoll.com/2009/01/07/better-sampling/.
                // Get a cosine-weighted vector (x, y, z) about the hemisphere.
                const r = Math.sqrt(rand1);
                const theta = (2 * Math.PI * rand2);
                const x = (r * Math.cos(theta));
                const y = Math.sqrt(Math.max(0, 1 - rand1));
                const z = (r * Math.sin(theta));

                // Adapted from https://bheisler.github.io/post/writing-gpu-accelerated-path-tracer-part-2/.
                // Transform the cosine-weighted vector's hemisphere to the direction of
                // the normal.
                const t = (Math.abs(normal.x) > Math.abs(normal.y))
                          ? Wray.vector3(normal.z, 0, -normal.x).normalized()
                          : Wray.vector3(0, -normal.z, normal.y).normalized();
                const b = normal.cross(t);
                const newDir = Wray.vector3((x * b.x + y * normal.x + z * t.x),
                                            (x * b.y + y * normal.y + z * t.y),
                                            (x * b.z + y * normal.z + z * t.z)).normalized();
                                
                return Wray.ray(pos, newDir);
            },

            reflected: function(normal = Wray.vector3())
            {
                const dot = normal.dot(dir);
                return Wray.ray(pos, Wray.vector3((2 * dot * normal.x - dir.x),
                                                  (2 * dot * normal.y - dir.y),
                                                  (2 * dot * normal.z - dir.z)).reversed());
            },
        }),

        // Returns a ray moved forward from this position in this direction by the given amount.
        step: function(stepSize = 0, inDirection = dir)
        {
            return Wray.ray(Wray.vector3((pos.x + (inDirection.x * stepSize)),
                                         (pos.y + (inDirection.y * stepSize)),
                                         (pos.z + (inDirection.z * stepSize))), dir);
        },

        // Returns the ray's distance to its corresponding intersection point on the given triangle;
        // or null if the ray doesn't intersect the triangle.
        // Adapted from Moller & Trumbore 1997: "Fast, minimum storage ray/triangle intersection".
        intersect_triangle: function(triangle = Wray.triangle())
        {
            const ray = this;
            const noHit = [null, 0, 0];

            const e1 = triangle.vertices[1].position.sub(triangle.vertices[0].position);
            const e2 = triangle.vertices[2].position.sub(triangle.vertices[0].position);

            const pv = ray.dir.cross(e2);
            const det = e1.dot(pv);
            if ((det > -Wray.epsilon) && (det < Wray.epsilon)) return noHit;

            const invD = 1.0 / det;
            const tv = ray.pos.sub(triangle.vertices[0].position);
            const u = (tv.dot(pv) * invD);
            if ((u < 0) || (u > 1)) return noHit;

            const qv = tv.cross(e1);
            const v = (ray.dir.dot(qv) * invD);
            if ((v < 0) || ((u + v) > 1)) return noHit;

            const distance = (e2.dot(qv) * invD);
            if (distance <= 0) return noHit; 

            return [distance, u, v];
        },

        // Adapted from https://tavianator.com/fast-branchless-raybounding-box-intersections/.
        intersect_aabb: function(aabb = Wray.bvh_aabb())
        {
            const ray = this;

            const dirX = 1/ray.dir.x;
            const dirY = 1/ray.dir.y;
            const dirZ = 1/ray.dir.z;

            const tx1 = (aabb.min.x - ray.pos.x) * dirX;
            const tx2 = (aabb.max.x - ray.pos.x) * dirX;
            let tmin = Math.min(tx1, tx2);
            let tmax = Math.max(tx1, tx2);

            const ty1 = (aabb.min.y - ray.pos.y) * dirY;
            const ty2 = (aabb.max.y - ray.pos.y) * dirY;
            tmin = Math.max(tmin, Math.min(ty1, ty2));
            tmax = Math.min(tmax, Math.max(ty1, ty2));

            const tz1 = (aabb.min.z - ray.pos.z) * dirZ;
            const tz2 = (aabb.max.z - ray.pos.z) * dirZ;
            tmin = Math.max(tmin, Math.min(tz1, tz2));
            tmax = Math.min(tmax, Math.max(tz1, tz2));

            return (tmax >= 0 && tmax >= tmin);
        },

        // Traces the ray recursively through the given BVH. Returns null if no triangle in
        // the BVH was intersected; and otherwise an object containing the triangle that was
        // intersected and the distance to the point of intersection on it along the ray.
        intersect_bvh: function(bvh = Wray.bvh())
        {
            const ray = this;

            const intersectionInfo = {
                triangle: null,
                distance: Infinity,
                u: 0,
                v: 0,
                w: 0,
            };

            (function trace(aabb = Wray.bvh_aabb())
            {
                if (aabb.isLeaf)
                {
                    for (const triangle of aabb.triangles)
                    {
                        const [distance, u, v] = ray.intersect_triangle(triangle);

                        if ((distance !== null) && (distance < intersectionInfo.distance))
                        {
                            intersectionInfo.triangle = triangle;
                            intersectionInfo.distance = distance;
                            intersectionInfo.u = u;
                            intersectionInfo.v = v;
                            intersectionInfo.w = (1 - u - v);
                        }
                    }

                    return;
                }

                if (ray.intersect_aabb(aabb.mutable.left)) trace(aabb.mutable.left);
                if (ray.intersect_aabb(aabb.mutable.right)) trace(aabb.mutable.right);
            })(bvh.base);

            return (intersectionInfo.triangle === null? null : intersectionInfo);
        },

        // Returns the combined color of this ray's random scatterings in the given scene. The ray's
        // scattering will be terminated either when it hits a light source, or when it has scattered
        // the maximum number of times.
        trace: function(sceneBVH = Wray.bvh_aabb(), depth = 0)
        {
            const ray = this;

            // Find the closest triangle this ray intersects.
            const intersected = ray.intersect_bvh(sceneBVH);
            const material = intersected? intersected.triangle.material : null;

            // See whether there's reason to terminate the ray.
            {
                if (!intersected) return Wray.sky_color(ray.dir);

                if (material.isEmissive) return material.emission;

                if (depth >= Wray.maxRayDepth) return Wray.color_rgb(0, 0, 0);
            }

            // Otherwise, cast out a new ray from the current intersection point.
            {
                const interpolatedNormal = Wray.vector3((intersected.triangle.vertices[0].normal.x * intersected.w) +
                                                        (intersected.triangle.vertices[1].normal.x * intersected.u) +
                                                        (intersected.triangle.vertices[2].normal.x * intersected.v),
                                                        (intersected.triangle.vertices[0].normal.y * intersected.w) +
                                                        (intersected.triangle.vertices[1].normal.y * intersected.u) +
                                                        (intersected.triangle.vertices[2].normal.y * intersected.v),
                                                        (intersected.triangle.vertices[0].normal.z * intersected.w) +
                                                        (intersected.triangle.vertices[1].normal.z * intersected.u) +
                                                        (intersected.triangle.vertices[2].normal.z * intersected.v)).normalized();
                                                        
                const rayAtIntersection = ray.step(intersected.distance).step(Wray.epsilon, intersected.triangle.faceNormal);
                const {outRay, bsdf} = intersected.triangle.material.scatter(rayAtIntersection, interpolatedNormal);
                const inLight = outRay.trace(sceneBVH, depth + 1);
                return Wray.color_rgb(inLight.red*bsdf * material.color.red,
                                      inLight.green*bsdf * material.color.green,
                                      inLight.blue*bsdf * material.color.blue);
            }
        }
    });
    return publicInterface;
}
/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A rendering surface, i.e. a pixel buffer with attached convenience functions for
 * rendering and display.
 * 
 */

"use strict";

Wray.surface = function(width = 1280, height = 720)
{
    Wray.assert((typeof width === "number" && typeof height === "number"),
                "Expected width and height to be numeric values.");
    Wray.assert((width > 0 && height > 0), "Invalid width and/or height for the render surface.");

    // A pixel buffer that covers the size of the surface.
    const pixelBuffer = (new Array(width * height)).fill().map((element, idx)=>(
    {
        // Pixel x,y coordinates.
        x: (idx % width),
        y: Math.floor(idx / width),

        // Accumulated color channel values, incremented each time a new ray
        // is sampled for this pixel. The range 0..1 here corresponds to 0..255.
        red: 0, green: 0, blue: 0,

        // Over how many samples the RGB values have been accumulated.
        numSamples: 1,
    }));
    wipe_surface();

    // Reset all of the surface's pixels to default initial values.
    function wipe_surface()
    {
        pixelBuffer.forEach((pixel)=>
        {
            pixel.red = 0;
            pixel.green = 0;
            pixel.blue = 0;

            pixel.numSamples = 0;
        });
    };

    const publicInterface = Object.freeze(
    {
        width,
        height,

        wipe: wipe_surface,

        // Returns a Transferable pixel buffer array of this render surface.
        transferable_pixel_array: function()
        {
            const pixelArray = new Float64Array(width * height * 4);

            for (const pixel of pixelBuffer)
            {
                const idx = ((pixel.x + pixel.y * width) * 4);
                const color = this.pixel_color_at(pixel.x, pixel.y);

                pixelArray[idx+0] = color.red;
                pixelArray[idx+1] = color.green;
                pixelArray[idx+2] = color.blue;
                pixelArray[idx+3] = 1;
            }

            return {pixelArray, width, height};
        },

        // Returns the average number of samples per pixel on this surface.
        average_sample_count: function()
        {
            const sampleCounts = pixelBuffer.map(element=>element.numSamples).sort();
            return sampleCounts[sampleCounts.length/2];
        },

        // Flatten out all accumulated color data in the surface pixel buffer.
        clamp_accumulated: function()
        {
            pixelBuffer.forEach((pixel)=>
            {
                const color = this.pixel_color_at(pixel.x, pixel.y);
                pixel.red = color.red;
                pixel.green = color.green;
                pixel.blue = color.blue;
                pixel.numSamples = 1;
            });
        },

        // Accumulates the given color to the color buffer's x,y element.
        accumulate_to_pixel_at: function(x = 0, y = 0, color = Wray.color_rgb())
        {
            const pixel = pixelBuffer[x+y*width];
            Wray.assert((pixel != null), "Detected an attempt to access an invalid element in the surface color buffer.");

            pixel.red += color.red;
            pixel.green += color.green;
            pixel.blue += color.blue;
            pixel.numSamples++;
        },

        // Returns the color buffer's x,y element as an RGB object.
        pixel_color_at: function(x = 0, y = 0)
        {
            const pixel = pixelBuffer[x+y*width];
            Wray.assert((pixel != null), "Detected an attempt to access an invalid element in the surface color buffer.");

            return Wray.color_rgb(pixel.red / (pixel.numSamples || 1),
                                  pixel.green / (pixel.numSamples || 1),
                                  pixel.blue / (pixel.numSamples || 1));
        },

        // Draws the contents of the surface's pixel buffer onto the given HTML5 canvas.
        display_on_canvas: function(canvasElementId = "")
        {
            const canvasElement = document.getElementById(canvasElementId);
            Wray.assert((canvasElement !== null), "Can't find the given canvas to draw the surface's contents onto.");

            canvasElement.setAttribute("width", width);
            canvasElement.setAttribute("height", height);

            const renderContext = canvasElement.getContext("2d");
            const pixelMap = renderContext.getImageData(0, 0, width, height);

            pixelBuffer.forEach((pixel)=>
            {
                const idx = ((pixel.x + pixel.y * width) * 4);
                const color = this.pixel_color_at(pixel.x, pixel.y);

                pixelMap.data[idx+0] = 255*color.red;
                pixelMap.data[idx+1] = 255*color.green;
                pixelMap.data[idx+2] = 255*color.blue;
                pixelMap.data[idx+3] = 255;
            });

            renderContext.putImageData(pixelMap, 0, 0);
        },
    });
    return publicInterface;
}
/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

// The various sky models available for rendering with. They should take in a ray's direction
// and return the color of the sky in that direction.
Wray.skyModels = Object.freeze(
{
    // An approximation of the color of an overcast sky in the given direction.
    // The equation is roughly that of "Moon & Spencer" (date/publication unknown;
    // as cited in Preetham 1999: A practical analytic model for daylight).
    cie_overcast: function(zenithDirection = Wray.vector3(0, 1, 0), zenithLuminance = 1.3)
    {
        return (rayDir = Wray.vector3())=>
        {
            const theta = (1 - zenithDirection.dot(rayDir));
            const luminance = zenithLuminance * ((1 + 2 * Math.cos(theta)) / 3);
            return Wray.color_rgb(luminance, luminance, luminance);
        }
    },

    // A solid color in all directions.
    solid_fill: function(r, g, b)
    {
        return ()=>(Wray.color_rgb(r, g, b));
    },
});

// Which of the sky models will be used when rendering. This default setting may be
// overridden by values in the scene file.
Wray.sky_color = Wray.skyModels.solid_fill({});
/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A crude placeholder material system. Doesn't allow for material chaining or advanced effect x.
 * 
 */

"use strict";

Wray.material = Object.freeze(
{
    lambertian: function(color = Wray.color_rgb(0, 1, 1), albedo = 0.7)
    {
        const publicInterface = Object.freeze(
        {
            isEmissive: false,
            color,
            albedo,
            scatter: (inRay = Wray.ray(), surfaceNormal = Wray.vector3())=>
            {
                const outRay = inRay.aimAt.random_in_hemisphere_cosine_weighted(surfaceNormal);
                const brdf = surfaceNormal.dot(outRay.dir) * (albedo / Math.PI);
                const pdf = (outRay.dir.dot(surfaceNormal) / Math.PI); // For cosine-weighted.
                //const pdf = (1 / (2 * Math.PI));                     // For non-cosine-weighted.
                return {outRay, bsdf:brdf/pdf};
            }
        });
        return publicInterface;
    },

    reflective: function(color = Wray.color_rgb(0, 1, 1), reflectance = 1, albedo = 0.7)
    {
        const publicInterface = Object.freeze(
        {
            isEmissive: false,
            color,
            reflectance,
            albedo,
            scatter: (inRay = Wray.ray(), surfaceNormal = Wray.vector3())=>
            {
                if (Math.random() <= reflectance)
                {
                    return {outRay:inRay.aimAt.reflected(surfaceNormal), bsdf:1};
                }
                else
                {
                    return this.lambertian(color, albedo).scatter(inRay, surfaceNormal);
                }
            }
        });
        return publicInterface;
    },

    emissive: function(emission = Wray.color_rgb(1, 1, 1))
    {
        const publicInterface = Object.freeze(
        {
            isEmissive: true,
            emission,
        });
        return publicInterface;
    },
});
/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

Wray.triangle = function(vertices = [Wray.vertex(), Wray.vertex(), Wray.vertex()],
                         material = Wray.material.lambertian())
{
    Wray.assert((vertices instanceof Array), "Expected an array of vertices to make a triangle.");
    Wray.assert((vertices.length === 3), "Triangles are expected to have three vertices.");

    // Older scene files, prior to the introduction of Wray.vertex, used Wray.vector3 as
    // triangle vertices. To support those older files, we'll convert their vertices into
    // instances of Wray.vertex. Note that this backwards compatibility will likely be
    // removed at some point, once files using the older scene format become rare enough.
    if (vertices.some(vertex=>(typeof vertex.position === "undefined")))
    {
        vertices = vertices.map(vertex=>Wray.vertex(Wray.vector3(vertex.x, vertex.y, vertex.z), null))
    }

    // Derive the triangle's face normal from its vertices' positions (assumes counter-
    // clockwise winding). Note that this ignores the vertices' own normals.
    const faceNormal = (()=>
    {
        const e1 = vertices[1].position.sub(vertices[0].position);
        const e2 = vertices[2].position.sub(vertices[0].position);
        return e1.cross(e2).normalized();
    })();

    // If any of the vertices are missing a normal, override all vertex normals
    // with the triangle's face normal.
    if (vertices.some(vertex=>((vertex.normal || null) === null)))
    {
        vertices = vertices.map(vertex=>Wray.vertex(vertex.position, faceNormal))
    }

    const publicInterface = Object.freeze(
    {
        vertices: Object.freeze(vertices),
        material,
        faceNormal,
    });
    return publicInterface;
}
/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A rudimentary camera for tracing rays.
 * 
 */

"use strict";

Wray.camera = function(pos = Wray.vector3(0, 0, 0),
                       axis = Wray.vector3(0, 0, 1),
                       angle = 0,
                       viewPlane = Wray.surface(),
                       fov = 20,
                       antialiasing = false)
{
    const publicInterface = Object.freeze(
    {
        pos,
        axis,
        angle,
        viewPlane,
        fov,
        antialiasing,

        // Returns a ray originating at the camera's position and pointed toward the given x,y
        // pixel coordinates on the given viewing plane.
        ray_toward_viewing_plane: function(x, y)
        {
            let dir = {};
            const aspectRatio = (viewPlane.width / viewPlane.height);

            // Antialiasing algo adapted from friedlinguini's at the now-deceased ompf.org.
            if (antialiasing)
            {
                const r1 = Math.random();
                const r2 = Math.random();
                const rad = 0.49 * Math.sqrt(-Math.log(1 - r1));
                const angle = 2 * Math.PI * r2;
                dir = Wray.vector3((2 * ((x + 0.5 + rad * Math.cos(angle)) / viewPlane.width) - 1) * Math.tan(fov * Math.PI / 180) * aspectRatio,
                                   (1 - 2 * ((y + 0.5 + rad * Math.sin(angle)) / viewPlane.height)) * Math.tan(fov * Math.PI / 180),
                                   -1);
            }
            else
            {
                const a = Math.tan(fov * Math.PI / 180);
                dir = Wray.vector3((2 * ((x+0.5) / viewPlane.width)-1) * a * aspectRatio,
                                   (1 - (2 * ((y+0.5) / viewPlane.height))) * a,
                                   -1);
            }

            // Point the ray in the camera's direction by transforming it by the camera's
            // axis angle. Adapted from https://stackoverflow.com/a/42422624.
            {
                const cross = axis.cross(dir);
                const dot = axis.dot(dir);
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);

                dir = Wray.vector3(((dir.x * cos) + (cross.x * sin) + (axis.x * dot) * (1 - cos)),
                                   ((dir.y * cos) + (cross.y * sin) + (axis.y * dot) * (1 - cos)),
                                   ((dir.z * cos) + (cross.z * sin) + (axis.z * dot) * (1 - cos)));
            }
            
            return Wray.ray(pos, dir);
        },
    });
    return publicInterface;
}
/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * Builds a bounding volume hierarchy (BVH) for a given mesh of triangles, allowing
 * for faster path-tracing of that mesh.
 * 
 */

"use strict";

// Axis-aligned bounding box for a BVH.
Wray.bvh_aabb = function(mesh = [Wray.triangle()], isLeaf = false)
{
    const [min, max] = (()=>
    {
        let minX = Number.MAX_VALUE, minY = Number.MAX_VALUE, minZ = Number.MAX_VALUE;
        let maxX = -Number.MAX_VALUE, maxY = -Number.MAX_VALUE, maxZ = -Number.MAX_VALUE;

        for (const triangle of mesh)
        {
            for (const vertex of triangle.vertices)
            {
                minX = Math.min(minX, vertex.x);
                minY = Math.min(minY, vertex.y);
                minZ = Math.min(minZ, vertex.z);

                maxX = Math.max(maxX, vertex.x);
                maxY = Math.max(maxY, vertex.y);
                maxZ = Math.max(maxZ, vertex.z);
            }
        }

        return [Wray.vector3(minX, minY, minZ), Wray.vector3(maxX, maxY, maxZ)];
    })();

    const publicInterface = Object.freeze(
    {
        min,
        max,
        isLeaf,
        triangles: Object.freeze(isLeaf? mesh : []),

        mutable:
        {
            // This AABB's left and right child AABBs.
            left: null,
            right: null,
        },

        volume: function()
        {
            return ((2.0 * (max.z - min.z) * (max.x - min.x)) +
                    (2.0 * (max.z - min.z) * (max.y - min.y)) +
                    (2.0 * (max.x - min.x) * (max.y - min.y)));
        },
    });
    return publicInterface;
}

// Recursively splits the given scene into smaller and smaller bounding boxes.
Wray.bvh = function(scene = [Wray.triangle()])
{
    Wray.assert((scene instanceof Array), "Expected an array of triangles for creating a BVH.");

    const startTime = Date.now();

    // An AABB encompassing the entire scene and from which further splits are made.
    const baseAABB = Wray.bvh_aabb(scene, false);
    
    // How many splits we're allowed to do, at most, before declaring a leaf node and stopping.
    const maxDepth = 30;

    // A split must have at most this many triangles in it to be eligible to act as a leaf.
    const minNumTris = 3;

    // Recursively split the mesh into smaller and smaller AABBs.
    (function split(parentAABB = Wray.bvh_aabb(), mesh = [Wray.triangle()], depth = 0)
    {
        if (parentAABB.isLeaf) return;

        // Split the AABB into two new AABBs (termed left/right, here, though the split could
        // be along one of a number of axes).
        {
            // Decide on which axis to split on.
            const axesAvailable = ["x", "y", "z"];
            const splitAxis = axesAvailable[depth % axesAvailable.length];
            const leftMin = parentAABB.min;
            const leftMax = (()=> // Propose random split positions along the chosen axis and use the one that has the lowest cost.
            {
                const numSplits = 5;
                const costNodeIntersection = 1;
                const costTriangleIntersection = 5;

                let leftMax = parentAABB.max;
                let lowestSplitCost = Infinity;

                for (let i = 0; i < numSplits; i++)
                {
                    const proposedSplitStart = (parentAABB.min[splitAxis] + ((parentAABB.max[splitAxis] - parentAABB.min[splitAxis]) * Math.random()));
                    const proposedLeftMin = parentAABB.min;
                    const proposedLeftMax = (()=>
                    {
                        switch (splitAxis)
                        {
                            case "x": return Wray.vector3(proposedSplitStart, parentAABB.max.y, parentAABB.max.z);
                            case "y": return Wray.vector3(parentAABB.max.x, proposedSplitStart, parentAABB.max.z);
                            case "z": return Wray.vector3(parentAABB.max.x, parentAABB.max.y, proposedSplitStart);
                            default: Wray.assert(0, "Unknown BVH split direction."); return Wray.vector3(0, 0, 0);
                        }
                    })();

                    const leftMesh = mesh.filter(triangle=>is_triangle_fully_inside_box(triangle, proposedLeftMin, proposedLeftMax));
                    const rightMesh = mesh.filter(triangle=>!is_triangle_fully_inside_box(triangle, proposedLeftMin, proposedLeftMax));
        
                    const costOfSplit = (costNodeIntersection +
                                         (Wray.bvh_aabb(leftMesh).volume() * leftMesh.length * costTriangleIntersection) +
                                         (Wray.bvh_aabb(rightMesh).volume() * rightMesh.length * costTriangleIntersection));

                    if (costOfSplit < lowestSplitCost)
                    {
                        lowestSplitCost = costOfSplit;
                        leftMax = proposedLeftMax;
                    }
                }

                return leftMax;
            })();

            // Distribute the parent AABB's triangles between the two new AABBs that the parent was split into.
            const leftMesh = mesh.filter(triangle=>is_triangle_fully_inside_box(triangle, leftMin, leftMax));
            const rightMesh = mesh.filter(triangle=>!is_triangle_fully_inside_box(triangle, leftMin, leftMax));
            Wray.assert((leftMesh.length + rightMesh.length === mesh.length),
                        "Triangles have gone missing during BVH-splitting.");

            // Recurse to split each of the two new AABBs further into two more, etc.
            parentAABB.mutable.left = Wray.bvh_aabb(leftMesh, Boolean(((depth + 1) >= maxDepth) || (leftMesh.length <= minNumTris)));
            parentAABB.mutable.right = Wray.bvh_aabb(rightMesh, Boolean(((depth + 1) >= maxDepth) || (rightMesh.length <= minNumTris)));
            split(parentAABB.mutable.left, leftMesh, depth + 1);
            split(parentAABB.mutable.right, rightMesh, depth + 1);

            // Returns true if the given triangle is fully inside the given AABB; otherwise returns false.
            function is_triangle_fully_inside_box(triangle = Wray.triangle(), min = Wray.vector3(), max = Wray.vector3())
            {
                return triangle.vertices.every(vertex=>
                {
                    return Boolean(vertex.x >= min.x && vertex.x <= max.x &&
                                   vertex.y >= min.y && vertex.y <= max.y &&
                                   vertex.z >= min.z && vertex.z <= max.z);
                });
            };
        }
    })(baseAABB, scene, 1);

    const endTime = Date.now();

    const publicInterface = Object.freeze(
    {
        base: baseAABB,
        triangles: Object.freeze(scene),
        constructTimeMs: (endTime - startTime),

        // Returns the count of triangles in the BVH's leaf nodes.
        num_triangles: function()
        {
            return (function tri_count(aabb = Wray.bvh_aabb(), total = 0)
            {
                if (aabb.isLeaf) return aabb.triangles.length;
                else return (total +
                             tri_count(aabb.mutable.left, total) +
                             tri_count(aabb.mutable.right, total));
            })(baseAABB, 0);
        },
    });
    return publicInterface;
}

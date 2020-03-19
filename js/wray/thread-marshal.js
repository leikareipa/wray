/*
 * 2019, 2020 Tarpeeksi Hyvae Soft
 *
 * Software: Wray
 * 
 * Wray's multithreaded architecture:
 * 
 *   DOM thread
 *    |
 *    +--> Render worker marshal (this file)
 *          |
 *          +--> Render worker #1
 *          |
 *          +--> Render worker #2
 *          |
 *          +--> Render worker #...
 * 
 * The marshal thread takes commands from the DOM thread (via postMessage())
 * and spawns individual worker threads as needed to carry out the tasks
 * requested.
 * 
 * 
 * Usage:
 * 
 *  1. Create a new marshal:
 * 
 *     const marshal = new Worker("thread-marshal.js");
 * 
 *  2. Assign a handler function to intercept messages sent by the marshal:
 * 
 *     marshal.onmessage = (message)=>
 *     {
 *         message = message.data;
 *         
 *         switch (message.name)
 *         {
 *             case Wray.thread_message.from.marshal.threadInitialized().name:
 *             {
 *                 ...handle the message...
 * 
 *                 break;
 *             }
 *         }
 *     }
 * 
 *  3. Wait for the marshal to send the threadInitialized() message.
 * 
 *  4. Tell the marshal which scene to render:
 * 
 *     marshal.postMessage(Wray.thread_message.to.marshal.assignRenderSettings({...}));
 * 
 *  5. Wait for the marshal to send the readyToRender() message.
 * 
 *  6. Tell the marshal to begin rendering for x milliseconds:
 * 
 *     marshal.postMessage(Wray.thread_message.to.marshal.render(x));
 * 
 *  7. Wait for the marshal to send the renderingFinished() message.
 * 
 *  8a. Ask the marshal to keep rendering for another x milliseconds, or...
 * 
 *  8b. ...obtain the current pixel buffer's data:
 *
 *      marshal.postMessage(Wray.thread_message.to.marshal.uploadRenderBuffer());
 * 
 *      // Wait for the renderBuffer() message, which contains the pixel data.
 * 
 */

"use strict";

// Include Wray's code.
importScripts("../../js/wray/wray.js");
importScripts("../../js/wray/thread-message.js");
importScripts("../../js/wray/assert.js");
importScripts("../../js/wray/log.js");
importScripts("../../js/wray/matrix44.js");
importScripts("../../js/wray/color.js");
importScripts("../../js/wray/vector.js");
importScripts("../../js/wray/ray.js");
importScripts("../../js/wray/surface.js");
importScripts("../../js/wray/sky.js");
importScripts("../../js/wray/material.js");
importScripts("../../js/wray/triangle.js");
importScripts("../../js/wray/camera.js");
importScripts("../../js/wray/bvh.js");

// Initialize the renderer's mutable parameters. These will be set to more suitable values
// by the user, later, via postMessage() from the parent thread.
let renderWidth = 2;
let renderHeight = 2;
let sceneBVH = null;
let meshFile = "";
let renderSurface = Wray.surface(renderWidth, renderHeight);
let camera = Wray.camera(Wray.vector3(0, 0, 0),
                         Wray.vector3(0, 0, 1),
                         Wray.vector3(0, 0, 0),
                         renderSurface,
                         17,
                         true);

let numWorkersInitialized = 0;
let numWorkersReadyToRender = 0;
let workers = [];

let workerRenderBuffers = [];
let numWorkersRendered = 0;
let averageSampleCount = 0;
let samplesPerSecond = 0;

// Handles messages sent by worker threads.
function worker_message_handler(message)
{
    message = message.data;
    const payload = message.payload;

    switch (message.name)
    {
        case Wray.thread_message.from.worker.threadInitialized().name:
        {
            if (workers.length <= 0)
            {
                postMessage(Wray.thread_message.from.marshal.workerInitializationFailed("A worker is reporting in, even though no workers had been created."));

                break;
            }

            if (++numWorkersInitialized == workers.length)
            {
                for (const worker of workers)
                {
                    worker.postMessage(Wray.thread_message.to.worker.assignRenderSettings({
                        resolution:
                        {
                            width: renderWidth,
                            height: renderHeight,
                        },
                        camera:
                        {
                            dir: {x: camera.dir.x, y: camera.dir.y, z: camera.dir.z},
                            pos: {x: camera.pos.x, y: camera.pos.y, z: camera.pos.z},
                            rot: {x: camera.rot.x, y: camera.rot.y, z: camera.rot.z},
                            fov: camera.fov,
                            antialiasing: camera.antialiasing,
                        },
                        meshFile,
                        workerId: worker.id,
                    }));
                }
            }

            break;
        }

        case Wray.thread_message.from.worker.renderBuffer().name:
        {
            if (workers.length <= 0)
            {
                postMessage(Wray.thread_message.from.marshal.workerInitializationFailed("A worker is reporting in, even though no workers had been created."));

                break;
            }

            workerRenderBuffers[payload.workerId] = payload;

            if (++numWorkersRendered == workers.length)
            {
                for (const renderBuffer of workerRenderBuffers)
                {
                    const pixelData = new Float64Array(renderBuffer.pixels);

                    for (let y = 0; y < renderHeight; y++)
                    {
                        for (let x = 0; x < renderWidth; x++)
                        {
                            const idx = ((x + y * renderWidth) * 4);
                            const color = Wray.color_rgb(pixelData[idx+0],
                                                         pixelData[idx+1],
                                                         pixelData[idx+2]);

                            // If there are no light-bringing samples of this pixel.
                            if (!color.red && !color.green && !color.blue) continue;

                            renderSurface.accumulate_to_pixel_at(x, y, color);
                        }
                    }
                }

                renderSurface.clamp_accumulated();

                postMessage(Wray.thread_message.from.marshal.renderingFinished(averageSampleCount, samplesPerSecond));

                workerRenderBuffers.length = 0;
                numWorkersRendered = 0;
                averageSampleCount = 0;
                samplesPerSecond = 0;
            }

            break;
        }

        case Wray.thread_message.from.worker.readyToRender().name:
        {
            if (workers.length <= 0)
            {
                postMessage(Wray.thread_message.from.marshal.workerInitializationFailed("A worker is reporting in, even though no workers had been created."));

                break;
            }

            if (++numWorkersReadyToRender == workers.length)
            {
                postMessage(Wray.thread_message.log(`Threads (${workers.length}) are ready to render.`));
                postMessage(Wray.thread_message.from.marshal.readyToRender());
            }

            break;
        }

        case Wray.thread_message.from.worker.renderingFinished().name:
        {
            if (workers.length <= 0)
            {
                postMessage(Wray.thread_message.from.marshal.workerInitializationFailed("A worker is reporting in, even though no workers had been created."));

                break;
            }

            averageSampleCount += payload.avgSamplesPerPixel;
            samplesPerSecond += payload.samplesPerSecond;

            workers[payload.workerId].postMessage(Wray.thread_message.to.worker.uploadRenderBuffer());
            
            break;
        }

        case Wray.thread_message.log().name:
        {
            postMessage(Wray.thread_message.log(payload.string));

            break;
        }
    }

    return;
}

// Handles messages sent by the parent thread.
onmessage = (message)=>
{
    message = message.data;
    const payload = message.payload;

    switch (message.name)
    {
        // Render for the given number of milliseconds. During this time, this thread won't respond
        // to messages; but any such messages will likely be queued for when the rendering is finished.
        case Wray.thread_message.to.marshal.render().name:
        {
            if ((workers.length <= 0) ||
                (numWorkersReadyToRender != workers.length))
            {
                postMessage(Wray.thread_message.from.marshal.renderingFailed("Worker threads aren't ready yet."));
            }
            else
            {
                for (const worker of workers)
                {
                    worker.postMessage(Wray.thread_message.to.worker.render(payload.durationMs));
                }
            }
            
            break;
        }

        case Wray.thread_message.to.marshal.uploadRenderBuffer().name:
        {
            upload_image_buffer();

            break;
        }

        // Specify the various render parameters etc., like scene mesh, resolution, and so on.
        case Wray.thread_message.to.marshal.assignRenderSettings().name:
        {
            numWorkersReadyToRender = 0;

            if (typeof payload.epsilon !== "undefined")
            {
                Wray.epsilon = payload.epsilon;
            }

            // Spawn workers.
            {
                let numWorkers = 1;

                if (typeof payload.renderThreads === "undefined") payload.renderThreads = 1;

                // Note: We convert to lowercase string, since the renderThreads value
                // may be a number of text like "all".
                switch (String(payload.renderThreads).toLowerCase())
                {
                    case "all": numWorkers = navigator.hardwareConcurrency; break;
                    case "half": numWorkers = (navigator.hardwareConcurrency / 2); break;
                    default: numWorkers = payload.renderThreads; break;
                }

                if ((numWorkers > 0) && (numWorkers != workers.length))
                {
                    numWorkersInitialized = 0;

                    workers = new Array(numWorkers).fill().map((w, idx)=>
                    {
                        const worker = new Worker("thread-worker.js");
                        worker.onmessage = worker_message_handler;
                        worker.id = idx;

                        return worker;
                    });
                }
            }

            if (typeof payload.meshFile !== "undefined")
            {
                Wray.assert((typeof payload.meshFile.filename !== "undefined" &&
                             typeof payload.meshFile.initializer !== "undefined"),
                            "Received a message with one or more missing parameters.");

                            console.log(payload.meshFile.filename);

                importScripts(payload.meshFile.filename);

                // Load the mesh using the initializer function provided by the
                // mesh file. Since we use eval() to parse the function, we'll do
                // some sanitizing, first.
                if (payload.meshFile.initializer.match(/[=:]/))
                {
                    Wray.assert(0, "Illegal characters in the mesh initializer.");
                }
                else if (Wray.in_window_thread())
                {
                    Wray.assert(0, "Can't load meshes from inside the window thread.");
                }
                else
                {
                    meshFile = payload.meshFile;

                    const mesh = eval("'use strict';" + payload.meshFile.initializer);
                    sceneBVH = Wray.bvh(mesh);
                }
            }

            if (typeof payload.maxRayDepth !== "undefined")
            {
                Wray.maxRayDepth = payload.maxRayDepth;
            }

            if (typeof payload.outputResolution !== "undefined")
            {
                if (typeof payload.outputResolution.width !== "undefined") renderWidth = Math.floor(payload.outputResolution.width);
                if (typeof payload.outputResolution.height !== "undefined") renderHeight = Math.floor(payload.outputResolution.height);

                renderSurface = Wray.surface(renderWidth, renderHeight);
            }

            if (typeof payload.camera !== "undefined")
            {
                let dir = camera.dir,
                    pos = camera.pos,
                    rot = camera.rot,
                    fov = camera.fov,
                    antialiasing = camera.antialiasing;

                if (typeof payload.camera.dir !== "undefined") dir = Wray.vector3(...payload.camera.dir).normalized();
                if (typeof payload.camera.rot !== "undefined") rot = Wray.vector3(...payload.camera.rot);
                if (typeof payload.camera.pos !== "undefined") pos = Wray.vector3(...payload.camera.pos);
                if (typeof payload.camera.fov !== "undefined") fov = payload.camera.fov;
                if (typeof payload.camera.antialiasing !== "undefined") antialiasing = payload.camera.antialiasing;

                camera = Wray.camera(pos, dir, rot, renderSurface, fov, antialiasing);
            }

            // Note: Though we can't do any rendering with 0 workers, we can do other
            // things, like certain performance tests, which is why we may've been
            // requested to create no render workers.
            if (workers.length <= 0)
            {
                postMessage(Wray.thread_message.from.marshal.readyToRender());
            }

            break;
        }

        default: Wray.log(`Unknown thread message: ${message.name}`); break;
    }
}

// Sends the current rendered image's pixel buffer to the parent thread. Will return null in 'pixels' for
// the payload if there was no rendering to upload.
function upload_image_buffer()
{
    if (!renderSurface || Wray.assertionFailedFlag)
    {
        postMessage(Wray.thread_message.from.marshal.renderBuffer({pixels:null}));
    }
    else
    {
        const {pixelArray, width, height} = renderSurface.transferable_pixel_array();
        postMessage(Wray.thread_message.from.marshal.renderBuffer({pixels:pixelArray.buffer, width, height}), [pixelArray.buffer]);
    }
}

postMessage(Wray.thread_message.from.marshal.threadInitialized());

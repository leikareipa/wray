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
 *     const marshal = new Worker("wray-thread-marshal.js");
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

importScripts("wray-base.js");

// Initialize the renderer's mutable parameters. These will be set to more suitable values
// by the user, later, via postMessage() from the parent thread.
let renderSurface = null;
let sceneSettings = null;

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
        case Wray.thread_message.from.worker.renderingFailed().name:
        {
            postMessage(Wray.thread_message.assert(false, `Rendering failed. Reason: ${payload.why}`));

            break;
        }

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
                        ...sceneSettings,
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

                    for (let y = 0; y < renderSurface.height; y++)
                    {
                        for (let x = 0; x < renderSurface.width; x++)
                        {
                            const idx = ((x + y * renderSurface.width) * 4);
                            const color = Wray.color_rgb(pixelData[idx+0],
                                                         pixelData[idx+1],
                                                         pixelData[idx+2]);

                            // If there are no light-bringing samples of this pixel.
                            if (!color.red && !color.green && !color.blue) continue;

                            renderSurface.accumulate_to_pixel_at(x, y, color);
                        }
                    }
                }

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

        default: Wray.log(`Unhandled worker thread message: ${message.name}`); break;
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
            if (sceneSettings === null)
            {
                postMessage(Wray.thread_message.from.marshal.renderingFailed("No scene has been specified for rendering."));

                break;
            }

            if ((workers.length <= 0) ||
                (numWorkersReadyToRender != workers.length))
            {
                postMessage(Wray.thread_message.from.marshal.renderingFailed(`Threads (${workers.length}) aren't yet ready to render!`));

                break;
            }

            for (const worker of workers)
            {
                worker.postMessage(Wray.thread_message.to.worker.render(payload.durationMs));
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
            sceneSettings = payload;
            numWorkersReadyToRender = 0;

            // Spawn workers.
            {
                Wray.assert((typeof payload.renderThreadCount !== "undefined"), "Missing the thread count for rendering.");

                const maxThreadsSupported = ((typeof navigator.hardwareConcurrency === "undefined")? 4 : navigator.hardwareConcurrency);
                const numWorkerThreads = (()=>
                {
                    switch (String(payload.renderThreadCount).toLowerCase())
                    {
                        case "all":  return maxThreadsSupported;
                        case "half": return ((maxThreadsSupported / 2) || 1);
                        default:     return Number(payload.renderThreadCount);
                    }
                })();

                if ((numWorkerThreads > 0) && (numWorkerThreads != workers.length))
                {
                    numWorkersInitialized = 0;

                    workers = new Array(numWorkerThreads).fill().map((w, idx)=>
                    {
                        const worker = new Worker("wray-thread-worker.js");
                        worker.onmessage = worker_message_handler;
                        worker.id = idx;

                        return worker;
                    });
                }
            }

            Wray.assert((typeof payload.outputResolution !== "undefined"), "No render resolution specified.");
            renderSurface = Wray.surface(payload.outputResolution.width, payload.outputResolution.height);

            // Note: Though we can't do any rendering with 0 workers, we can do other
            // things, like certain performance tests, which is why we may've been
            // requested to create no render workers.
            if (workers.length <= 0)
            {
                postMessage(Wray.thread_message.from.marshal.readyToRender());
            }

            break;
        }

        default: Wray.log(`Unhandled thread message: ${message.name}`); break;
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

/*
 * 2020 Tarpeeksi Hyvae Soft
 *
 * Software: Wray
 * 
 * Wray's multithreaded architecture:
 * 
 *   DOM thread
 *    |
 *    +--> Render worker marshal
 *          |
 *          +--> Render worker #1 (this file)
 *          |
 *          +--> Render worker #2 (this file)
 *          |
 *          +--> Render worker #...
 * 
 * The render worker carries out any actual rendering work, the instructions
 * and data for which it'll receive from the marshal thread.
 * 
 */

"use strict";

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

// A unique value that identifies this worker from among any other workers.
let id = null;

let renderWidth = 2;
let renderHeight = 2;
let renderSurface = Wray.surface(renderWidth, renderHeight);
let sceneBVH = null;
let camera = Wray.camera(Wray.vector3(0, 0, 0),
                         Wray.vector3(0, 0, 1),
                         Wray.vector3(0, 0, 0),
                         renderSurface,
                         17,
                         true);

// Handles messages sent us by the marshal thread.
onmessage = (message)=>
{
    message = message.data;
    const payload = message.payload;

    switch (message.name)
    {
        // Render for the given number of milliseconds. During this time, this thread won't
        // respond to messages; but any such messages will likely be queued for when the
        // rendering is finished.
        case Wray.thread_message.to.worker.render().name:
        {
            render(payload.durationMs);
            
            break;
        }

        case Wray.thread_message.to.worker.uploadRenderBuffer().name:
        {
            upload_image_buffer();

            break;
        }

        // Specify the various render parameters etc., like scene mesh, resolution, and so on.
        case Wray.thread_message.to.worker.assignRenderSettings().name:
        {
            id = payload.workerId;
            renderSurface = Wray.surface(payload.resolution.width, payload.resolution.height);
            camera = Wray.camera(Wray.vector3(payload.camera.pos.x, payload.camera.pos.y, payload.camera.pos.z),
                                 Wray.vector3(payload.camera.dir.x, payload.camera.dir.y, payload.camera.dir.z),
                                 Wray.vector3(payload.camera.rot.x, payload.camera.rot.y, payload.camera.rot.z),
                                 renderSurface,
                                 payload.camera.fov,
                                 payload.camera.antialiasing);

            if (typeof payload.meshFile !== "undefined")
            {
                Wray.assert((typeof payload.meshFile.filename !== "undefined" &&
                             typeof payload.meshFile.initializer !== "undefined"),
                            "Received a message with one or more missing parameters.");

                // Load the mesh. We expect that the mesh file has already been
                // sanity-checked by the marshal thread.
                importScripts(payload.meshFile.filename);
                const mesh = eval("'use strict';" + payload.meshFile.initializer);
                sceneBVH = Wray.bvh(mesh);

                postMessage(Wray.thread_message.log(`Worker #${id}: BVH construction for ${sceneBVH.triangles.length} triangles took ${sceneBVH.constructTimeMs / 1000} ms.`));
            }

            postMessage(Wray.thread_message.from.worker.readyToRender(id));

            break;
        }

        case Wray.thread_message.to.worker.setId().name:
        {
            id = message.payload.id;
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
        postMessage(Wray.thread_message.from.worker.renderBuffer(id, {pixels:null}));
    }
    else
    {
        const {pixelArray, width, height} = renderSurface.transferable_pixel_array();
        postMessage(Wray.thread_message.from.worker.renderBuffer(id, {pixels:pixelArray.buffer, width, height}), [pixelArray.buffer]);
    }
}

// Sample the rendering for x milliseconds.
function render(ms = 1000)
{
    // If we have a valid context for rendering.
    if (sceneBVH && renderSurface && !Wray.assertionFailedFlag)
    {
        // This thread will be unavailable for interaction while the render loop runs, so make
        // sure we were given a valid amount of time to run it for.
        Wray.assert((typeof ms === "number"), "Expected the number of milliseconds to render to be given as a numerical value.");
        Wray.assert((ms > 0 && ms < 60000), "The given number of milliseconds to render is out of valid bounds.");

        // Cast rays and accumulate their color values into the render surface.
        let numSamples = 0;
        const startTime = Date.now();
        while ((Date.now() - startTime) < ms)
        {
            const x = Math.floor(Math.random() * renderSurface.width);
            const y = Math.floor(Math.random() * renderSurface.height);

            const color = camera.ray_toward_viewing_plane(x, y).trace(sceneBVH);
            renderSurface.accumulate_to_pixel_at(x, y, color);

            numSamples++;
        }

        // Send the results of the rendering back to the parent thread.
        postMessage(Wray.thread_message.from.worker.renderingFinished(id, renderSurface.average_sample_count(), Math.floor(numSamples * (1000 / (Date.now() - startTime)))));
    }
    else
    {
        const failReasons = [];
        if (!sceneBVH) failReasons.push("Invalid BVH tree");
        if (!renderSurface) failReasons.push("Invalid render surface");
        if (Wray.assertionFailedFlag) failReasons.push("Assertion failure had been flagged");

        postMessage(Wray.thread_message.from.worker.renderingFailed(id, failReasons.join(" & ")));
    }
}

postMessage(Wray.thread_message.from.worker.threadInitialized());

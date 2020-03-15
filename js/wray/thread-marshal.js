/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * Wray's main thread. Handles cross-thread messaging between the parent thread and Wray's
 * threads. Also, at the moment, does all the rendering.
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
let renderSurface = Wray.surface(renderWidth, renderHeight);
let sceneBVH = null;
let camera = Wray.camera(Wray.vector3(0, 0, 0),
                         Wray.vector3(0, 0, 1),
                         Wray.vector3(0, 0, 0),
                         renderSurface,
                         17,
                         true);

// Will contain as strings the filenames/paths of all the mesh files that we've been asked
// to load in by the user. This list can then be inspected to make sure we don't unnecessarily
// load any file twice.
/// TODO/NB: You could technically ask to load the same file multiple times with different
///          name strings, like [file, ./file], and the list wouldn't recognize them as the
///          same file.
const meshFilesLoaded = [];

// Handles messages sent us by the parent thread.
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
            render(payload.durationMs);
            
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
            if (typeof payload.epsilon !== "undefined")
            {
                Wray.epsilon = payload.epsilon;
            }

            if (typeof payload.meshFile !== "undefined")
            {
                Wray.assert((typeof payload.meshFile.filename !== "undefined" &&
                             typeof payload.meshFile.initializer !== "undefined"),
                            "Received a message with one or more missing parameters.");

                if (!meshFilesLoaded.includes(payload.meshFile.filename))
                {
                    importScripts(payload.meshFile.filename);
                    meshFilesLoaded.push(payload.meshFile.filename);
                }

                // Load the mesh. Since we use eval(), we'll do some sanitizing, first.
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
                camera = Wray.camera(camera.dir, camera.pos, renderSurface, camera.fov, camera.antialiasing);
            }

            if (typeof payload.camera !== "undefined")
            {
                let dir = camera.dir, pos = camera.pos, rot = camera.rot, fov = camera.fov, antialiasing = camera.antialiasing;

                if (typeof payload.camera.dir !== "undefined") dir = Wray.vector3(...payload.camera.dir).normalized();
                if (typeof payload.camera.rot !== "undefined") rot = Wray.vector3(...payload.camera.rot);
                if (typeof payload.camera.pos !== "undefined") pos = Wray.vector3(...payload.camera.pos);
                if (typeof payload.camera.fov !== "undefined") fov = payload.camera.fov;
                if (typeof payload.camera.antialiasing !== "undefined") antialiasing = payload.camera.antialiasing;

                camera = Wray.camera(pos, dir, rot, renderSurface, fov, antialiasing);
            }

            if (typeof payload.flattenSurface !== "undefined" && payload.flattenSurface) renderSurface.clamp_accumulated();
            if (typeof payload.wipeSurface !== "undefined" && payload.wipeSurface) renderSurface.wipe();

            break;
        }

        default: Wray.log("Unknown message '" + message.data.messageId + "' sent to worker thread. Ignoring it."); break;
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
        const {pixelArray, width, height, bpp} = renderSurface.as_transferable_pixel_array();
        postMessage(Wray.thread_message.from.marshal.renderBuffer({pixels:pixelArray.buffer, width, height, bpp}), [pixelArray.buffer]);
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
        postMessage(Wray.thread_message.from.marshal.renderingFinished(renderSurface.average_sample_count(), Math.floor(numSamples * (1000 / (Date.now() - startTime)))));
    }
    else
    {
        const failReasons = [];
        if (!sceneBVH) failReasons.push("Invalid BVH tree");
        if (!renderSurface) failReasons.push("Invalid render surface");
        if (Wray.assertionFailedFlag) failReasons.push("Assertion failure had been flagged");

        postMessage(Wray.thread_message.from.marshal.renderingFailed(failReasons.join(" & ")));
    }
}

postMessage(Wray.thread_message.from.marshal.threadInitialized());

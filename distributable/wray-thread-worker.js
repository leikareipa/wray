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

importScripts("wray-base.js");

// A unique value that identifies this worker from among any other workers.
let id = null;
let sceneBVH = null;
let renderSurface = null;
let camera = null;

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
            Wray.assert((typeof payload.workerId != "undefined"), "No worker ID given.");
            id = payload.workerId;

            Wray.assert((typeof payload.outputResolution === "object"), "No render resolution given.");
            renderSurface = Wray.surface(payload.outputResolution.width, payload.outputResolution.height);

            Wray.assert((typeof payload.camera === "object"), "No camera given.");
            /// TODO: Verify that the camera object contains the required properties.
            camera = Wray.camera(Wray.vector3(payload.camera.position.x, payload.camera.position.y, payload.camera.position.z),
                                 Wray.vector3(payload.camera.axisAngle.x, payload.camera.axisAngle.y, payload.camera.axisAngle.z),
                                 payload.camera.axisAngle.w,
                                 renderSurface,
                                 payload.camera.fov,
                                 payload.camera.antialiasing);

            // Modify global render parameters.
            {
                if (typeof payload.epsilon === "number")
                {
                    Wray.epsilon = payload.epsilon;
                }

                if (typeof payload.maxRayDepth === "number")
                {
                    Wray.maxRayDepth = payload.maxRayDepth;
                }

                if (typeof payload.sky === "object" &&
                    typeof payload.sky.model === "string")
                {
                    switch (payload.sky.model)
                    {
                        case "cie-overcast":
                        {
                            const direction = (typeof payload.sky.zenithDirection !== "object")
                                            ? {x:undefined, y:undefined, z:undefined}
                                            : payload.sky.zenithDirection;

                            const luminance = (typeof payload.sky.zenithLuminance !== "number")
                                            ? undefined
                                            : payload.sky.zenithLuminance;

                            Wray.sky_color = Wray.skyModels.cie_overcast(Wray.vector3(direction.x, direction.y, direction.z), luminance);

                            break;
                        }
                        case "solid-fill":
                        {
                            const color = (typeof payload.sky.fillColor !== "object")
                                        ? {r:undefined, g:undefined, b:undefined}
                                        : payload.sky.fillColor;

                            Wray.sky_color = Wray.skyModels.solid_fill(color.r, color.g, color.b);

                            break;
                        }
                        default: Wray.warning(`Unknown sky model "${payload.sky.model}".`); break;
                    }
                }
            }

            if (Array.isArray(payload.triangles))
            {
                // Convert the scene's materials into Wray material objects.
                const materials = Object.keys(payload.materials).reduce((materials, materialName)=>
                {
                    const material = payload.materials[materialName];

                    switch (material.type)
                    {
                        case "reflective":
                        {
                            materials[materialName] = Wray.material.reflective(Wray.color_rgb(material.color.r,
                                                                                              material.color.g,
                                                                                              material.color.b),
                                                                               material.reflectance,
                                                                               material.albedo);
                            break;
                        }
                        case "lambertian":
                        {
                            materials[materialName] = Wray.material.lambertian(Wray.color_rgb(material.color.r,
                                                                                              material.color.g,
                                                                                              material.color.b),
                                                                               material.albedo);
                            break;
                        }
                        case "emissive":
                        {
                            materials[materialName] = Wray.material.emissive(Wray.color_rgb((material.color.r * material.intensity),
                                                                                            (material.color.g * material.intensity),
                                                                                            (material.color.b * material.intensity)));
                            break;
                        }
                        default: Wray.assert(0, `Unknown material type "${material.type}"`); break;
                    }

                    return materials;
                }, {});

                // Convert the scene's triangles into Wray triangle objects.
                const triangles = (payload.triangles || []).map(triangle=>
                {
                    const vertices = (triangle.vertices || []).map(vertex=>
                    {
                        const normal = vertex.normal
                                       ? Wray.vector3(vertex.normal.x, vertex.normal.y, vertex.normal.z)
                                       : null;

                        return Wray.vertex(Wray.vector3(vertex.position.x, vertex.position.y, vertex.position.z), normal);
                    });

                    return Wray.triangle(vertices, (materials[triangle.material] || null));
                });

                sceneBVH = Wray.bvh(triangles);

                postMessage(Wray.thread_message.log(`Worker #${id}: BVH construction for ${sceneBVH.triangles.length} triangles took ${sceneBVH.constructTimeMs / 1000} seconds.`));
            }

            postMessage(Wray.thread_message.from.worker.readyToRender(id));

            break;
        }

        case Wray.thread_message.to.worker.setId().name:
        {
            id = message.payload.id;
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
    // This thread will be unavailable for interaction while the render loop runs, so make
    // sure the amount of time we were asked to render for is within reason.
    Wray.assert((ms > 0 && ms < 60000), "The given number of milliseconds to render is out of valid bounds.");

    // If we have a valid context for rendering.
    if (sceneBVH && renderSurface && !Wray.assertionFailedFlag)
    {
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

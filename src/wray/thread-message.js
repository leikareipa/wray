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

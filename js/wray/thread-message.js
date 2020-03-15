/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
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
            // Send to the marshal to ask for the current scene to be rendered for
            // the given number of milliseconds.
            render: (durationMs = 1000)=>Wray.thread_message_body("marshal-render", {durationMs}),
    
            // Tell the marshal to adopt the given render settings, e.g. resolution.
            assignRenderSettings: (settings = {})=>Wray.thread_message_body("marshal-assign-render-settings", settings),

            // Ask the marshal to send a copy of its render buffer to the parent
            // thread.
            uploadRenderBuffer: ()=>Wray.thread_message_body("marshal-upload-render-buffer"),
        },

        worker:
        {
            // Tell a worker to adopt the given id, with which this worker can then be
            // told apart from other workers.
            setId: (id = null)=>Wray.thread_message_body("worker-set-id", {id}),
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

            // Sent by a marshal to upload its render buffer to the parent thread.
            renderBuffer: (renderBuffer = {})=>Wray.thread_message_body("marshal-render-buffer", renderBuffer),

            // Sent by a marshal thread to inform its parent that it has failed to
            // render.
            renderingFailed: (why = "")=>Wray.thread_message_body("marshal-rendering-failed", {why}),

            // Sent by a marshal thread to inform its parent that it has finished
            // its requested rendering. (The parent might then e.g. send a message
            // to the marshal to have the marshal upload its render buffer.)
            renderingFinished: ()=>Wray.thread_message_body("marshal-rendering-finished"),
        },

        worker:
        {
            // Sent by a worker thread when it has finished initializing itself and
            // is thus ready to accept messages.
            threadInitialized: ()=>Wray.thread_message_body("worker-thread-initialized"),

            // Sent by a worker thread to inform its parent that it has failed to
            // render.
            renderingFailed: (why = "")=>Wray.thread_message_body("worker-rendering-failed", {why}),

            // Sent by a worker thread to inform its parent that it has finished
            // its requested rendering. (The parent might then e.g. send a message
            // to the worker to have the worker upload its render buffer.)
            renderingFinished: ()=>Wray.thread_message_body("worker-rendering-finished"),
        },
    },
};

/*

Wray.message =
{
    // Messages that can be sent to Wray by its parent thread.
    render: (durationMs)=>( // Ask Wray to render for the given number of milliseconds.
    {
        messageId: "render",
        payload: {durationMs},
    }),
    uploadRendering: ()=>( // Ask Wray to send a copy of its render buffer to the parent thread as a pixel array.
    {
        messageId: "upload-rendering",
    }),
    ping: (timestamp = performance.now())=>( // Test the roundabout latency of the message system.
    {
        messageId: "ping",
        payload: {timestamp},
    }),
    assignSettings: (settings = {})=>( // Tell Wray to adopt the given settings (e.g. render resolution).
    {
        messageId: "assign-settings",
        payload: settings,
    }),

    // Messages from Wray's worker thread to its parent.
    finishedInitializing: ()=>(
    {
        messageId: "wray-has-initialized",
    }),
    renderingUpload: (pixelBuffer = {})=>(
    {
        messageId: "rendering-upload",
        payload: pixelBuffer,
    }),
    log: (string = "")=>(
    {
        messageId: "log",
        payload: {string},
    }),
    assert: (condition = (1===1), failMessage = "")=>(
    {
        messageId: "assert",
        payload: {condition, failMessage},
    }),
    renderingFailed: (reason)=>(
    {
        messageId: "rendering-failed",
        payload: {reason}
    }),
    renderingFinished: (avg_samples_per_pixel = 0, samples_per_second = 0)=>(
    {
        messageId: "rendering-finished",
        payload: {avg_samples_per_pixel, samples_per_second},
    }),
    pingResponse: (timestamp)=>(
    {
        messageId: "ping-response",
        payload: {timestamp},
    }),
}
*/
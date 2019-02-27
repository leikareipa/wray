/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 * A wrapper for messages sent to and from Wray's worker thread via postMessage().
 * 
 */

"use strict";

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

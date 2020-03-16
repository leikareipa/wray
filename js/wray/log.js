/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

Wray.log = function(string = "")
{
    string = String(string);

    if (string.length < 1)
    {
        Wray.assert(0, "Empty log messages are discouraged.");
    }

    if (Wray.in_window_thread())
    {
        console.log("Wray: " + string);
    }
    else
    {
        postMessage(Wray.thread_message.log(string));
    }
}

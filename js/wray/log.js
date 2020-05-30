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

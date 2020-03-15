/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

// Bails noisily with the given failure message if the given condition is false.
Wray.assert = function(condition = false, failMessage = "")
{
    if ((typeof failMessage !== "string") || (failMessage.length < 1))
    {
        Wray.assert(0, "Empty assertion messages are discouraged.");
    }

    if (!condition)
    {
        if (!Wray.assertionFailedFlag)
        {
            Object.defineProperty(Wray, "assertionFailedFlag", {value:true, writable:false});
            
            if (Wray.in_window_thread())
            {
                alert("Wray assertion: " + failMessage);
                throw Error("Wray assertion: " + failMessage);
            }
            else
            {
                postMessage(Wray.thread_message.assert(condition, failMessage));
            }
        }
        else
        {
            Wray.log("Non-throwing assertion failure: " + failMessage);
        }
    }
}

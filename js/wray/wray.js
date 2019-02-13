/*
 * Tarpeeksi Hyvae Soft 2019 /
 * Wray
 * 
 */

"use strict";

// Master namespace.
const Wray = {};

Wray.epsilon = 0.000001;
Wray.maxRayDepth = 10;

// Returns false if the caller is (likely) running inside a Web Worker thread; and true otherwise.
Object.defineProperty(Wray, "in_window_thread", {value:()=>(Boolean(typeof importScripts !== "function")),
                                                 writable:false});

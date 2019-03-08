# Wray
A vanilla path tracer written in vanilla JavaScript. Primarily intended as a simple path tracer for use in some of my own projects; but who knows, someone else might derive a benefit from this, as well.

You can view a live sample of the renderer in action at [tarpeeksihyvaesoft.com/s/wray/samples/sample1.html](http://tarpeeksihyvaesoft.com/s/wray/samples/sample1.html).

### Features
- Vanilla path-tracing in the browser
- Immutable data structures, for the most part
- Top-down BVH tree to accelerate ray&ndash;triangle intersections
- Renders in a non-UI thread via Web Workers (single-threaded only)
- Simple message-based interface to communicate with the render thread

# Usage
### Setting up
For best results (e.g. Web Worker compatibility), you'll want to run Wray through a server.

This can be done locally, for instance by running `$ php -S localhost:8000` from Wray's root directory, which sets up PHP's built-in server and points the given localhost to Wray's root.

### Examples of usage
Samples of Wray in practical use are given in the [samples/](samples/) directory.

### Communicating with Wray's thread
As hinted at, above, you use Wray by first spawning it into a separate Web Worker thread (e.g. `wrayThread = new Worker("js/wray/main-thread.js")`), then control it by sending it commands via `wrayThread.postMessage()`. The Wray thread may also send messages back to the parent thread that spawned it. Examples of this in practice can be found under [samples/](samples/), and as explained below.

To issue a command, first wrap it in the `Wray.message` object: e.g. `Wray.message.render()` for the command `render`; then send it off via `wrayThread.postMessage()`; e.g. `wrayThread.postMessage(Wray.message.render())`. Note that a command may take one or more input parameters, e.g. `Wray.message.render(1000)`; see [js/wray/message.js](js/wray/message.js) for more info.

The following commands can be sent to Wray's thread to control its behavior.
- `assignSettings`
    - Assign various settings of Wray's, like render resolution and the scene to be rendered, given in _x_.
    - Response from Wray's thread: none.
- `render`
    - Ask Wray to render the current scene for _x_ milliseconds.
    - Response: `renderingFinished` after the _x_ milliseconds are up if the rendering finished successfully, or `renderingFailed` if something went wrong.
    - Notes:
        - The rendering will accumulate into a pixel buffer stored in Wray's thread. You can ask Wray to upload the current contents of this buffer into the parent thread by sending it the message `uploadRendering`.
        - The Wray thread will not respond to further messages until either (a) the _x_ milliseconds are up, or (b) the rendering fails. Depending on the browser, the thread may continue execution in the background even if the tab is closed, until the given number of milliseconds is up.
- `uploadRendering`
    - Ask Wray to send the current rendering's pixel buffer to the parent thread.
    - Response: `renderingUpload`.
- `ping`
    - An echo to test the message system's roundtrip time between the calling thread and Wray's thread.
    - Response: `pingResponse`.

Wray's thread may send one or more of following messages back to its parent thread.
- `finishedInitializing`
    - Emitted once Wray's thread has finished setting itself up and is ready to be controlled by the parent thread. The delay between a call to `new Worker()` and this message being emitted is expected to be in the tens of milliseconds.
- `pingResponse`
    - Emitted as a response to `ping`. Returns the same 
- `renderingUpload`
    - Emitted as a response to `uploadRendering`. Contains as payload a copy of the pixel data from Wray's render buffer.
- `renderingFinished`
    - Emitted once rendering scheduled with `render` has finished.
- `renderingFailed`
    - Emitted if rendering scheduled with `render` fails.
- `assert`
    - Emitted if `Wray.assert()` fails inside the Wray thread. The parent thread is then expected to deal with the failure.
- `log`
    - Emitted to ask the parent thread to log a given piece of information.

### 3d models
At the moment, Wray uses its own format for 3d models, and is unable to directly import such data from other formats. To work around this, first export your scenes into the Wavefront .obj format, then use the tool provided under [tools/obj2wm/](tools/obj2wm/) to convert the .obj into Wray's format.

Below is an example of roughly what Wray's 3d mesh format looks like. You can also view a more practical example in [samples/assets/sample1/monkey.wray-mesh.js](samples/assets/sample1/monkey.wray-mesh.js).
```
const cubeMesh = function(scale = Wray.vector3(1, 1, 1))
{
    // Materials, etc. are defined here...

    return [/* A list of the mesh's triangles.*/];
}
```
In other words, the format defines a JavaScript function that returns as an array the mesh's triangles.

Once converted into Wray's format, a 3d mesh can be loaded into Wray by passing the `meshFile` property as payload with the `assignSettings` message to Wray's worker thread; a practical example of which is given in [samples/sample1.html](samples/sample1.html). The property might be defined like so:
```
meshFile:
{
    filename: "assets/cube.wray-mesh.js",
    initializer: "cubeMesh()"
}
```
In this instance, Wray will be instructed to load the mesh contained in `assets/cube.wray-mesh.js` by calling the function `cubeMesh()`, defined in the file and returning an array of the mesh's triangles.

Note that only one mesh can be active at a time, so you'd include your entire scene in that file.

# Project status
Wray is currently in pre-alpha, and at the moment has no specific schedule for entering alpha. It's being developed on a want-to-code basis.

### Browser compatibility
Recent (within the last year or so) versions of Chrome and Firefox ought to be compatible. Recent versions of Opera and Safari should likewise be compatible.

Internet Explorer and Edge are not compatible.

### Performance
Below are results from [perf-tests/perftest1.html](perf-tests/perftest1.html) as of [858a5bf](https://github.com/leikareipa/wray/tree/858a5bf9ed8ea06a0fd8de5f96aee112ca53aac9) on various platforms. The values given are thousands of samples per second, with standard deviations in parentheses &ndash; higher values of deviation relative to the base performance indicate less stable performance across time. The browsers are the latest corresponding stable versions at the time. An empty cell indicates that the corresponding test has not been run.

|                 | Chrome    | Firefox   |
| --------------- |:---------:|:---------:|
| Xeon E3-1230 v3 | 28 (3.22) | 11 (0.01) |
| Pentium G4560   | 22 (6.05) | 11 (0.01) |
| Honor View20    | 21 (1.24) |           |
| Huawei T1-A21L  | 2 (0.37)  |           |

# Authors and credits
Wray is being developed by the one-man Tarpeeksi Hyvae Soft (see on [GitHub](https://github.com/leikareipa) and the [Web](http://www.tarpeeksihyvaesoft.com)).

Ray&ndash;triangle intersection testing ([js/wray/ray.js](js/wray/ray.js):intersect_triangle) is adapted from code provided in Moller & Trumbore 1997: "Fast, minimum storage ray/triangle intersection".

Ray&ndash;AABB intersection testing ([js/wray/ray.js](js/wray/ray.js):intersect_aabb) is adapted from an implementation by [Tavian Barnes](https://tavianator.com/fast-branchless-raybounding-box-intersections/).

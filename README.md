# Wray
A vanilla path tracer written in vanilla JavaScript. Primarily intended as a simple path tracer for use in some of my personal projects, but someone else may derive a benefit from this, as well.

### Features
- Vanilla path-tracing in the browser
- Immutable data structures, for the most part
- Uses a top-down BVH tree to accelerate ray&ndash;triangle intersections
- Renders in a non-UI thread via Web Workers (single-threaded only)
- A simple message-based interface to communicate with the render thread

# Usage
### Setting up
For best results, you'll want to run Wray through a server. This can be done locally e.g. with PHP's built-in server (`$ php -S localhost:8000`).

### Examples of usage
[samples/sample1.html](samples/sample1.html) &mdash; Shows how to spawn Wray's worker thread and control it via the messaging interface. Includes a sample UI, which displays the rendering as it's being generated by Wray in the background.

### Communicating with Wray's thread
As hinted at, above, you use Wray by first spawning it into a separate Web Worker thread (e.g. `wrayThread = new Worker("js/wray/main-thread.js")`), then control it by sending it commands via `wrayThread.postMessage()`. The Wray thread may also send messages back to the parent thread that spawned it. Examples of this in practice can be found under [samples/](samples/).

**The following is a list of commands that can be sent to Wray's thread to control its behavior.** (Note that each command also contains a `payload` object, which provides additional data related to the command. The list that follows doesn't touch on the contents of `payload` &mdash; for now, you can view the example code provided under [samples/](samples/) to see which payload properties are expected to be included with a given message.)
- `assign-settings`
    - Assign various settings of Wray's, like render resolution and the scene to be rendered.
    - Response from Wray's thread: none.
- `render`
    - Ask Wray to render the current scene for _x_ milliseconds.
    - Response: `rendering-finished` after the _x_ milliseconds are up if the rendering finished successfully, or `rendering-failed` if something went wrong.
    - Notes:
        - The rendering will accumulate into a pixel buffer stored in Wray's thread. You can ask Wray to upload the current contents of this buffer into the parent thread by sending it the message `upload-rendering`.
        - The Wray thread will not respond to further messages until either (a) the _x_ milliseconds are up, or (b) the rendering fails. Depending on the browser, the thread may continue execution in the background even if the tab is closed, until the given number of milliseconds is up.
- `upload-rendering`
    - Ask Wray to send the current rendering's pixel buffer to the parent thread.
    - Response: `rendering-upload`.
- `ping`
    - An echo to test the message system's roundtrip time between the calling thread and Wray's thread.
    - Response: `ping-response`.

**Wray's thread may send one or more of following messages back to its parent thread:**
- `wray-has-initialized`
    - Emitted once Wray's thread has finished setting itself up and is ready to be controlled by the parent thread. The delay between a call to `new Worker()` and this message being emitted is expected to be in the tens of milliseconds.
- `ping-response`
    - Emitted as a response to `ping`.
- `rendering-upload`
    - Emitted as a response to `upload-rendering`. Contains as payload a copy of the pixel data from Wray's render buffer.
- `rendering-finished`
    - Emitted once rendering scheduled with `render` has finished.
- `rendering-failed`
    - Emitted if rendering scheduled with `render` fails.
- `assert`
    - Emitted if `Wray.assert()` fails inside the Wray thread. The parent thread is then expected to deal with the failure.
- `log`
    - Emitted to ask the parent thread to log a given piece of information.

# Performance
(Todo)

# Browser compatibility
Recent (within the last year or so) versions of Chrome and Firefox ought to be compatible. Recent versions of Opera and Safari should likewise be compatible.

Internet Explorer and Edge are not compatible.

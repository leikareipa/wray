## Performance tests and testers for Wray

#### How to use
Run the corresponding HTML file (see below) in a browser via a web server. Wray uses Web Workers, so, depending on your browser, opening the HTML directly off the disk may not work.

Note that the tests assume to be located two directories above the Wray's root; e.g. in `/wray/tests/performance/*`, where `/wray/js/*` contains the renderer's JavaScript code, etc.

#### The tests

**[perftest1.html](perftest1.html)** &mdash; Renders a scene of about 1300 triangles for _n_ seconds at 1280 x 720, then displays the number of samples per second achieved during that effort. The test will loop until the window is closed. Note that this test is for render speed without any extra time for transfering the frame buffer from the render thread into the UI thread for display.

**[perftest2.html](perftest2.html)** &mdash; Transfers pixel buffers of various sizes from Wray's worker thread to the window thread, to find the latency of this action. Includes overhead from any tonemapping, range conversion, etc. that Wray does before uploading the buffer. In other words, this test lets you know the performance penalty of requesting Wray to upload its current rendering to the parent thread.

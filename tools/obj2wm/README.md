# OBJ2WM
Converts Wavefront .obj files into a format native to Wray.

Note that this is an early version of the tool, and has not been heavily tested.

### Usage
Assuming you want to convert a file called `mesh.obj` into Wray's format, call up the converter like so:
```
$ obj2wm mesh.obj
```
The output will be a JavaScript file &ndash; called `mesh.obj.wray-mesh.js` by default &ndash; that consists of a function returning an array of triangles. For further instructions on how to use this file with Wray, see the main Wray readme.

### Which properties are exported?
Vertex coordinates and diffuse color. Other properties are ignored.

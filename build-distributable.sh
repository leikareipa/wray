#!/bin/bash

# Concatenates Wray's source files into a single distributable file.

DIRECTORY="./distributable/"
FILENAME="wray-base.js"
VERSION="live"

SOURCE_FILES=("./src/wray/wray.js"
              "./src/wray/ui.js"
              "./src/wray/thread-message.js"
              "./src/wray/assert.js"
              "./src/wray/log.js"
              "./src/wray/matrix44.js"
              "./src/wray/color.js"
              "./src/wray/vertex.js"
              "./src/wray/vector.js"
              "./src/wray/ray.js"
              "./src/wray/surface.js"
              "./src/wray/sky.js"
              "./src/wray/material.js"
              "./src/wray/triangle.js"
              "./src/wray/camera.js"
              "./src/wray/bvh.js")

echo "// WHAT: Concatenated JavaScript source files" > "$DIRECTORY/$FILENAME"
echo "// PROGRAM: Wray" >> "$DIRECTORY/$FILENAME"
echo "// VERSION: $VERSION (`LC_ALL=en_US.utf8 date -u +"%d %B %Y %H:%M:%S %Z"`)" >> "$DIRECTORY/$FILENAME"
echo "// AUTHOR: Tarpeeksi Hyvae Soft" >> "$DIRECTORY/$FILENAME"
echo "// LINK: https://www.github.com/leikareipa/wray/" >> "$DIRECTORY/$FILENAME"
echo "// LINK: https://www.tarpeeksihyvaesoft.com/" >> "$DIRECTORY/$FILENAME"
echo "// FILES:" >> "$DIRECTORY/$FILENAME"
printf "//\t%s\n" "${SOURCE_FILES[@]}" >> "$DIRECTORY/$FILENAME"
echo -e "/////////////////////////////////////////////////\n" >> "$DIRECTORY/$FILENAME"

cat ${SOURCE_FILES[@]} >> "$DIRECTORY/$FILENAME"
cp "./src/wray/thread-marshal.js" "$DIRECTORY/wray-thread-marshal.js"
cp "./src/wray/thread-worker.js" "$DIRECTORY/wray-thread-worker.js"

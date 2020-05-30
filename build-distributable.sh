#!/bin/bash

# Concatenates Wray's source files into a single distributable file.

DIRECTORY="./distributable/"
FILENAME="wray-base.js"
VERSION="live"

SOURCE_FILES=("./js/wray/wray.js"
              "./js/wray/ui.js"
              "./js/wray/thread-message.js"
              "./js/wray/assert.js"
              "./js/wray/log.js"
              "./js/wray/matrix44.js"
              "./js/wray/color.js"
              "./js/wray/vertex.js"
              "./js/wray/vector.js"
              "./js/wray/ray.js"
              "./js/wray/surface.js"
              "./js/wray/sky.js"
              "./js/wray/material.js"
              "./js/wray/triangle.js"
              "./js/wray/camera.js"
              "./js/wray/bvh.js")

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
cp "./js/wray/thread-marshal.js" "$DIRECTORY/wray-thread-marshal.js"
cp "./js/wray/thread-worker.js" "$DIRECTORY/wray-thread-worker.js"

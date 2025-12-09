#!/bin/bash

magick convert images/favicon.svg -resize 512x512 images/favicon.png
magick convert images/favicon.svg -define icon:auto-resize=16,32,48,64,128 images/favicon.ico
#!/bin/bash
echo $1
echo $2
cd samples
youtube-dl --extract-audio --audio-format mp3 -o "tmp_export.%(ext)s" $1
#keep first 30sec
ffmpeg -t 30 -i tmp_export.mp3 -acodec copy $2.mp3
rm tmp_export.mp3



# Blind Testing Bot!

This is a discord bot who will provide you with a system of music quiz, either with sound samples or lyrics


# Files

`music.js` is the main file where the magic happens
`download_and_cut.sh`<youtube_link> <final_name> : will download the specified youtube video, extract the sound, and keep the first 30 seconds in your `samples/` directory
`samples/` is where you can put your mp3 samples
`lyrics/` is where you can put your .txt lyrics files
`badtr/` is where you can put the .txt files you want to use in the Bad Translation function

# Usage
The bot provides help with the `$help` command
You can use these commands : 
`$play` : connects to the channel specified and plays a sample from your `samples/` folder, waiting for anyone to answer with the name of the song
`$lyrics` : writes down each line of the lyrics of a song, every second. Stops when anyone answers with the name of the song
`$badtr` : basically do the same thing as `$lyrics`, but with bad translations from Google Translate
`$list` : display the samples available (for checking purposes, don't cheat !)
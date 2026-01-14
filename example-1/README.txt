cSound WASM improving UI

Here I use separate files for HTML and JS - it makes sense as we will write way more JS now to create a nicer looking UI and a drag and drop functionality to play files. You will notice that this increases the complexity a fair amount - we are now using a .css stylesheet, and need more logic in the JS file. I recommend only using .wavs in this - as explained in the previous example.

I also added a waveform visual, utilizing webAudio api decodeAudioData() function. That same webAudio can be used for realtime audio analysis to use with VU meters and other widgets you suggested, but complexity will keep increasing for those. If these files will be used for tutorial purposes, perhaps the graphics can be skipped. 

As a reminder - to run this on your machine, open the folder containing this example in VS  code, and hit 'Go Live'. Make sure only this folder is open, not the folder containing all the examples, as we cant have more than one index.html. 
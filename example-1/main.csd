<CsoundSynthesizer>
<CsOptions>
-odac   
</CsOptions>
<CsInstruments>

sr = 44100
ksmps = 32
nchnls = 2
0dbfs  = 1

chn_k "vol", 1

instr 1

    kvol chnget "vol"

    ;Getting the string from the chnget allows us to dynamically change the file we are playing
    Sfile chnget "filename"
    ar1, ar2 diskin2 Sfile, 1 
            outs ar1 * kvol, ar2 * kvol

endin


</CsInstruments>
<CsScore>

i 1 0 30 ; play 30 seconds
e

</CsScore>

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
chn_k "level", 2

instr 1

    kvol chnget "vol"

    ;Getting the string from the chnget allows us to dynamically change the file we are playing
    Sfile chnget "filename"
    ar1, ar2 diskin2 Sfile, 1

    ; Apply volume
    aoutL = ar1 * kvol
    aoutR = ar2 * kvol

    ; Calculate RMS level (average of both channels)
    krms rms (aoutL + aoutR) / 2, 20

    ; Simple linear scaling (0-1)
    klevel = krms * 2
    klevel = (klevel > 1 ? 1 : klevel)

    ; Send level to output channel
    chnset klevel, "level"

    outs aoutL, aoutR

endin


</CsInstruments>
<CsScore>

i 1 0 z 
</CsScore>

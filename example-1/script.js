import { Csound } from "https://cdn.jsdelivr.net/npm/@csound/browser@6.18.7/dist/csound.js";

async function loadCSD(url) {
  const res = await fetch(url);
  return await res.text();
}

function drawWaveform(audioBuffer) {
  const canvas = document.getElementById("waveform");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;
  
  // Clear canvas
  ctx.fillStyle = "#f0f0f0";
  ctx.fillRect(0, 0, width, height);
  
  // Draw center line
  ctx.strokeStyle = "#ccc";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(0, height / 2);
  ctx.lineTo(width, height / 2);
  ctx.stroke();
  
  // Get audio data from first channel
  const data = audioBuffer;
  const step = Math.ceil(data.length / width);
  const amp = height / 2;
  
  // Draw waveform (symmetrical around center)
  ctx.strokeStyle = "#4CAF50";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  
  for (let i = 0; i < width; i++) {
    let min = 1.0;
    let max = -1.0;
    
    // Find min and max in this segment
    for (let j = 0; j < step; j++) {
      const datum = data[(i * step) + j] || 0;
      if (datum < min) min = datum;
      if (datum > max) max = datum;
    }
    
    // Draw from min to max, centered at height/2
    const yMax = (height / 2) - (max * amp);
    const yMin = (height / 2) - (min * amp);
    
    ctx.moveTo(i, yMax);
    ctx.lineTo(i, yMin);
  }
  
  ctx.stroke();
  canvas.style.display = "block";
}

// Track audio initialization state
let audioInitialized = false;
let isStarted = false;

async function ensureAudioReady() {
  if (!audioInitialized) {
    // Resume the audio context (requires user gesture)
    const audioContext = await cs.getAudioContext();
    if (audioContext.state === 'suspended') {
      await audioContext.resume();
    }
    audioInitialized = true;
  }
}

const cs = await Csound();

const csd = await loadCSD("main.csd");
await cs.compileCsdText(csd);

// Volume slider - set initial volume in Csound
const volSlider = document.getElementById("vol");
cs.setControlChannel("vol", parseFloat(volSlider.value));

volSlider.oninput = () => {
  cs.setControlChannel("vol", parseFloat(volSlider.value));
};

// Hide stop button initially
document.getElementById("stopBtn").style.display = "none";

// Stop button - pauses instead of stopping
document.getElementById("stopBtn").onclick = () => {
  cs.pause();
  document.getElementById("stopBtn").style.display = "none";
};

// Drag and drop
document.body.addEventListener('dragover', (e) => {
  e.preventDefault();
  e.stopPropagation();
  document.body.style.backgroundColor = '#e0e0e0';
});

document.body.addEventListener('dragleave', () => {
  document.body.style.backgroundColor = '';
});

document.body.addEventListener('drop', async (e) => {
  e.preventDefault();
  e.stopPropagation();
  document.body.style.backgroundColor = '';
  
  const file = e.dataTransfer.files[0];
  if (!file) return;
  
  // Ensure audio context is ready before doing anything (this mifht be our issue)
  await ensureAudioReady();
  
  // Stop Csound before loading new file
  await cs.stop();
  await cs.reset();
  
  // Load dropped file 
  const arrayBuffer = await file.arrayBuffer();
  const droppedFileData = new Uint8Array(arrayBuffer);
  await cs.fs.writeFile(`/${file.name}`, droppedFileData);
  
  // Draw waveform using Web Audio API
  try {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
    drawWaveform(audioBuffer.getChannelData(0));
  } catch (err) {
    console.error("Could not draw waveform:", err);
  }
  
  // Recompile CSD
  await cs.compileCsdText(await loadCSD("main.csd"));
  
  // Reset volume to slider value
  await cs.setControlChannel("vol", parseFloat(volSlider.value));
  
  // Update filename display
  document.getElementById("filename").textContent = `Loaded: ${file.name}`;
  
  console.log(`Loaded: ${file.name}`);
  
  // Update control channel with new filename
  await cs.setStringChannel('filename', `/${file.name}`);
  
  // Auto-start playback and show stop button
  await cs.start();
  document.getElementById("stopBtn").style.display = "inline-block";
});
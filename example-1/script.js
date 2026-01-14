import { Csound } from "https://cdn.jsdelivr.net/npm/@csound/browser@6.18.7/dist/csound.js";

async function loadCSD(url) {
  const res = await fetch(url);
  return await res.text();
}

// Store waveform data for redrawing with progress bar
let waveformData = null;
let audioDuration = 0;

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

function drawProgressBar(progress) {
  const canvas = document.getElementById("waveform");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  // Redraw waveform first
  if (waveformData) {
    drawWaveform(waveformData);
  }

  // Draw progress bar
  const x = progress * width;
  ctx.strokeStyle = "#FF5722";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, 0);
  ctx.lineTo(x, height);
  ctx.stroke();
}

// Track audio initialization state
let audioInitialized = false;
let isStarted = false;

// Track playback progress
let playbackStartTime = 0;
let pausedElapsedTime = 0;
let animationFrameId = null;
let isPlaying = false;

// Level meter elements
const meter = document.getElementById("meter");
let meterAnimationId = null;

function animateProgress() {
  if (!isPlaying || audioDuration === 0) return;

  const elapsed = pausedElapsedTime + (performance.now() - playbackStartTime) / 1000; // Convert to seconds
  const progress = Math.min(elapsed / audioDuration, 1);

  drawProgressBar(progress);

  if (progress < 1) {
    animationFrameId = requestAnimationFrame(animateProgress);
  } else {
    isPlaying = false;
    pausedElapsedTime = 0;
    document.getElementById("playPauseBtn").textContent = "Play";
  }
}

function startProgressAnimation() {
  playbackStartTime = performance.now();
  isPlaying = true;
  animateProgress();
}

function pauseProgressAnimation() {
  if (isPlaying) {
    pausedElapsedTime += (performance.now() - playbackStartTime) / 1000;
    isPlaying = false;
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  }
}

function stopProgressAnimation() {
  isPlaying = false;
  pausedElapsedTime = 0;
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId);
    animationFrameId = null;
  }
}

// Level meter update loop
async function updateLevelMeters() {
  // Read level value from Csound channel (0-1 range)
  const level = await cs.getControlChannel("level");

  // Update meter bar width and color based on level
  if (meter && level !== undefined && level !== null) {
    // Convert to dB and map to logarithmic scale for display
    // Map -60dB to 0%, 0dB to 100%
    let dbLevel;
    if (level > 0.0001) {
      dbLevel = 20 * Math.log10(level); // Convert to dB
      // Map -60dB to 0%, 0dB to 100%
      const displayWidth = ((dbLevel + 60) / 60) * 100;
      meter.style.width = `${Math.max(0, Math.min(100, displayWidth))}%`;
    } else {
      meter.style.width = "0%";
    }

    // Change color based on thresholds 
    if (level < 0.6) {
      meter.style.backgroundColor = "#4CAF50"; // Green - safe
    } else if (level < 0.8) {
      meter.style.backgroundColor = "#FFC107"; // Yellow - moderate
    } else if (level < 0.9) {
      meter.style.backgroundColor = "#FF9800"; // Orange - high
    } else {
      meter.style.backgroundColor = "#F44336"; // Red - hot/clipping
    }
  }

  // Continue animation loop
  meterAnimationId = requestAnimationFrame(updateLevelMeters);
}

function startLevelMeters() {
  if (!meterAnimationId) {
    updateLevelMeters();
  }
}

function stopLevelMeters() {
  if (meterAnimationId) {
    cancelAnimationFrame(meterAnimationId);
    meterAnimationId = null;
  }
  // Reset meter to zero
  if (meter) {
    meter.style.width = "0%";
  }
}

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

// Hide play/pause button initially
document.getElementById("playPauseBtn").style.display = "none";

// Play/Pause button toggle
document.getElementById("playPauseBtn").onclick = async () => {
  const btn = document.getElementById("playPauseBtn");

  if (isPlaying) {
    // Currently playing, so pause
    await cs.pause();
    pauseProgressAnimation();
    btn.textContent = "Play";
    // Note: Level meters continue running even when paused
  } else {
    // Currently paused, so resume
    await ensureAudioReady();
    await cs.resume();
    startProgressAnimation();
    btn.textContent = "Pause";
  }
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

  // Ensure audio context is ready before doing anything
  await ensureAudioReady();

  // Stop any existing animations
  stopProgressAnimation();
  stopLevelMeters();

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
    waveformData = audioBuffer.getChannelData(0);
    audioDuration = audioBuffer.duration;
    drawWaveform(waveformData);
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
  
  // Auto-start playback and show play/pause button
  await cs.start();
  startProgressAnimation();
  startLevelMeters();
  const playPauseBtn = document.getElementById("playPauseBtn");
  playPauseBtn.textContent = "Pause";
  playPauseBtn.style.display = "inline-block";
});
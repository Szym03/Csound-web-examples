const url = "https://cdn.jsdelivr.net/npm/@csound/browser@7.0.0-beta26/dist/csound.js";

const orc = `
sr = 44100
ksmps = 256
nchnls = 2
0dbfs  = 1

instr 1

    kvol chnget "vol"

    ;Getting the string from the chnget allows to dynamically change the file we are playing
    Sfile chnget "filename"
    ar1, ar2 diskin Sfile, 1

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

    out aoutL, aoutR

endin

schedule(1, 0, -1)
`;

// Store waveform data for redrawing with progress bar
let waveformData = null;
let audioDuration = 0;

// Store multiple files 
let audioFiles = [];
let currentFileIndex = -1;

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
      meter.style.backgroundColor = "#F44336"; // Red - clipping
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

// Initialize Csound with 7.0 API
const { Csound } = await import(url);
const cs = await Csound({
  useWorker: false,
  useSPN: false,
  outputChannelCount: 2,
});

await cs.compileOrc(orc);
await cs.setOption("-odac");

// Volume slider - set initial volume in Csound
const volSlider = document.getElementById("vol");
cs.setControlChannel("vol", parseFloat(volSlider.value));

volSlider.oninput = () => {
  cs.setControlChannel("vol", parseFloat(volSlider.value));
};

// Initialize file display
updateFileDisplay();

// Hide playback controls initially
document.getElementById("playPauseBtn").style.display = "none";
document.getElementById("prevBtn").style.display = "none";
document.getElementById("nextBtn").style.display = "none";
document.getElementById("rewindBtn").style.display = "none";

// Function to load and play a file by index
async function loadAndPlayFile(index) {
  if (index < 0 || index >= audioFiles.length) return;

  currentFileIndex = index;
  const file = audioFiles[index];

  // Update display immediately for responsive UI
  updateFileDisplay();
  updateButtonStates();

  // Ensure audio context is ready
  await ensureAudioReady();

  // Stop any existing animations
  stopProgressAnimation();
  stopLevelMeters();

  // Stop and completely restart Csound to avoid glitches
  await cs.stop();
  await cs.reset();

  // Reinitialize Csound from scratch
  const { Csound } = await import(url);
  const csNew = await Csound({
    useWorker: false,
    useSPN: false,
    outputChannelCount: 2,
  });

  await csNew.compileOrc(orc);
  await csNew.setOption("-odac");

  // Replace global cs reference
  Object.assign(cs, csNew);

  // Load the file into Csound's filesystem
  const arrayBuffer = await file.arrayBuffer();
  const fileData = new Uint8Array(arrayBuffer);
  await cs.fs.writeFile(`/${file.name}`, fileData);

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

  // Reset volume to slider value
  await cs.setControlChannel("vol", parseFloat(volSlider.value));

  // Update control channel with filename
  await cs.setStringChannel('filename', `/${file.name}`);

  // Auto-start playback
  await cs.start();
  startProgressAnimation();
  startLevelMeters();
  document.getElementById("playPauseBtn").textContent = "Pause";
}

// Update button states based on current file index
function updateButtonStates() {
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  prevBtn.disabled = audioFiles.length <= 1;
  nextBtn.disabled = audioFiles.length <= 1;
}

// Update file list display
function updateFileDisplay() {
  const filenameDiv = document.getElementById("filename");

  if (audioFiles.length === 0) {
    filenameDiv.innerHTML = "No files loaded";
    return;
  }

  let html = '<div class="file-list">';
  audioFiles.forEach((file, index) => {
    const isPlaying = index === currentFileIndex;
    const className = isPlaying ? 'file-item playing' : 'file-item';
    html += `<div class="${className}" data-index="${index}">
      ${isPlaying ? '▶ ' : ''}${file.name}
    </div>`;
  });
  html += '</div>';

  filenameDiv.innerHTML = html;

  // Add click handlers to file items
  document.querySelectorAll('.file-item').forEach(item => {
    item.addEventListener('click', async () => {
      const index = parseInt(item.dataset.index);
      await loadAndPlayFile(index);
    });
  });
}

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

// Previous button
document.getElementById("prevBtn").onclick = async () => {
  if (audioFiles.length === 0) return;

  let newIndex = currentFileIndex - 1;
  if (newIndex < 0) {
    newIndex = audioFiles.length - 1; // Loop to end
  }

  await loadAndPlayFile(newIndex);
};

// Next button
document.getElementById("nextBtn").onclick = async () => {
  if (audioFiles.length === 0) return;

  let newIndex = currentFileIndex + 1;
  if (newIndex >= audioFiles.length) {
    newIndex = 0; // Loop to beginning
  }

  await loadAndPlayFile(newIndex);
};

// Rewind button
document.getElementById("rewindBtn").onclick = async () => {
  if (audioFiles.length === 0) return;

  await loadAndPlayFile(currentFileIndex);
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

  const files = Array.from(e.dataTransfer.files);
  if (files.length === 0) return;

  // Ensure audio context is ready
  await ensureAudioReady();

  // Add files to the list (just store File objects)
  files.forEach(file => {
    audioFiles.push(file);
    console.log(`Added: ${file.name}`);
  });

  // Update the file list display
  updateFileDisplay();

  // Show playback controls
  document.getElementById("playPauseBtn").style.display = "inline-block";
  document.getElementById("prevBtn").style.display = "inline-block";
  document.getElementById("nextBtn").style.display = "inline-block";
  document.getElementById("rewindBtn").style.display = "inline-block";

  // If this is the first file(s), start playing the first one
  if (currentFileIndex === -1) {
    await loadAndPlayFile(0);
  }
});
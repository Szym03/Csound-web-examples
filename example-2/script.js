// Keyboard Controls (Slideshow):
// Left/Right Arrows - Navigate photos within section
// Up/Down Arrows - Navigate between sections
// Spacebar - Play/Pause slideshow
// M - Toggle music play/pause
// H - Show/Hide controls
// Escape - Close slideshow

//============= Csound setup =======================
const url = "https://cdn.jsdelivr.net/npm/@csound/browser@7.0.0-beta26/dist/csound.js"
let csound = null;
let audioContext = null;

const audioOrchestra = `
    sr=44100
    ksmps=128
    0dbfs=1
    nchnls=2

    instr 1
      Sfile strget p4
      kvol chnget "musicvol"
      a1, a2 diskin Sfile, 1
      a1 = a1 * kvol
      a2 = a2 * kvol
      out a1, a2
    endin
     `;

async function loadUserAudioFile(csound, file) {
    const arrayBuffer = await file.arrayBuffer();
    const filename = file.name;
    await csound.fs.writeFile(filename, new Uint8Array(arrayBuffer));
    return filename;
}

const startCsound = async () => {
  const { Csound } = await import(url);
  audioContext = new AudioContext({ sampleRate: 44100 });

  const csoundObj = await Csound({
    useWorker: false,
    useSPN: false,
    outputChannelCount: 2,
    audioContext: audioContext
  });

  await csoundObj.compileOrc(audioOrchestra, 0);
  await csoundObj.setOption("-odac");
  await csoundObj.start();

  await csoundObj.getNode();

  // Set initial volume
  await csoundObj.setControlChannel("musicvol", 0.7);

  csound = csoundObj;
  console.log("Csound initialized and ready, sample rate:", audioContext.sampleRate);
  return csoundObj;
};

async function playAudioFile(filename) {
  if (!csound) {
    await startCsound();
  }

  // Stop any currently playing audio
  await stopAllAudio();

  // Play the audio file using instrument 1
  await csound.inputMessage(`i 1 0 -1 "${filename}"`);
  console.log(`Playing: ${filename}`);

  // Resume audio context if it was suspended
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
  }

  return filename;
}

async function stopAllAudio() {
  if (!csound) return;

  // Stop all currently playing instruments
  await csound.inputMessage('i -1 0 0');
}

async function pauseAudio() {
  if (audioContext && audioContext.state === 'running') {
    await audioContext.suspend();
    console.log('Audio paused');
  }
}

async function resumeAudio() {
  if (audioContext && audioContext.state === 'suspended') {
    await audioContext.resume();
    console.log('Audio resumed');
  }
}

//============ Application Code ========================
// Section-based data structure
let sections = [];
let sectionIdCounter = 0;

// Default color palette for sections
const COLOR_PALETTE = [
  '#f4e4d7', // beige
  '#e8f4d7', // light green
  '#d7e8f4', // light blue
  '#f4d7e8', // light pink
  '#f4ead7', // peach
  '#e8d7f4', // lavender
  '#d7f4ea', // mint
  '#f4d7d7'  // light coral
];

// DOM elements
const sectionsContainer = document.getElementById('decadesContainer');
const addSectionBtn = document.getElementById('addDecadeBtn');
const startSlideshowBtn = document.getElementById('startSlideshowBtn');

// Slideshow elements
const slideshowModal = document.getElementById('slideshowModal');
const slideshowImage = document.getElementById('slideshowImage');
const slideshowSectionLabel = document.getElementById('slideshowSectionLabel');
const slideshowImageCounter = document.getElementById('slideshowImageCounter');
const slideshowMusicInfo = document.getElementById('slideshowMusicInfo');
const slideshowContent = document.getElementById('slideshowContent');
const slideshowControlsWrapper = document.getElementById('slideshowControlsWrapper');
const closeSlideshowBtn = document.getElementById('closeSlideshowBtn');
const slideshowToggleControlsBtn = document.getElementById('slideshowToggleControlsBtn');
const slideshowPrevImageBtn = document.getElementById('slideshowPrevImageBtn');
const slideshowNextImageBtn = document.getElementById('slideshowNextImageBtn');
const slideshowPrevSectionBtn = document.getElementById('slideshowPrevSectionBtn');
const slideshowNextSectionBtn = document.getElementById('slideshowNextSectionBtn');
const slideshowPlayPauseBtn = document.getElementById('slideshowPlayPauseBtn');
const slideshowMusicPlayPauseBtn = document.getElementById('slideshowMusicPlayPauseBtn');
const slideshowPrevSongBtn = document.getElementById('slideshowPrevSongBtn');
const slideshowNextSongBtn = document.getElementById('slideshowNextSongBtn');
const slideshowVolumeSlider = document.getElementById('slideshowVolumeSlider');
const slideshowVolumeValue = document.getElementById('slideshowVolumeValue');

// Slideshow state
let slideshowActive = false;
let slideshowSections = []; // Array of sections with their images
let currentSectionIndex = 0; // Current section index
let currentImageIndex = 0; // Current image within section
let slideshowInterval = null;
let slideshowPlaying = true;
let currentSectionAudio = []; // Current section's audio files
let currentAudioIndex = 0; // Current audio track index
let musicPlaying = false;
let currentAudioFilename = null; // Track the current playing filename
let controlsVisible = true; // Track controls visibility
let lastSectionId = null; // Track last section to detect changes

// Preview audio state
let previewPlayingButton = null; // Track which button is playing
let previewAudioData = null; // Track which audio is playing in preview

// Initialize: Add event listener for "Add Section" button
addSectionBtn.addEventListener('click', addSection);

// Initialize: Add event listener for "Start Slideshow" button
startSlideshowBtn.addEventListener('click', startSlideshow);

// Add a new section
function addSection() {
  const sectionId = sectionIdCounter++;

  // Assign color from palette (cycle through if we exceed palette length)
  const colorIndex = sections.length % COLOR_PALETTE.length;

  const section = {
    id: sectionId,
    label: `Section ${sections.length + 1}`, // Default label
    bgColor: COLOR_PALETTE[colorIndex],
    images: [],
    audio: [], // Empty for now
    transitionSpeed: 3 // Default 3 seconds per photo
  };

  sections.push(section);

  // Remove empty state message if it exists
  const emptyState = sectionsContainer.querySelector('.empty-state');
  if (emptyState) {
    emptyState.remove();
  }

  renderSection(section);
}

// Render a single section in the DOM
function renderSection(sectionData) {
  const sectionElement = document.createElement('div');
  sectionElement.className = 'section-item';
  sectionElement.dataset.sectionId = sectionData.id;
  sectionElement.style.backgroundColor = sectionData.bgColor;

  // Section header with controls
  const header = document.createElement('div');
  header.className = 'section-header';

  // Editable label
  const labelContainer = document.createElement('div');
  labelContainer.className = 'section-label-container';

  const label = document.createElement('h2');
  label.className = 'section-label';
  label.textContent = sectionData.label;
  label.contentEditable = false;

  const editBtn = document.createElement('button');
  editBtn.className = 'edit-label-btn';
  editBtn.textContent = 'Edit';
  editBtn.addEventListener('click', () => toggleLabelEdit(sectionData.id, label, editBtn));

  labelContainer.appendChild(label);
  labelContainer.appendChild(editBtn);

  // Control buttons container
  const controls = document.createElement('div');
  controls.className = 'section-controls';

  // Color picker
  const colorPickerLabel = document.createElement('label');
  colorPickerLabel.className = 'color-picker-label';
  colorPickerLabel.textContent = 'Color: ';

  const colorPicker = document.createElement('input');
  colorPicker.type = 'color';
  colorPicker.className = 'color-picker';
  colorPicker.value = sectionData.bgColor;
  colorPicker.addEventListener('change', (e) => updateSectionColor(sectionData.id, e.target.value));

  colorPickerLabel.appendChild(colorPicker);

  // Transition speed control
  const speedLabel = document.createElement('label');
  speedLabel.className = 'speed-label';

  const speedText = document.createElement('span');
  speedText.textContent = 'Sec/Photo: ';

  const speedInput = document.createElement('input');
  speedInput.type = 'number';
  speedInput.className = 'speed-input';
  speedInput.min = '1';
  speedInput.max = '10';
  speedInput.step = '1';
  speedInput.value = sectionData.transitionSpeed;
  speedInput.title = 'Seconds per photo in slideshow';
  speedInput.addEventListener('change', (e) => updateTransitionSpeed(sectionData.id, parseInt(e.target.value)));

  const speedUnit = document.createElement('span');
  speedUnit.className = 'speed-unit';
  speedUnit.textContent = 's';

  speedLabel.appendChild(speedText);
  speedLabel.appendChild(speedInput);
  speedLabel.appendChild(speedUnit);

  // Remove section button
  const removeSectionBtn = document.createElement('button');
  removeSectionBtn.className = 'remove-section-btn';
  removeSectionBtn.textContent = 'Remove Section';
  removeSectionBtn.addEventListener('click', () => removeSection(sectionData.id));

  controls.appendChild(colorPickerLabel);
  controls.appendChild(speedLabel);
  controls.appendChild(removeSectionBtn);

  header.appendChild(labelContainer);
  header.appendChild(controls);

  // File input for this section
  const uploadContainer = document.createElement('div');
  uploadContainer.className = 'upload-container';

  const fileInputLabel = document.createElement('label');
  fileInputLabel.className = 'file-input-label';
  fileInputLabel.textContent = 'Add Pictures';

  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.className = 'section-file-input';
  fileInput.accept = 'image/*';
  fileInput.multiple = true;
  fileInput.addEventListener('change', (e) => handleImageUpload(e, sectionData.id));

  fileInputLabel.appendChild(fileInput);
  uploadContainer.appendChild(fileInputLabel);

  // Audio file input for this section
  const audioInputLabel = document.createElement('label');
  audioInputLabel.className = 'audio-input-label';
  audioInputLabel.textContent = 'Add Music';

  const audioInput = document.createElement('input');
  audioInput.type = 'file';
  audioInput.className = 'section-audio-input';
  audioInput.accept = 'audio/*';
  audioInput.multiple = true;
  audioInput.addEventListener('change', (e) => handleAudioUpload(e, sectionData.id));

  audioInputLabel.appendChild(audioInput);
  uploadContainer.appendChild(audioInputLabel);

  // Audio container for this section
  const audioContainer = document.createElement('div');
  audioContainer.className = 'section-audio-container';
  audioContainer.dataset.sectionId = sectionData.id;

  // Add placeholder if no audio
  if (sectionData.audio.length === 0) {
    const audioPlaceholder = document.createElement('p');
    audioPlaceholder.className = 'audio-placeholder';
    audioPlaceholder.textContent = 'No music yet. Click "Add Music" to upload.';
    audioContainer.appendChild(audioPlaceholder);
  } else {
    // Render existing audio files
    sectionData.audio.forEach((audioData, index) => {
      displayAudioFile(audioData, index, sectionData.id, audioContainer);
    });
  }

  // Image gallery for this section
  const gallery = document.createElement('div');
  gallery.className = 'section-gallery';
  gallery.dataset.sectionId = sectionData.id;

  // Add placeholder if no images
  if (sectionData.images.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'No images yet. Click "Add Pictures" to upload.';
    gallery.appendChild(placeholder);
  } else {
    // Render existing images
    sectionData.images.forEach((imageData, index) => {
      displayImage(imageData, index, sectionData.id, gallery);
    });
  }

  // Assemble the section
  sectionElement.appendChild(header);
  sectionElement.appendChild(uploadContainer);
  sectionElement.appendChild(audioContainer);
  sectionElement.appendChild(gallery);

  sectionsContainer.appendChild(sectionElement);
}

// Toggle label editing
function toggleLabelEdit(sectionId, labelElement, editBtn) {
  const isEditing = labelElement.contentEditable === 'true';

  if (isEditing) {
    // Save changes
    labelElement.contentEditable = 'false';
    labelElement.classList.remove('editing');
    editBtn.textContent = 'Edit';

    // Update section label in data
    const section = sections.find(s => s.id === sectionId);
    if (section) {
      section.label = labelElement.textContent.trim() || `Section ${sections.indexOf(section) + 1}`;
      labelElement.textContent = section.label; // Clean up display
    }
  } else {
    // Enter edit mode
    labelElement.contentEditable = 'true';
    labelElement.classList.add('editing');
    labelElement.focus();
    editBtn.textContent = 'Save';

    // Select all text for easy editing
    const range = document.createRange();
    range.selectNodeContents(labelElement);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
  }
}

// Update section background color
function updateSectionColor(sectionId, newColor) {
  const section = sections.find(s => s.id === sectionId);
  if (section) {
    section.bgColor = newColor;

    // Update the section background
    const sectionElement = document.querySelector(`.section-item[data-section-id="${sectionId}"]`);
    if (sectionElement) {
      sectionElement.style.backgroundColor = newColor;
    }
  }
}

// Update section transition speed
function updateTransitionSpeed(sectionId, newSpeed) {
  const section = sections.find(s => s.id === sectionId);
  if (section) {
    section.transitionSpeed = Math.max(1, Math.min(10, newSpeed)); // Clamp between 1-10

    // If this section is currently showing in slideshow, restart the interval
    if (slideshowActive && slideshowSections[currentSectionIndex]?.id === sectionId) {
      startSlideshowAutoAdvance();
    }
  }
}

// Remove a section
function removeSection(sectionId) {
  // Find section and confirm if it has images
  const section = sections.find(s => s.id === sectionId);
  if (section && section.images.length > 0) {
    const confirmed = confirm(`This section has ${section.images.length} image(s). Are you sure you want to remove it?`);
    if (!confirmed) return;
  }

  // Remove from data
  sections = sections.filter(s => s.id !== sectionId);

  // Remove from DOM
  const sectionElement = document.querySelector(`.section-item[data-section-id="${sectionId}"]`);
  if (sectionElement) {
    sectionElement.remove();
  }

  // If no sections left, show empty state
  if (sections.length === 0) {
    const emptyState = document.createElement('p');
    emptyState.className = 'empty-state';
    emptyState.textContent = 'No sections yet. Click "Add Section" to get started.';
    sectionsContainer.appendChild(emptyState);
  }
}

// Handle image upload for a specific section
function handleImageUpload(event, sectionId) {
  const files = event.target.files;
  const section = sections.find(s => s.id === sectionId);

  if (!section || files.length === 0) return;

  // Load each selected image
  Array.from(files).forEach(file => {
    if (file.type.startsWith('image/')) {
      loadImage(file, sectionId);
    }
  });

  // Reset input so the same file can be selected again if needed
  event.target.value = '';
}

// Load and display an image (modified to support section context)
function loadImage(file, sectionId) {
  const reader = new FileReader();

  reader.onload = (e) => {
    const imageData = {
      src: e.target.result,
      name: file.name
    };

    // Find the section and add image to its array
    const section = sections.find(s => s.id === sectionId);
    if (section) {
      section.images.push(imageData);

      // Get the gallery element for this section
      const gallery = document.querySelector(`.section-gallery[data-section-id="${sectionId}"]`);
      if (gallery) {
        // Remove placeholder if it exists
        const placeholder = gallery.querySelector('.placeholder');
        if (placeholder) {
          placeholder.remove();
        }

        // Display the new image
        const imageIndex = section.images.length - 1;
        displayImage(imageData, imageIndex, sectionId, gallery);
      }
    }
  };

  reader.readAsDataURL(file);
}

// Display an image in the gallery (modified to support section context)
function displayImage(imageData, index, sectionId, galleryElement) {
  const container = document.createElement('div');
  container.className = 'image-container';
  container.dataset.index = index;

  const img = document.createElement('img');
  img.src = imageData.src;
  img.alt = imageData.name;
  img.title = imageData.name;

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.innerHTML = '&times;';
  removeBtn.title = 'Remove image';
  removeBtn.addEventListener('click', () => removeImage(sectionId, index));

  container.appendChild(img);
  container.appendChild(removeBtn);
  galleryElement.appendChild(container);
}

// Remove a specific image from a section
function removeImage(sectionId, imageIndex) {
  const section = sections.find(s => s.id === sectionId);
  if (!section) return;

  // Remove from array
  section.images.splice(imageIndex, 1);

  // Refresh the gallery for this section
  refreshSectionGallery(sectionId);
}

// Refresh the gallery display for a specific section
function refreshSectionGallery(sectionId) {
  const section = sections.find(s => s.id === sectionId);
  if (!section) return;

  const gallery = document.querySelector(`.section-gallery[data-section-id="${sectionId}"]`);
  if (!gallery) return;

  gallery.innerHTML = '';

  if (section.images.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'No images yet. Click "Add Pictures" to upload.';
    gallery.appendChild(placeholder);
  } else {
    section.images.forEach((imageData, index) => {
      displayImage(imageData, index, sectionId, gallery);
    });
  }
}

// Handle audio upload for a specific section
function handleAudioUpload(event, sectionId) {
  const files = event.target.files;
  const section = sections.find(s => s.id === sectionId);

  if (!section || files.length === 0) return;

  // Load each selected audio file
  Array.from(files).forEach(file => {
    if (file.type.startsWith('audio/')) {
      loadAudioFile(file, sectionId);
    }
  });

  // Reset input so the same file can be selected again if needed
  event.target.value = '';
}

// Load an audio file
function loadAudioFile(file, sectionId) {
  const audioData = {
    name: file.name,
    file: file
  };

  // Find the section and add audio to its array
  const section = sections.find(s => s.id === sectionId);
  if (section) {
    section.audio.push(audioData);

    // Get the audio container element for this section
    const audioContainer = document.querySelector(`.section-audio-container[data-section-id="${sectionId}"]`);
    if (audioContainer) {
      // Remove placeholder if it exists
      const placeholder = audioContainer.querySelector('.audio-placeholder');
      if (placeholder) {
        placeholder.remove();
      }

      // Display the new audio file
      const audioIndex = section.audio.length - 1;
      displayAudioFile(audioData, audioIndex, sectionId, audioContainer);
    }
  }
}

// Display an audio file in the container
function displayAudioFile(audioData, index, sectionId, audioContainer) {
  const audioItem = document.createElement('div');
  audioItem.className = 'audio-item';
  audioItem.dataset.index = index;

  const audioIcon = document.createElement('span');
  audioIcon.className = 'audio-icon';
  audioIcon.textContent = '\u266B'; // Music note symbol

  const audioName = document.createElement('span');
  audioName.className = 'audio-name';
  audioName.textContent = audioData.name;

  const playBtn = document.createElement('button');
  playBtn.className = 'play-audio-btn';
  playBtn.textContent = 'Play';
  playBtn.addEventListener('click', async () => {
    // Check if this button is already playing
    if (previewPlayingButton === playBtn) {
      // Stop the audio
      await stopAllAudio();
      playBtn.textContent = 'Play';
      previewPlayingButton = null;
      previewAudioData = null;
    } else {
      // Stop any other preview audio
      if (previewPlayingButton) {
        previewPlayingButton.textContent = 'Play';
      }

      // Initialize Csound if needed
      if (!csound) {
        await startCsound();
      }

      // Load and play the audio file
      const filename = await loadUserAudioFile(csound, audioData.file);
      await playAudioFile(filename);

      // Update state
      playBtn.textContent = 'Stop';
      previewPlayingButton = playBtn;
      previewAudioData = audioData;
    }
  });

  const removeBtn = document.createElement('button');
  removeBtn.className = 'remove-audio-btn';
  removeBtn.innerHTML = '&times;';
  removeBtn.title = 'Remove audio';
  removeBtn.addEventListener('click', () => removeAudio(sectionId, index));

  audioItem.appendChild(audioIcon);
  audioItem.appendChild(audioName);
  audioItem.appendChild(playBtn);
  audioItem.appendChild(removeBtn);
  audioContainer.appendChild(audioItem);
}

// Remove a specific audio file from a section
async function removeAudio(sectionId, audioIndex) {
  const section = sections.find(s => s.id === sectionId);
  if (!section) return;

  const audioToRemove = section.audio[audioIndex];

  // If this audio is currently playing in preview, stop it
  if (previewAudioData === audioToRemove) {
    await stopAllAudio();
    previewPlayingButton = null;
    previewAudioData = null;
  }

  // Remove from array
  section.audio.splice(audioIndex, 1);

  // Refresh the audio container for this section
  refreshSectionAudio(sectionId);
}

// Refresh the audio display for a specific section
function refreshSectionAudio(sectionId) {
  const section = sections.find(s => s.id === sectionId);
  if (!section) return;

  const audioContainer = document.querySelector(`.section-audio-container[data-section-id="${sectionId}"]`);
  if (!audioContainer) return;

  // Clear preview state if we're refreshing
  previewPlayingButton = null;
  previewAudioData = null;

  audioContainer.innerHTML = '';

  if (section.audio.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'audio-placeholder';
    placeholder.textContent = 'No music yet. Click "Add Music" to upload.';
    audioContainer.appendChild(placeholder);
  } else {
    section.audio.forEach((audioData, index) => {
      displayAudioFile(audioData, index, sectionId, audioContainer);
    });
  }
}

//============ Slideshow Functionality ========================

// Start the slideshow
function startSlideshow() {
  // Collect sections that have images
  slideshowSections = sections.filter(section => section.images.length > 0);

  // Check if there are any images
  if (slideshowSections.length === 0) {
    alert('No images to show! Please add some images to your sections first.');
    return;
  }

  // Initialize slideshow
  slideshowActive = true;
  currentSectionIndex = 0;
  currentImageIndex = 0;
  slideshowPlaying = true;
  currentSectionAudio = [];
  currentAudioIndex = 0;
  musicPlaying = false;
  currentAudioFilename = null;
  controlsVisible = true;
  lastSectionId = null;

  // Reset controls visibility
  slideshowContent.classList.remove('controls-hidden');
  slideshowControlsWrapper.classList.remove('hidden');
  slideshowToggleControlsBtn.textContent = 'Hide Controls';

  // Show modal
  slideshowModal.style.display = 'flex';

  // Display first image
  showSlideshowImage();

  // Start auto-advance
  startSlideshowAutoAdvance();

  // Add event listeners
  closeSlideshowBtn.addEventListener('click', closeSlideshow);
  slideshowToggleControlsBtn.addEventListener('click', toggleControls);
  slideshowPrevImageBtn.addEventListener('click', showPreviousImage);
  slideshowNextImageBtn.addEventListener('click', showNextImage);
  slideshowPrevSectionBtn.addEventListener('click', showPreviousSection);
  slideshowNextSectionBtn.addEventListener('click', showNextSection);
  slideshowPlayPauseBtn.addEventListener('click', toggleSlideshowPlayPause);
  slideshowMusicPlayPauseBtn.addEventListener('click', toggleMusicPlayPause);
  slideshowPrevSongBtn.addEventListener('click', playPreviousSong);
  slideshowNextSongBtn.addEventListener('click', playNextSong);
  slideshowVolumeSlider.addEventListener('input', updateMusicVolume);

  // Keyboard navigation
  document.addEventListener('keydown', handleSlideshowKeyboard);
}

// Close the slideshow
function closeSlideshow() {
  // Set flags first
  slideshowActive = false;
  slideshowPlaying = false;
  musicPlaying = false;
  lastSectionId = null;

  // Stop auto-advance
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
    slideshowInterval = null;
  }

  // Stop all audio (async but we don't need to wait)
  stopAllAudio().catch(err => console.error('Error stopping audio:', err));
  currentAudioFilename = null;
  currentSectionAudio = [];

  // Hide modal
  slideshowModal.style.display = 'none';

  // Remove event listeners
  closeSlideshowBtn.removeEventListener('click', closeSlideshow);
  slideshowPrevImageBtn.removeEventListener('click', showPreviousImage);
  slideshowNextImageBtn.removeEventListener('click', showNextImage);
  slideshowPrevSectionBtn.removeEventListener('click', showPreviousSection);
  slideshowNextSectionBtn.removeEventListener('click', showNextSection);
  slideshowPlayPauseBtn.removeEventListener('click', toggleSlideshowPlayPause);
  slideshowMusicPlayPauseBtn.removeEventListener('click', toggleMusicPlayPause);
  slideshowPrevSongBtn.removeEventListener('click', playPreviousSong);
  slideshowNextSongBtn.removeEventListener('click', playNextSong);
  slideshowVolumeSlider.removeEventListener('input', updateMusicVolume);
  slideshowToggleControlsBtn.removeEventListener('click', toggleControls);
  document.removeEventListener('keydown', handleSlideshowKeyboard);
}

// Show the current slide
async function showSlideshowImage() {
  if (currentSectionIndex < 0 || currentSectionIndex >= slideshowSections.length) return;

  const currentSection = slideshowSections[currentSectionIndex];

  // Ensure image index is valid
  if (currentImageIndex < 0 || currentImageIndex >= currentSection.images.length) {
    currentImageIndex = 0;
  }

  const currentImage = currentSection.images[currentImageIndex];

  // Update image
  slideshowImage.src = currentImage.src;
  slideshowImage.alt = currentImage.name;

  // Update section label
  slideshowSectionLabel.textContent = currentSection.label;

  // Update counter
  slideshowImageCounter.textContent = `Image ${currentImageIndex + 1} of ${currentSection.images.length} | Section ${currentSectionIndex + 1} of ${slideshowSections.length}`;

  // Update section navigation buttons
  slideshowPrevSectionBtn.disabled = (slideshowSections.length <= 1);
  slideshowNextSectionBtn.disabled = (slideshowSections.length <= 1);

  // Update image navigation buttons
  slideshowPrevImageBtn.disabled = (currentSection.images.length <= 1);
  slideshowNextImageBtn.disabled = (currentSection.images.length <= 1);

  // Handle audio when we move to a new section
  if (lastSectionId !== currentSection.id) {
    lastSectionId = currentSection.id;
    currentSectionAudio = currentSection.audio;
    currentAudioIndex = 0;

    // Update music info display
    updateMusicInfo();

    // Only play audio if section has audio files
    if (currentSectionAudio.length > 0) {
      // Initialize Csound if needed
      if (!csound) {
        await startCsound();
      }

      // Play the first audio file from this section
      await playSongByIndex(0);
    } else {
      // No audio in this section
      await stopAllAudio();
      musicPlaying = false;
      currentAudioFilename = null;
      slideshowMusicPlayPauseBtn.textContent = 'No Music';
      slideshowMusicPlayPauseBtn.disabled = true;
    }
  }
}

// Update the music info display
function updateMusicInfo() {
  if (currentSectionAudio.length === 0) {
    slideshowMusicInfo.textContent = 'No music in this section';
    slideshowPrevSongBtn.disabled = true;
    slideshowNextSongBtn.disabled = true;
    slideshowMusicPlayPauseBtn.disabled = true;
  } else {
    const currentSong = currentSectionAudio[currentAudioIndex];
    slideshowMusicInfo.textContent = `♫ ${currentSong.name} (${currentAudioIndex + 1}/${currentSectionAudio.length})`;
    slideshowPrevSongBtn.disabled = false;
    slideshowNextSongBtn.disabled = false;
    slideshowMusicPlayPauseBtn.disabled = false;
  }
}

// Play a song by index from current section
async function playSongByIndex(index) {
  if (index < 0 || index >= currentSectionAudio.length) return;

  currentAudioIndex = index;
  const audioData = currentSectionAudio[index];

  // Load and play the audio file
  const filename = await loadUserAudioFile(csound, audioData.file);
  currentAudioFilename = await playAudioFile(filename);
  musicPlaying = true;
  slideshowMusicPlayPauseBtn.textContent = 'Pause Music';

  // Update music info
  updateMusicInfo();
}

// Show previous image in current section
function showPreviousImage() {
  const currentSection = slideshowSections[currentSectionIndex];
  currentImageIndex--;
  if (currentImageIndex < 0) {
    currentImageIndex = currentSection.images.length - 1; // Loop to end of section
  }
  showSlideshowImage();
}

// Show next image in current section
function showNextImage() {
  const currentSection = slideshowSections[currentSectionIndex];
  currentImageIndex++;
  if (currentImageIndex >= currentSection.images.length) {
    currentImageIndex = 0; // Loop to beginning of section
  }
  showSlideshowImage();
}

// Show previous section
function showPreviousSection() {
  currentSectionIndex--;
  if (currentSectionIndex < 0) {
    currentSectionIndex = slideshowSections.length - 1; // Loop to last section
  }
  currentImageIndex = 0; // Start at first image of section
  showSlideshowImage();
  // Restart auto-advance with new section's speed
  if (slideshowPlaying) {
    startSlideshowAutoAdvance();
  }
}

// Show next section
function showNextSection() {
  currentSectionIndex++;
  if (currentSectionIndex >= slideshowSections.length) {
    currentSectionIndex = 0; // Loop to first section
  }
  currentImageIndex = 0; // Start at first image of section
  showSlideshowImage();
  // Restart auto-advance with new section's speed
  if (slideshowPlaying) {
    startSlideshowAutoAdvance();
  }
}

// Toggle play/pause
function toggleSlideshowPlayPause() {
  slideshowPlaying = !slideshowPlaying;

  if (slideshowPlaying) {
    slideshowPlayPauseBtn.textContent = 'Pause';
    startSlideshowAutoAdvance();
  } else {
    slideshowPlayPauseBtn.textContent = 'Play';
    if (slideshowInterval) {
      clearInterval(slideshowInterval);
      slideshowInterval = null;
    }
  }
}

// Start auto-advance timer
function startSlideshowAutoAdvance() {
  // Clear existing interval if any
  if (slideshowInterval) {
    clearInterval(slideshowInterval);
  }

  // Get transition speed from current section (default to 3 seconds)
  const currentSection = slideshowSections[currentSectionIndex];
  const transitionSpeed = currentSection?.transitionSpeed || 3;

  // Auto-advance based on section's transition speed (only within current section)
  slideshowInterval = setInterval(() => {
    if (slideshowPlaying && slideshowActive) {
      showNextImage();
    }
  }, transitionSpeed * 1000);
}

// Update music volume
async function updateMusicVolume() {
  const volume = parseFloat(slideshowVolumeSlider.value);
  slideshowVolumeValue.textContent = `${Math.round(volume * 100)}%`;

  if (csound) {
    await csound.setControlChannel("musicvol", volume);
  }
}

// Toggle music play/pause
async function toggleMusicPlayPause() {
  if (currentSectionAudio.length === 0) return;

  if (musicPlaying) {
    // Pause the music
    await pauseAudio();
    musicPlaying = false;
    slideshowMusicPlayPauseBtn.textContent = 'Play Music';
  } else {
    // Resume the music
    await resumeAudio();
    musicPlaying = true;
    slideshowMusicPlayPauseBtn.textContent = 'Pause Music';
  }
}

// Play previous song
async function playPreviousSong() {
  if (currentSectionAudio.length === 0) return;

  let newIndex = currentAudioIndex - 1;
  if (newIndex < 0) {
    newIndex = currentSectionAudio.length - 1; // Loop to end
  }

  await playSongByIndex(newIndex);
}

// Play next song
async function playNextSong() {
  if (currentSectionAudio.length === 0) return;

  let newIndex = currentAudioIndex + 1;
  if (newIndex >= currentSectionAudio.length) {
    newIndex = 0; // Loop to beginning
  }

  await playSongByIndex(newIndex);
}

// Toggle controls visibility
function toggleControls() {
  controlsVisible = !controlsVisible;

  if (controlsVisible) {
    slideshowContent.classList.remove('controls-hidden');
    slideshowControlsWrapper.classList.remove('hidden');
    slideshowToggleControlsBtn.textContent = 'Hide Controls';
  } else {
    slideshowContent.classList.add('controls-hidden');
    slideshowControlsWrapper.classList.add('hidden');
    slideshowToggleControlsBtn.textContent = 'Show Controls';
  }
}

// Handle keyboard navigation
function handleSlideshowKeyboard(e) {
  if (!slideshowActive) return;

  switch(e.key) {
    case 'ArrowLeft':
      showPreviousImage();
      break;
    case 'ArrowRight':
      showNextImage();
      break;
    case 'ArrowUp':
      showPreviousSection();
      break;
    case 'ArrowDown':
      showNextSection();
      break;
    case ' ':
    case 'Spacebar':
      e.preventDefault();
      toggleSlideshowPlayPause();
      break;
    case 'Escape':
      closeSlideshow();
      break;
    case 'm':
    case 'M':
      toggleMusicPlayPause();
      break;
    case 'h':
    case 'H':
      toggleControls();
      break;
  }
}

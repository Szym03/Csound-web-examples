//============= Csound setup =======================
const url = "https://cdn.jsdelivr.net/npm/@csound/browser@7.0.0-beta20/dist/csound.js"
let csound = null;

const audioOrchestra = `
    sr=44100
    ksmps=128
    0dbfs=1
    nchnls=2

    instr 1
      Sfile strget p4
      ilen filelen Sfile
      a1, a2 mp3in Sfile
      out a1, a2
      if timeinsts() >= ilen then
        Smsg sprintf "i 1 %f %f \\"%s\\"", ilen, ilen, Sfile
        scoreline Smsg, 1
      endif
    endin
     `;

async function copyFileToLocal(csound, src, dest) {
    // fetch the file
    const srcfile = await fetch(src, { cache: "no-store" });
    // get the file data as an array
    const dat = await srcfile.arrayBuffer();
    // write the data as a new file in the filesystem
    await csound.fs.writeFile(dest, new Uint8Array(dat));
}

async function loadUserAudioFile(csound, file) {
    // Read the user's file as an ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();
    // Write it to Csound's filesystem
    const filename = file.name;
    await csound.fs.writeFile(filename, new Uint8Array(arrayBuffer));
    return filename;
}

const startCsound = async () => {
  const { Csound } = await import(url);
  const csoundObj = await Csound({
    useWorker: false,
    useSPN: false,
    outputChannelCount: 2,
    audioContext: new AudioContext({ sampleRate: 44100 })
  });

  await csoundObj.compileOrc(audioOrchestra, 0);
  await csoundObj.setOption("-odac");
  await csoundObj.start();

  await csoundObj.getNode();
  const ctx = await csoundObj.getAudioContext();

  csound = csoundObj;
  console.log("Csound initialized and ready, sample rate:", ctx.sampleRate);
  return csoundObj;
};

async function playAudioFile(filename) {
  if (!csound) {
    await startCsound();
  }

  // Play the audio file using instrument 1
  await csound.inputMessage(`i 1 0 -1 "${filename}"`);
  console.log(`Playing: ${filename}`);
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
const audioFileInput = document.getElementById('audioFileInput');

// Initialize: Add event listener for "Add Section" button
addSectionBtn.addEventListener('click', addSection);

// Initialize: Add event listener for audio file input
audioFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  console.log("Loading audio file:", file.name);

  // Initialize Csound if not already started
  if (!csound) {
    console.log("Starting Csound...");
    await startCsound();
  }

  // Load the user's audio file into Csound's filesystem
  const filename = await loadUserAudioFile(csound, file);

  // Play the audio file
  await playAudioFile(filename);

  // Reset input so same file can be selected again
  e.target.value = '';
});

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
    audio: [] // Empty for now
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

  // Remove section button
  const removeSectionBtn = document.createElement('button');
  removeSectionBtn.className = 'remove-section-btn';
  removeSectionBtn.textContent = 'Remove Section';
  removeSectionBtn.addEventListener('click', () => removeSection(sectionData.id));

  controls.appendChild(colorPickerLabel);
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

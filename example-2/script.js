// Store loaded images
let loadedImages = [];

// DOM elements
const imageInput = document.getElementById('imageInput');
const imageGallery = document.getElementById('imageGallery');
const clearBtn = document.getElementById('clearBtn');

// Handle file selection
imageInput.addEventListener('change', (event) => {
  const files = event.target.files;

  if (files.length > 0) {
    // Remove placeholder if it exists
    const placeholder = imageGallery.querySelector('.placeholder');
    if (placeholder) {
      placeholder.remove();
    }

    // Load each selected image
    Array.from(files).forEach(file => {
      if (file.type.startsWith('image/')) {
        loadImage(file);
      }
    });

    // Reset input so the same file can be selected again if needed
    event.target.value = '';
  }
});

// Load and display an image
function loadImage(file) {
  const reader = new FileReader();

  reader.onload = (e) => {
    const imageData = {
      src: e.target.result,
      name: file.name
    };

    loadedImages.push(imageData);
    displayImage(imageData, loadedImages.length - 1);
  };

  reader.readAsDataURL(file);
}

// Display an image in the gallery
function displayImage(imageData, index) {
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
  removeBtn.addEventListener('click', () => removeImage(index));

  container.appendChild(img);
  container.appendChild(removeBtn);
  imageGallery.appendChild(container);
}

// Remove a specific image
function removeImage(index) {
  // Remove from array
  loadedImages.splice(index, 1);

  // Refresh the gallery
  refreshGallery();
}

// Clear all images
clearBtn.addEventListener('click', () => {
  loadedImages = [];
  refreshGallery();
});

// Refresh the gallery display
function refreshGallery() {
  imageGallery.innerHTML = '';

  if (loadedImages.length === 0) {
    const placeholder = document.createElement('p');
    placeholder.className = 'placeholder';
    placeholder.textContent = 'No images loaded. Click "Choose Pictures" to get started.';
    imageGallery.appendChild(placeholder);
  } else {
    loadedImages.forEach((imageData, index) => {
      displayImage(imageData, index);
    });
  }
}

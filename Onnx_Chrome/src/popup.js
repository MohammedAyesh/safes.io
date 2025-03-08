// popup.js ------------------------------------------------
import { processImage } from './image_processor.js';

// 1) Grab DOM elements
const uploadButton = document.getElementById('uploadButton');
const imageUpload = document.getElementById('imageUpload');
const statusElement = document.getElementById('status');
const progressBar = document.getElementById('progressBar');
const previewCanvas = document.getElementById('previewCanvas');

// 2) Hook up event listeners
uploadButton.addEventListener('click', () => imageUpload.click());
imageUpload.addEventListener('change', handleImageUpload);

// 3) Main function: handle user choosing an image
async function handleImageUpload(event) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    updateStatus('Loading image...', 20);

    // Load the file into an <img>, then draw to canvas as a preview
    const img = await loadImage(file);
    showPreview(img);

    updateStatus('Preprocessing image...', 40);

    // Actually call image_processor's processImage
    const {
      float32Data,
      dims,
      resizeFactor,
      padLeft,
      padTop
    } = await processImage(img);

    // Now we have a typed array. We must convert it to normal array
    // for extension messaging
    const typedArrayAsNormalArray = Array.from(float32Data);

    updateStatus('Sending to background for inference...', 60);

    // Send it
    const response = await chrome.runtime.sendMessage({
      type: 'PROCESS_IMAGE',
      tensorData: float32Data.buffer,  // Keep ArrayBuffer reference
      dimensions: dims,
      resizeFactor,
      padLeft,
      padTop
    });

    updateStatus('Got results, formatting...', 80);
    console.log('Inference response:', response);

    // Example: if response has bounding boxes, we can draw them
    // For now, just log. Then done:
    updateStatus('Detection complete', 100);

  } catch (err) {
    console.error('Error in handleImageUpload:', err);
    updateStatus(`Error: ${err}`, 0, true);
  }
}

// 4) Helper: update the UI
function updateStatus(text, progress = 0, isError = false) {
  statusElement.textContent = text;
  progressBar.style.width = `${progress}%`;
  statusElement.style.color = isError ? '#c00' : '#333';
}

// 5) Helper: load file into an HTMLImageElement
async function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = URL.createObjectURL(file);
  });
}

// 6) Helper: show image on canvas
function showPreview(img) {
  const ctx = previewCanvas.getContext('2d');
  previewCanvas.width = img.width;
  previewCanvas.height = img.height;
  ctx.drawImage(img, 0, 0, img.width, img.height);
}

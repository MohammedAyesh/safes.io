// background.js (Service Worker) -----------------------------
import * as ort from 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.16.3/dist/ort.min.js';
// ------------------------------------------------------------------
// 1) Setup single-thread WASM environment (optional but recommended)
// ------------------------------------------------------------------
ort.env.wasm.numThreads = 1;
ort.env.wasm.proxy = false;
console.log('[DEBUG] ONNX Runtime object:', ort);
console.log('[DEBUG] ort.env value:', ort?.env);
// If needed, specify .wasm file paths
ort.env.wasm.wasmPaths = {
  'ort-wasm.wasm': chrome.runtime.getURL('wasm/ort-wasm.wasm'),
  'ort-wasm-simd.wasm': chrome.runtime.getURL('wasm/ort-wasm-simd.wasm'),
};

// ------------------------------------------------------------------
// 2) Global references
// ------------------------------------------------------------------
let ortSession = null;

// ------------------------------------------------------------------
// 3) Extension lifecycle: install, startup
// ------------------------------------------------------------------
chrome.runtime.onInstalled.addListener(initializeModel);
chrome.runtime.onStartup.addListener(() => {
  initializeModel().catch(err => {
    console.error('Model init failed, reloading...', err);
    setTimeout(() => chrome.runtime.reload(), 5000);
  });
});

// ------------------------------------------------------------------
// 4) Initialize the ONNX model
// ------------------------------------------------------------------
async function initializeModel() {
  try {
    const modelPath = chrome.runtime.getURL('public/best.onnx');
    console.log('Loading model from:', modelPath);

    const sessionOptions = {
      executionProviders: ['wasm'],
      graphOptimizationLevel: 'all',
      enableCpuMemArena: false
    };

    ortSession = await ort.InferenceSession.create(modelPath, sessionOptions);
    console.log('Model initialized!');
  } catch (err) {
    console.error('Error initializing ONNX model:', err);
    throw err; // triggers reload logic
  }
}

// ------------------------------------------------------------------
// 5) Listen for messages (e.g., from popup.js)
// ------------------------------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.type === 'PROCESS_IMAGE') {
    // Convert ArrayBuffer to Float32Array
    const typedData = new Float32Array(request.tensorData);
    
    handleProcessImage({
      ...request,
      tensorData: typedData
    }).then(sendResponse)
      .catch(error => sendResponse({ error: error.message }));

    return true; // Keep message channel open
  }
});

// ------------------------------------------------------------------
// 6) Handling the inference request
// ------------------------------------------------------------------
async function handleProcessImage(request) {
  if (!ortSession) {
    throw new Error('Model not initialized. Try again later.');
  }

  // Recreate the typed array from the normal array we got from the popup
  const typedData = new Float32Array(request.tensorData);
  const inputTensor = new ort.Tensor('float32', typedData, request.dimensions);

  // Perform inference
  const outputs = await ortSession.run({ images: inputTensor });
  inputTensor.dispose();

  // (Optional) Some post-processing, e.g. NMS or threshold. For now, just log:
  console.log('Raw outputs:', outputs);

  // Example: we assume the model output is named "output" or the first outputName
  const firstOutputName = ortSession.outputNames[0];
  const resultData = outputs[firstOutputName].data;
  const resultDims = outputs[firstOutputName].dims;

  // Return something to the popup
  return {
    rawDataLength: resultData.length,
    rawDims: resultDims,
    placeholder: 'You can do real postprocessing here.'
  };
}

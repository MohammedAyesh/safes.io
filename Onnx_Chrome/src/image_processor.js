// image_processor.js
// ------------------------------------------------
// This file replicates Python-like image preprocessing:
//  1) Resizes the image while preserving aspect ratio.
//  2) Pads with black to a 320x320 square.
//  3) Converts the final RGBA data into NCHW float32 data in [0..1] range.
//  4) Returns the float32Data plus some metadata like dims, resizeFactor, etc.

/**
 * Process an HTMLImageElement (or ImageBitmap) to 320x320 with black padding.
 * Return a Float32Array in NCHW layout, plus a metadata object.
 *
 * @param {HTMLImageElement|ImageBitmap} imageOrBitmap - The image to process.
 * @returns {Promise<Object>} with shape:
 *   {
 *     float32Data: Float32Array,   // The pixel data in NCHW float32
 *     dims: [1, 3, 320, 320],      // Standard ONNX dimension
 *     resizeFactor: number,        // For coordinate transformations if needed
 *     padLeft: number,             // Padding left
 *     padTop: number               // Padding top
 *   }
 */
export async function processImage(imageOrBitmap) {
    const targetSize = 320;
  
    // If the input is an Image, we can convert to ImageBitmap for consistency
    let imageBitmap;
    if (imageOrBitmap instanceof ImageBitmap) {
      imageBitmap = imageOrBitmap;
    } else {
      // We assume it's an HTMLImageElement, so createImageBitmap
      imageBitmap = await createImageBitmap(imageOrBitmap);
    }
  
    const [imgWidth, imgHeight] = [imageBitmap.width, imageBitmap.height];
    const aspect = imgWidth / imgHeight;
  
    // ---------------------------------------
    // 1) First resize while maintaining aspect ratio
    // ---------------------------------------
    let newWidth, newHeight;
    if (imgWidth >= imgHeight) {
      // landscape or square
      newWidth = targetSize;
      newHeight = Math.round(targetSize / aspect);
    } else {
      // portrait
      newHeight = targetSize;
      newWidth = Math.round(targetSize * aspect);
    }
  
    // Create a temporary canvas for resizing
    const resizeCanvas = document.createElement('canvas');
    resizeCanvas.width = newWidth;
    resizeCanvas.height = newHeight;
  
    const resizeCtx = resizeCanvas.getContext('2d');
    resizeCtx.drawImage(imageBitmap, 0, 0, newWidth, newHeight);
  
    // ---------------------------------------
    // 2) Create a 320x320 padded canvas
    // ---------------------------------------
    const padX = targetSize - newWidth;
    const padY = targetSize - newHeight;
    const padLeft = Math.floor(padX / 2);
    const padRight = Math.ceil(padX / 2);
    const padTop = Math.floor(padY / 2);
    const padBottom = Math.ceil(padY / 2);
  
    const paddedCanvas = document.createElement('canvas');
    paddedCanvas.width = targetSize;
    paddedCanvas.height = targetSize;
  
    const paddedCtx = paddedCanvas.getContext('2d');
    // Fill with black
    paddedCtx.fillStyle = 'black';
    paddedCtx.fillRect(0, 0, targetSize, targetSize);
  
    // Draw the resized image in the correct position
    paddedCtx.drawImage(resizeCanvas, padLeft, padTop, newWidth, newHeight);
  
    // ---------------------------------------
    // 3) (Optional) Another final step: if you want to ensure it's strictly 320x320
    //    with interpolation, you can re-draw. But typically we are already at 320x320 now.
    //    We'll skip that if we trust newWidth+padLeft = 320 exactly.
    // ---------------------------------------
  
    // ---------------------------------------
    // 4) Extract RGBA and convert to NCHW float32
    // ---------------------------------------
    const imageData = paddedCtx.getImageData(0, 0, targetSize, targetSize);
    const float32Data = new Float32Array(3 * targetSize * targetSize);
  
    // Fill in NCHW:
    //   - Channel 0 (R)  : positions [0 ...   targetSize*targetSize-1]
    //   - Channel 1 (G)  : positions [targetSize*targetSize ... 2*(...)-1]
    //   - Channel 2 (B)  : ...
    // We'll normalize each channel from [0..255] to [0..1].
    for (let i = 0; i < imageData.data.length; i += 4) {
      const pixelIndex = i / 4; // pixel count
      const rVal = imageData.data[i + 0];
      const gVal = imageData.data[i + 1];
      const bVal = imageData.data[i + 2];
      // const alpha = imageData.data[i + 3]; // alpha not used
  
      float32Data[pixelIndex] = rVal / 255; // R
      float32Data[pixelIndex + targetSize * targetSize] = gVal / 255; // G
      float32Data[pixelIndex + 2 * targetSize * targetSize] = bVal / 255; // B
    }
  
    // ---------------------------------------
    // 5) Compute resizeFactor for coordinate transforms
    //    e.g. if you want to transform model coordinates back to original
    // ---------------------------------------
    // For example, you might define it as:
    //  sqrt((imgWidth^2 + imgHeight^2) / (newWidth^2 + newHeight^2))
    // or simpler:
    const resizeFactor = 1; // Some users do advanced math here. Example below:
    // const resizeFactor = Math.sqrt(
    //   (imgWidth ** 2 + imgHeight ** 2) /
    //   (newWidth ** 2 + newHeight ** 2)
    // );
  
    // Return the data and some metadata
    return {
      float32Data,
      dims: [1, 3, targetSize, targetSize],
      resizeFactor,
      padLeft,
      padTop
    };
  }
  
class OZParser {
  /**
   * Parse OZJ file (JPEG wrapper)
   * Returns a blob URL for use in <img> src
   */
  static parseOZJ(buffer) {
    const data = new Uint8Array(buffer);

    // Search for JPEG marker (0xFF 0xD8 0xFF) starting at offset 16
    let jpegStart = -1;
    for (let i = 16; i < data.length - 2; i++) {
      if (data[i] === 0xFF && data[i + 1] === 0xD8 && data[i + 2] === 0xFF) {
        jpegStart = i;
        break;
      }
    }

    if (jpegStart === -1) {
      // Some .OZJ files are actually TGA with wrong extension — try TGA fallback
      if (data.length > 18 && (data[2] === 2 || data[2] === 10)) {
        return { tgaFallback: true };
      }
      throw new Error('JPEG marker not found in OZJ file');
    }

    const jpegData = data.slice(jpegStart);
    const blob = new Blob([jpegData], { type: 'image/jpeg' });
    return { url: URL.createObjectURL(blob), format: 'OZJ (JPEG)', cleanup: true };
  }

  /**
   * Parse MMK file (GIF with replaced header)
   * First 6 bytes "MMKTMT" replaced back to "GIF89a"
   */
  static parseMMK(buffer) {
    const data = new Uint8Array(buffer);

    if (data.length < 7) {
      throw new Error('MMK file too small');
    }

    const gifData = new Uint8Array(data.length);
    gifData.set(data);
    // Replace MMKTMT with GIF89a
    gifData[0] = 0x47; // G
    gifData[1] = 0x49; // I
    gifData[2] = 0x46; // F
    gifData[3] = 0x38; // 8
    gifData[4] = 0x39; // 9
    gifData[5] = 0x61; // a

    const blob = new Blob([gifData], { type: 'image/gif' });
    return { url: URL.createObjectURL(blob), format: 'MMK (GIF)', cleanup: true };
  }

  /**
   * Parse OZB file (BMP wrapper)
   * Skip first 4 bytes, rest is standard BMP
   */
  static parseOZB(buffer) {
    const data = new Uint8Array(buffer);

    if (data.length < 5) {
      throw new Error('OZB file too small');
    }

    const bmpData = data.slice(4);
    const blob = new Blob([bmpData], { type: 'image/bmp' });
    return { url: URL.createObjectURL(blob), format: 'OZB (BMP)', cleanup: true };
  }

  /**
   * Parse OZT file (Raw BGRA texture)
   * Header at offset 16: width(2), height(2), depth(1), reserved(1), then BGRA pixels
   * Returns a canvas element
   */
  static parseOZT(buffer) {
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);

    if (data.length < 22) {
      throw new Error('OZT file too small');
    }

    const width = view.getInt16(16, true);
    const height = view.getInt16(18, true);
    const depth = data[20];

    if (width <= 0 || width > 2048 || height <= 0 || height > 2048) {
      throw new Error(`Invalid OZT dimensions: ${width}x${height}`);
    }

    if (depth !== 32 && depth !== 24) {
      throw new Error(`Unsupported OZT depth: ${depth} (expected 24 or 32)`);
    }

    const bytesPerPixel = depth / 8;
    const pixelDataOffset = 22;
    const expectedSize = pixelDataOffset + (width * height * bytesPerPixel);

    if (data.length < expectedSize) {
      throw new Error(`OZT file truncated: expected ${expectedSize} bytes, got ${data.length}`);
    }

    // Create canvas and convert BGR/BGRA (bottom-up) to RGBA
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(width, height);

    for (let y = 0; y < height; y++) {
      const srcRow = (height - 1 - y) * width * bytesPerPixel + pixelDataOffset;
      const dstRow = y * width * 4;

      for (let x = 0; x < width; x++) {
        const srcIdx = srcRow + x * bytesPerPixel;
        const dstIdx = dstRow + x * 4;

        imageData.data[dstIdx]     = data[srcIdx + 2]; // R (from B)
        imageData.data[dstIdx + 1] = data[srcIdx + 1]; // G
        imageData.data[dstIdx + 2] = data[srcIdx];     // B (from R)
        imageData.data[dstIdx + 3] = bytesPerPixel === 4 ? data[srcIdx + 3] : 255; // A
      }
    }

    ctx.putImageData(imageData, 0, 0);

    return {
      canvas: canvas,
      format: 'OZT (BGRA)',
      width: width,
      height: height,
      depth: depth
    };
  }

  /**
   * Auto-detect format by extension and parse
   * Returns { element, format, width?, height?, cleanup? }
   */
  static parse(buffer, filename) {
    const ext = filename.split('.').pop().toLowerCase();

    if (ext === 'ozj' || ext === 'ozj2') {
      const result = this.parseOZJ(buffer);

      // TGA fallback: some .OZJ files are actually TGA with wrong extension
      if (result.tgaFallback && typeof TGAParser !== 'undefined') {
        const parsed = TGAParser.parse(buffer);
        const canvas = TGAParser.toCanvas(parsed);
        return Promise.resolve({
          element: canvas,
          format: 'OZJ (TGA fallback)',
          width: parsed.header.width,
          height: parsed.header.height
        });
      }

      const img = new Image();
      img.src = result.url;
      return new Promise((resolve, reject) => {
        img.onload = () => resolve({
          element: img,
          format: result.format,
          width: img.naturalWidth,
          height: img.naturalHeight,
          blobUrl: result.url
        });
        img.onerror = () => {
          URL.revokeObjectURL(result.url);
          reject(new Error('Failed to decode JPEG from OZJ'));
        };
      });
    }

    if (ext === 'ozb') {
      const result = this.parseOZB(buffer);
      const img = new Image();
      img.src = result.url;
      return new Promise((resolve, reject) => {
        img.onload = () => resolve({
          element: img,
          format: result.format,
          width: img.naturalWidth,
          height: img.naturalHeight,
          blobUrl: result.url
        });
        img.onerror = () => {
          URL.revokeObjectURL(result.url);
          reject(new Error('Failed to decode BMP from OZB'));
        };
      });
    }

    if (ext === 'mmk') {
      const result = this.parseMMK(buffer);
      const img = new Image();
      img.src = result.url;
      return new Promise((resolve, reject) => {
        img.onload = () => resolve({
          element: img,
          format: result.format,
          width: img.naturalWidth,
          height: img.naturalHeight,
          blobUrl: result.url
        });
        img.onerror = () => {
          URL.revokeObjectURL(result.url);
          reject(new Error('Failed to decode GIF from MMK'));
        };
      });
    }

    if (ext === 'ozt') {
      const result = this.parseOZT(buffer);
      return Promise.resolve({
        element: result.canvas,
        format: result.format,
        width: result.width,
        height: result.height
      });
    }

    return Promise.reject(new Error(`Unknown OZ format: ${ext}`));
  }
}

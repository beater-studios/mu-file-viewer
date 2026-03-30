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

    if (data.length < 6) {
      throw new Error('OZB file too small');
    }

    // BMP can be at offset 4 (standard OZB) or offset 0 (raw BMP with .ozb extension)
    let bmpOffset = -1;
    if (data[4] === 0x42 && data[5] === 0x4D) bmpOffset = 4;
    else if (data[0] === 0x42 && data[1] === 0x4D) bmpOffset = 0;

    if (bmpOffset === -1) {
      throw new Error('Not a valid OZB file (no BMP data found)');
    }

    const bmpData = data.slice(bmpOffset);
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
   * Parse OZP file (PNG with 4-byte prefix)
   * First 4 bytes are duplicate PNG magic; actual PNG starts at offset 4
   */
  static parseOZP(buffer) {
    const data = new Uint8Array(buffer);

    if (data.length < 8) {
      throw new Error('OZP file too small');
    }

    // OZP = PNG with 4-byte prefix, actual PNG starts at offset 4
    const pngData = data.slice(4);
    const blob = new Blob([pngData], { type: 'image/png' });
    return { url: URL.createObjectURL(blob), format: 'OZP (PNG)', cleanup: true };
  }

  /**
   * Auto-detect format by extension and parse
   * Returns { element, format, width?, height?, cleanup? }
   */
  static parse(buffer, filename) {
    const ext = filename.split('.').pop().toLowerCase();

    if (ext === 'ozp') {
      const result = this.parseOZP(buffer);
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
          reject(new Error('Failed to decode PNG from OZP'));
        };
      });
    }

    if (ext === 'ozd') {
      if (typeof OZGParser === 'undefined') {
        return Promise.reject(new Error('OZGParser not loaded'));
      }
      try {
        const result = OZGParser.parseOZD(buffer);
        const data = result.imageData;

        // Try to detect image format from magic bytes
        let format = 'Unknown';
        let mimeType = 'application/octet-stream';

        if (data.length >= 4 && data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4E && data[3] === 0x47) {
          format = 'PNG';
          mimeType = 'image/png';
        } else if (data.length >= 3 && data[0] === 0xFF && data[1] === 0xD8 && data[2] === 0xFF) {
          format = 'JPEG';
          mimeType = 'image/jpeg';
        } else if (data.length >= 2 && data[0] === 0x42 && data[1] === 0x4D) {
          format = 'BMP';
          mimeType = 'image/bmp';
        } else if (data.length >= 4 && data[0] === 0x44 && data[1] === 0x44 && data[2] === 0x53 && data[3] === 0x20) {
          format = 'DDS';
        }

        // Handle DDS format (detected magic bytes)
        if (format === 'DDS') {
          if (typeof DDSParser === 'undefined') {
            return Promise.reject(new Error('DDSParser not loaded'));
          }
          try {
            const arrayBuf = data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength);
            const parsed = DDSParser.parse(arrayBuf);
            const canvas = DDSParser.toCanvas(parsed);
            return Promise.resolve({
              element: canvas,
              format: `OZD (DDS ${parsed.format})`,
              width: parsed.width,
              height: parsed.height
            });
          } catch (ddsErr) {
            // DDS detected but format unsupported — offer .dds download
            const card = document.createElement('div');
            card.className = 'ozd-unknown-card';
            card.innerHTML = `
              <div class="ozd-header">OZD (DDS — ${ddsErr.message})</div>
              <div class="ozd-details">
                <p><strong>Algorithm 1 (payload):</strong> ${result.algorithm1Name}</p>
                <p><strong>Algorithm 2 (header):</strong> ${result.algorithm2Name}</p>
                <p><strong>Decrypted size:</strong> ${data.length} bytes</p>
              </div>
              <button class="ozd-download-btn">Download .dds</button>
            `;
            const btn = card.querySelector('.ozd-download-btn');
            btn.onclick = () => {
              const blob = new Blob([data], { type: 'image/vnd.ms-dds' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = filename.replace(/\.ozd$/i, '') + '.dds';
              a.click();
              URL.revokeObjectURL(url);
            };
            return Promise.resolve({
              element: card,
              format: 'OZD (DDS unsupported)'
            });
          }
        }

        if (format !== 'Unknown') {
          const blob = new Blob([data], { type: mimeType });
          const url = URL.createObjectURL(blob);
          const img = new Image();
          img.src = url;
          return new Promise((resolve, reject) => {
            img.onload = () => resolve({
              element: img,
              format: `OZD (${format})`,
              width: img.naturalWidth,
              height: img.naturalHeight,
              blobUrl: url
            });
            img.onerror = () => {
              URL.revokeObjectURL(url);
              reject(new Error(`Failed to decode ${format} from OZD`));
            };
          });
        } else {
          // Can't identify format, offer as download
          const card = document.createElement('div');
          card.className = 'ozd-unknown-card';
          card.innerHTML = `
            <div class="ozd-header">OZD (Unknown Image Format)</div>
            <div class="ozd-details">
              <p><strong>Algorithm 1 (payload):</strong> ${result.algorithm1Name}</p>
              <p><strong>Algorithm 2 (header):</strong> ${result.algorithm2Name}</p>
              <p><strong>Decrypted size:</strong> ${data.length} bytes</p>
            </div>
            <button class="ozd-download-btn">Download</button>
          `;
          const btn = card.querySelector('.ozd-download-btn');
          btn.onclick = () => {
            const blob = new Blob([data], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename + '.bin';
            a.click();
            URL.revokeObjectURL(url);
          };
          return Promise.resolve({
            element: card,
            format: 'OZD (Unknown)'
          });
        }
      } catch (e) {
        return Promise.reject(new Error(`Failed to decrypt OZD: ${e.message}`));
      }
    }

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

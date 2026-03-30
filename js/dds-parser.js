/**
 * DDS (DirectDraw Surface) Parser
 * Supports uncompressed (BGRA/BGR) and compressed (DXT1/DXT3/DXT5) formats
 * Pattern mirrors TGAParser: static parse(buffer) → data object, static toCanvas(parsed) → canvas element
 */
class DDSParser {
  static MAGIC = 0x20534444; // 'DDS ' in LE

  /**
   * Parse DDS file and return width, height, format name, and RGBA pixel data
   * @param {ArrayBuffer} buffer - DDS file data
   * @returns {Object} { width, height, format, imageData (Uint8Array RGBA) }
   */
  static parse(buffer) {
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);

    if (data.length < 128) {
      throw new Error('DDS file too small (need at least 128 bytes for header)');
    }

    // Check magic bytes "DDS " at offset 0
    const magic = view.getUint32(0, true);
    if (magic !== this.MAGIC) {
      throw new Error(`Invalid DDS magic: 0x${magic.toString(16)}`);
    }

    // DDS_HEADER starts at offset 4
    const headerSize = view.getUint32(4, true);
    if (headerSize !== 124) {
      throw new Error(`Invalid DDS header size: ${headerSize} (expected 124)`);
    }

    const flags = view.getUint32(8, true);
    const height = view.getUint32(12, true);
    const width = view.getUint32(16, true);
    // const pitchOrLinearSize = view.getUint32(20, true);
    // const depth = view.getUint32(24, true);
    // const mipMapCount = view.getUint32(28, true);

    if (width === 0 || height === 0) {
      throw new Error(`Invalid DDS dimensions: ${width}x${height}`);
    }

    // Pixel Format at offset 76 (offset 4 + 72)
    const pfSize = view.getUint32(76, true);
    const pfFlags = view.getUint32(80, true);
    const fourCC = this._readFourCC(data, 84);
    const rgbBitCount = view.getUint32(88, true);
    const rBitMask = view.getUint32(92, true);
    const gBitMask = view.getUint32(96, true);
    const bBitMask = view.getUint32(100, true);
    const aBitMask = view.getUint32(104, true);

    // Determine pixel data offset (128 base + 20 if DX10 header)
    let pixelOffset = 128;
    if (fourCC === 'DX10') {
      pixelOffset = 148;
    }

    // Determine format and decode
    let format = 'Unknown';
    let imageData = null;

    if ((pfFlags & 0x04) !== 0) {
      // Compressed format (FOURCC)
      if (fourCC === 'DXT1') {
        format = 'DXT1';
        imageData = this._decodeDXT1(data, pixelOffset, width, height);
      } else if (fourCC === 'DXT3') {
        format = 'DXT3';
        imageData = this._decodeDXT3(data, pixelOffset, width, height);
      } else if (fourCC === 'DXT5') {
        format = 'DXT5';
        imageData = this._decodeDXT5(data, pixelOffset, width, height);
      } else {
        throw new Error(`Unsupported compressed format: ${fourCC}`);
      }
    } else if ((pfFlags & 0x40) !== 0 || (pfFlags & 0x41) !== 0) {
      // Uncompressed RGB or RGBA
      if (rgbBitCount === 32) {
        format = 'BGRA 32-bit';
        imageData = this._decodeUncompressed(data, pixelOffset, width, height, 32, { r: rBitMask, g: gBitMask, b: bBitMask, a: aBitMask });
      } else if (rgbBitCount === 24) {
        format = 'BGR 24-bit';
        imageData = this._decodeUncompressed(data, pixelOffset, width, height, 24, { r: rBitMask, g: gBitMask, b: bBitMask, a: 0 });
      } else {
        throw new Error(`Unsupported uncompressed bit depth: ${rgbBitCount}`);
      }
    } else {
      throw new Error(`Unsupported DDS pixel format: pfFlags=0x${pfFlags.toString(16)}`);
    }

    if (!imageData) {
      throw new Error('Failed to decode DDS pixel data');
    }

    return { width, height, format, imageData };
  }

  /**
   * Render parsed DDS data to a canvas
   * @param {Object} parsed - Result from parse()
   * @returns {HTMLCanvasElement}
   */
  static toCanvas(parsed) {
    const canvas = document.createElement('canvas');
    canvas.width = parsed.width;
    canvas.height = parsed.height;

    const ctx = canvas.getContext('2d');
    const imageData = ctx.createImageData(parsed.width, parsed.height);
    imageData.data.set(parsed.imageData);
    ctx.putImageData(imageData, 0, 0);

    return canvas;
  }

  /**
   * Decode uncompressed BGRA or BGR pixels
   */
  static _decodeUncompressed(data, offset, width, height, bitCount, masks) {
    const bytesPerPixel = bitCount / 8;
    const pixelCount = width * height;
    const imageData = new Uint8Array(pixelCount * 4); // RGBA

    for (let i = 0; i < pixelCount; i++) {
      const srcIdx = offset + i * bytesPerPixel;
      const dstIdx = i * 4;

      if (bitCount === 32) {
        // BGRA → RGBA (swap B and R)
        imageData[dstIdx] = data[srcIdx + 2];     // R
        imageData[dstIdx + 1] = data[srcIdx + 1]; // G
        imageData[dstIdx + 2] = data[srcIdx];     // B
        imageData[dstIdx + 3] = data[srcIdx + 3]; // A
      } else if (bitCount === 24) {
        // BGR → RGB + alpha
        imageData[dstIdx] = data[srcIdx + 2];     // R
        imageData[dstIdx + 1] = data[srcIdx + 1]; // G
        imageData[dstIdx + 2] = data[srcIdx];     // B
        imageData[dstIdx + 3] = 255;              // A (opaque)
      }
    }

    return imageData;
  }

  /**
   * Decode DXT1 compressed format (8 bytes per 4x4 block)
   * 2-bit color index, supports 4-color mode with optional transparency
   */
  static _decodeDXT1(data, offset, width, height) {
    const imageData = new Uint8Array(width * height * 4);
    const blockCountX = Math.ceil(width / 4);
    const blockCountY = Math.ceil(height / 4);

    for (let by = 0; by < blockCountY; by++) {
      for (let bx = 0; bx < blockCountX; bx++) {
        const blockIdx = (by * blockCountX + bx) * 8;
        const blockOffset = offset + blockIdx;

        // Read color0 and color1 (RGB565 LE)
        const color0 = data[blockOffset] | (data[blockOffset + 1] << 8);
        const color1 = data[blockOffset + 2] | (data[blockOffset + 3] << 8);

        // Decode RGB565 colors
        const c0 = this._decodeRGB565(color0);
        const c1 = this._decodeRGB565(color1);

        // Build 4-color palette
        const palette = [
          [c0[0], c0[1], c0[2], 255],
          [c1[0], c1[1], c1[2], 255],
          null, // Will be computed
          null
        ];

        if (color0 > color1) {
          // 4-color mode
          palette[2] = this._interpolateColor(c0, c1, 1, 2);
          palette[2].push(255);
          palette[3] = this._interpolateColor(c0, c1, 2, 1);
          palette[3].push(255);
        } else {
          // 3-color mode + transparent
          palette[2] = this._interpolateColor(c0, c1, 1, 1);
          palette[2].push(255);
          palette[3] = [0, 0, 0, 0]; // Transparent
        }

        // Read pixel indices (2 bits per pixel, 16 pixels = 4 bytes)
        const indices = [
          data[blockOffset + 4],
          data[blockOffset + 5],
          data[blockOffset + 6],
          data[blockOffset + 7]
        ];

        // Write 16 pixels
        for (let i = 0; i < 16; i++) {
          const py = i >>> 2;     // i / 4
          const px = i & 3;       // i % 4
          const globalY = by * 4 + py;
          const globalX = bx * 4 + px;

          if (globalX >= width || globalY >= height) continue; // Out of bounds

          const byteIdx = i >>> 2; // Which byte (0-3)
          const bitIdx = (i & 3) * 2; // Which 2 bits
          const colorIdx = (indices[byteIdx] >>> bitIdx) & 3;
          const color = palette[colorIdx];

          const pixelOffset = (globalY * width + globalX) * 4;
          imageData[pixelOffset] = color[0];
          imageData[pixelOffset + 1] = color[1];
          imageData[pixelOffset + 2] = color[2];
          imageData[pixelOffset + 3] = color[3];
        }
      }
    }

    return imageData;
  }

  /**
   * Decode DXT3 compressed format (16 bytes per 4x4 block)
   * Explicit 4-bit alpha per pixel + DXT1-style color block
   */
  static _decodeDXT3(data, offset, width, height) {
    const imageData = new Uint8Array(width * height * 4);
    const blockCountX = Math.ceil(width / 4);
    const blockCountY = Math.ceil(height / 4);

    for (let by = 0; by < blockCountY; by++) {
      for (let bx = 0; bx < blockCountX; bx++) {
        const blockIdx = (by * blockCountX + bx) * 16;
        const blockOffset = offset + blockIdx;

        // Read alpha block (8 bytes, 4-bit alpha per pixel)
        const alphaBlock = data.slice(blockOffset, blockOffset + 8);
        const alphas = [];
        for (let i = 0; i < 16; i++) {
          const byteIdx = i >>> 1;
          const nibble = (alphaBlock[byteIdx] >>> ((i & 1) * 4)) & 0xF;
          alphas[i] = (nibble * 255) / 15 | 0;
        }

        // Read color block (8 bytes, DXT1-style)
        const colorBlockOffset = blockOffset + 8;
        const color0 = data[colorBlockOffset] | (data[colorBlockOffset + 1] << 8);
        const color1 = data[colorBlockOffset + 2] | (data[colorBlockOffset + 3] << 8);

        const c0 = this._decodeRGB565(color0);
        const c1 = this._decodeRGB565(color1);

        // Build 4-color palette (DXT3 always uses 4-color mode)
        const palette = [
          [c0[0], c0[1], c0[2], 255],
          [c1[0], c1[1], c1[2], 255],
          this._interpolateColor(c0, c1, 1, 2).concat([255]),
          this._interpolateColor(c0, c1, 2, 1).concat([255])
        ];

        // Read color indices
        const indices = [
          data[colorBlockOffset + 4],
          data[colorBlockOffset + 5],
          data[colorBlockOffset + 6],
          data[colorBlockOffset + 7]
        ];

        // Write 16 pixels
        for (let i = 0; i < 16; i++) {
          const py = i >>> 2;
          const px = i & 3;
          const globalY = by * 4 + py;
          const globalX = bx * 4 + px;

          if (globalX >= width || globalY >= height) continue;

          const byteIdx = i >>> 2;
          const bitIdx = (i & 3) * 2;
          const colorIdx = (indices[byteIdx] >>> bitIdx) & 3;
          const color = palette[colorIdx].slice();
          color[3] = alphas[i]; // Override alpha with explicit value

          const pixelOffset = (globalY * width + globalX) * 4;
          imageData[pixelOffset] = color[0];
          imageData[pixelOffset + 1] = color[1];
          imageData[pixelOffset + 2] = color[2];
          imageData[pixelOffset + 3] = color[3];
        }
      }
    }

    return imageData;
  }

  /**
   * Decode DXT5 compressed format (16 bytes per 4x4 block)
   * 3-bit alpha index + 8-value alpha palette + DXT1-style color block
   */
  static _decodeDXT5(data, offset, width, height) {
    const imageData = new Uint8Array(width * height * 4);
    const blockCountX = Math.ceil(width / 4);
    const blockCountY = Math.ceil(height / 4);

    for (let by = 0; by < blockCountY; by++) {
      for (let bx = 0; bx < blockCountX; bx++) {
        const blockIdx = (by * blockCountX + bx) * 16;
        const blockOffset = offset + blockIdx;

        // Read alpha block (8 bytes)
        const alpha0 = data[blockOffset];
        const alpha1 = data[blockOffset + 1];

        // Build 8-value alpha palette
        const alphaPalette = [alpha0, alpha1];
        if (alpha0 > alpha1) {
          for (let i = 2; i < 8; i++) {
            alphaPalette[i] = ((8 - i) * alpha0 + (i - 1) * alpha1) / 7 | 0;
          }
        } else {
          for (let i = 2; i < 6; i++) {
            alphaPalette[i] = ((6 - i) * alpha0 + (i - 1) * alpha1) / 5 | 0;
          }
          alphaPalette[6] = 0;
          alphaPalette[7] = 255;
        }

        // Extract 3-bit alpha indices from 6 bytes
        const alphaIndices = this._extractDXT5AlphaIndices(data, blockOffset + 2);

        // Read color block (8 bytes)
        const colorBlockOffset = blockOffset + 8;
        const color0 = data[colorBlockOffset] | (data[colorBlockOffset + 1] << 8);
        const color1 = data[colorBlockOffset + 2] | (data[colorBlockOffset + 3] << 8);

        const c0 = this._decodeRGB565(color0);
        const c1 = this._decodeRGB565(color1);

        const palette = [
          [c0[0], c0[1], c0[2]],
          [c1[0], c1[1], c1[2]],
          this._interpolateColor(c0, c1, 1, 2),
          this._interpolateColor(c0, c1, 2, 1)
        ];

        // Read color indices
        const indices = [
          data[colorBlockOffset + 4],
          data[colorBlockOffset + 5],
          data[colorBlockOffset + 6],
          data[colorBlockOffset + 7]
        ];

        // Write 16 pixels
        for (let i = 0; i < 16; i++) {
          const py = i >>> 2;
          const px = i & 3;
          const globalY = by * 4 + py;
          const globalX = bx * 4 + px;

          if (globalX >= width || globalY >= height) continue;

          const byteIdx = i >>> 2;
          const bitIdx = (i & 3) * 2;
          const colorIdx = (indices[byteIdx] >>> bitIdx) & 3;
          const color = palette[colorIdx];
          const alpha = alphaPalette[alphaIndices[i]];

          const pixelOffset = (globalY * width + globalX) * 4;
          imageData[pixelOffset] = color[0];
          imageData[pixelOffset + 1] = color[1];
          imageData[pixelOffset + 2] = color[2];
          imageData[pixelOffset + 3] = alpha;
        }
      }
    }

    return imageData;
  }

  /**
   * Extract 16 3-bit alpha indices from 6 bytes
   */
  static _extractDXT5AlphaIndices(data, offset) {
    const indices = new Uint8Array(16);
    const bytes = [
      data[offset],
      data[offset + 1],
      data[offset + 2],
      data[offset + 3],
      data[offset + 4],
      data[offset + 5]
    ];

    let bitPos = 0;
    for (let i = 0; i < 16; i++) {
      const byteIdx = bitPos >>> 3;
      const bitIdx = bitPos & 7;
      indices[i] = (bytes[byteIdx] >>> bitIdx) & 7;
      bitPos += 3;
    }

    return indices;
  }

  /**
   * Decode RGB565 (LE) to [R, G, B]
   */
  static _decodeRGB565(color) {
    const r = ((color >>> 11) & 0x1F) * 255 / 31 | 0;
    const g = ((color >>> 5) & 0x3F) * 255 / 63 | 0;
    const b = (color & 0x1F) * 255 / 31 | 0;
    return [r, g, b];
  }

  /**
   * Interpolate between two RGB colors
   * Returns [R, G, B]
   */
  static _interpolateColor(c0, c1, w0, w1) {
    const total = w0 + w1;
    return [
      ((c0[0] * w0 + c1[0] * w1) / total) | 0,
      ((c0[1] * w0 + c1[1] * w1) / total) | 0,
      ((c0[2] * w0 + c1[2] * w1) / total) | 0
    ];
  }

  /**
   * Read 4-byte FourCC code as string
   */
  static _readFourCC(data, offset) {
    return String.fromCharCode(
      data[offset],
      data[offset + 1],
      data[offset + 2],
      data[offset + 3]
    );
  }
}

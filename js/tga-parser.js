class TGAParser {
  /**
   * Parse a TGA file from an ArrayBuffer
   * Supports: uncompressed (type 2), RLE compressed (type 10), 24-bit and 32-bit
   */
  static parse(buffer) {
    const data = new Uint8Array(buffer);
    const view = new DataView(buffer);

    const header = {
      idLength: data[0],
      colorMapType: data[1],
      imageType: data[2],
      colorMapOrigin: view.getUint16(3, true),
      colorMapLength: view.getUint16(5, true),
      colorMapDepth: data[7],
      xOrigin: view.getUint16(8, true),
      yOrigin: view.getUint16(10, true),
      width: view.getUint16(12, true),
      height: view.getUint16(14, true),
      bitsPerPixel: data[16],
      descriptor: data[17],
    };

    if (header.width === 0 || header.height === 0) {
      throw new Error('Invalid TGA: width or height is 0');
    }

    if (![2, 10].includes(header.imageType)) {
      throw new Error(`Unsupported TGA image type: ${header.imageType} (only type 2 and 10 supported)`);
    }

    if (![24, 32].includes(header.bitsPerPixel)) {
      throw new Error(`Unsupported bit depth: ${header.bitsPerPixel} (only 24 and 32 supported)`);
    }

    const bytesPerPixel = header.bitsPerPixel / 8;
    const pixelCount = header.width * header.height;
    let offset = 18 + header.idLength;

    // Skip color map if present
    if (header.colorMapType === 1) {
      offset += header.colorMapLength * (header.colorMapDepth / 8);
    }

    const imageData = new Uint8Array(pixelCount * 4); // RGBA

    if (header.imageType === 2) {
      // Uncompressed
      for (let i = 0; i < pixelCount; i++) {
        const srcIdx = offset + i * bytesPerPixel;
        const dstIdx = i * 4;
        imageData[dstIdx] = data[srcIdx + 2];     // R (TGA is BGR)
        imageData[dstIdx + 1] = data[srcIdx + 1]; // G
        imageData[dstIdx + 2] = data[srcIdx];     // B
        imageData[dstIdx + 3] = bytesPerPixel === 4 ? data[srcIdx + 3] : 255; // A
      }
    } else if (header.imageType === 10) {
      // RLE compressed
      let pixelIndex = 0;
      while (pixelIndex < pixelCount && offset < data.length) {
        const packet = data[offset++];
        const count = (packet & 0x7F) + 1;
        const isRLE = (packet & 0x80) !== 0;

        if (isRLE) {
          const b = data[offset];
          const g = data[offset + 1];
          const r = data[offset + 2];
          const a = bytesPerPixel === 4 ? data[offset + 3] : 255;
          offset += bytesPerPixel;

          for (let i = 0; i < count && pixelIndex < pixelCount; i++, pixelIndex++) {
            const dstIdx = pixelIndex * 4;
            imageData[dstIdx] = r;
            imageData[dstIdx + 1] = g;
            imageData[dstIdx + 2] = b;
            imageData[dstIdx + 3] = a;
          }
        } else {
          for (let i = 0; i < count && pixelIndex < pixelCount; i++, pixelIndex++) {
            const dstIdx = pixelIndex * 4;
            imageData[dstIdx] = data[offset + 2];     // R
            imageData[dstIdx + 1] = data[offset + 1]; // G
            imageData[dstIdx + 2] = data[offset];     // B
            imageData[dstIdx + 3] = bytesPerPixel === 4 ? data[offset + 3] : 255;
            offset += bytesPerPixel;
          }
        }
      }
    }

    // Handle image origin (top-left vs bottom-left)
    const isTopOrigin = (header.descriptor & 0x20) !== 0;
    if (!isTopOrigin) {
      // Flip vertically (TGA default is bottom-left origin)
      const rowSize = header.width * 4;
      const tempRow = new Uint8Array(rowSize);
      for (let y = 0; y < Math.floor(header.height / 2); y++) {
        const topOffset = y * rowSize;
        const bottomOffset = (header.height - 1 - y) * rowSize;
        tempRow.set(imageData.subarray(topOffset, topOffset + rowSize));
        imageData.copyWithin(topOffset, bottomOffset, bottomOffset + rowSize);
        imageData.set(tempRow, bottomOffset);
      }
    }

    return { header, imageData };
  }

  /**
   * Render parsed TGA to a canvas element and return it
   */
  static toCanvas(parsed, maxWidth = null) {
    const canvas = document.createElement('canvas');
    canvas.width = parsed.header.width;
    canvas.height = parsed.header.height;

    const ctx = canvas.getContext('2d');
    const imgData = ctx.createImageData(parsed.header.width, parsed.header.height);
    imgData.data.set(parsed.imageData);
    ctx.putImageData(imgData, 0, 0);

    if (maxWidth && parsed.header.width > maxWidth) {
      const scaled = document.createElement('canvas');
      const ratio = maxWidth / parsed.header.width;
      scaled.width = maxWidth;
      scaled.height = Math.round(parsed.header.height * ratio);
      const sctx = scaled.getContext('2d');
      sctx.imageSmoothingEnabled = false;
      sctx.drawImage(canvas, 0, 0, scaled.width, scaled.height);
      return scaled;
    }

    return canvas;
  }
}

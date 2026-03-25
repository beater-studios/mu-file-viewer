/**
 * Shared download utilities for image-based viewers.
 */
const DL_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M2.75 14A1.75 1.75 0 011 12.25v-2.5a.75.75 0 011.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25v-2.5a.75.75 0 011.5 0v2.5A1.75 1.75 0 0113.25 14H2.75z"/><path d="M7.25 7.689V2a.75.75 0 011.5 0v5.689l1.97-1.969a.749.749 0 111.06 1.06l-3.25 3.25a.749.749 0 01-1.06 0L4.22 6.78a.749.749 0 111.06-1.06l1.97 1.969z"/></svg>';

/**
 * Remove the original extension from a filename.
 * "texture.ozj" → "texture", "model.tga" → "model"
 */
function dlBaseName(filename) {
  const dot = filename.lastIndexOf('.');
  return dot > 0 ? filename.substring(0, dot) : filename;
}

/**
 * Trigger a file download from a canvas element.
 */
function dlFromCanvas(canvas, baseName) {
  canvas.toBlob(function(blob) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = baseName + '.png';
    a.click();
    URL.revokeObjectURL(url);
  }, 'image/png');
}

/**
 * Trigger a file download from a blob URL or regular URL.
 */
function dlFromUrl(url, fileName) {
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  a.click();
}

/**
 * Trigger download from an <img> element (blob or server URL).
 * Detects format from the blob type or URL extension.
 */
function dlFromImg(img, baseName) {
  // For blob URLs, fetch the blob to determine type
  if (img.src.startsWith('blob:')) {
    fetch(img.src).then(r => r.blob()).then(blob => {
      const ext = blob.type === 'image/jpeg' ? '.jpg'
               : blob.type === 'image/gif' ? '.gif'
               : blob.type === 'image/bmp' ? '.bmp'
               : '.png';
      dlFromUrl(img.src, baseName + ext);
    });
  } else {
    // Server URL — keep original extension
    const ext = img.src.split('.').pop().split('?')[0].toLowerCase();
    dlFromUrl(img.src, baseName + '.' + ext);
  }
}

/**
 * Create a small download button (for grid cards).
 */
function createDlBtn(onClick) {
  const btn = document.createElement('button');
  btn.className = 'dl-btn';
  btn.title = 'Download';
  btn.innerHTML = DL_ICON;
  btn.addEventListener('click', function(e) {
    e.stopPropagation();
    onClick();
  });
  return btn;
}

/**
 * Create a modal download button.
 */
function createModalDlBtn(onClick) {
  const btn = document.createElement('button');
  btn.className = 'modal-dl-btn';
  btn.innerHTML = DL_ICON + ' Download';
  btn.addEventListener('click', onClick);
  return btn;
}

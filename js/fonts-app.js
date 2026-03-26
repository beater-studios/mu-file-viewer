document.addEventListener('DOMContentLoaded', () => {
  initGroupToggle('font-list', '.font-item');
  initSelection('font-list', '.font-item');

  /**
   * Extract TTF font data from EOT (Embedded OpenType) container.
   * EOT header: offset 0 = EOTSize(u32), offset 4 = FontDataSize(u32).
   * The font data (TTF/OTF) occupies the last FontDataSize bytes of the file.
   */
  function extractEotFont(buffer) {
    const view = new DataView(buffer);
    const fontDataSize = view.getUint32(4, true);
    const fontOffset = buffer.byteLength - fontDataSize;
    return buffer.slice(fontOffset, fontOffset + fontDataSize);
  }

  document.querySelectorAll('.font-item').forEach(item => {
    const filePath = item.dataset.file;
    const fontId = item.dataset.fontId;
    const url = 'serve_file.php?file=' + encodeURIComponent(filePath);
    const preview = item.querySelector('.font-preview');
    const nameEl = item.querySelector('.font-name');
    const isEot = filePath.toLowerCase().endsWith('.eot');

    preview.style.opacity = '0.3';

    if (isEot) {
      // EOT: fetch binary, extract TTF, load from blob
      fetch(url)
        .then(r => r.arrayBuffer())
        .then(buffer => {
          const ttfBuffer = extractEotFont(buffer);
          const blob = new Blob([ttfBuffer], { type: 'font/ttf' });
          const blobUrl = URL.createObjectURL(blob);
          const font = new FontFace(fontId, `url("${blobUrl}")`);
          return font.load();
        })
        .then(loadedFont => {
          document.fonts.add(loadedFont);
          applyFont(preview, nameEl, fontId);
        })
        .catch(err => showError(preview, nameEl, filePath, err));
    } else {
      const font = new FontFace(fontId, `url("${url}")`);
      font.load()
        .then(loadedFont => {
          document.fonts.add(loadedFont);
          applyFont(preview, nameEl, fontId);
        })
        .catch(err => showError(preview, nameEl, filePath, err));
    }
  });

  function applyFont(preview, nameEl, fontId) {
    preview.style.fontFamily = `"${fontId}"`;
    preview.querySelectorAll('div').forEach(el => {
      el.style.fontFamily = `"${fontId}"`;
    });
    preview.style.opacity = '1';
    nameEl.insertAdjacentHTML('afterend', '<span class="font-loaded">Loaded</span>');
  }

  function showError(preview, nameEl, filePath, err) {
    preview.innerHTML = '<div class="font-error">Error loading font</div>';
    preview.style.opacity = '1';
    nameEl.insertAdjacentHTML('afterend', '<span class="font-failed">Error</span>');
    console.error(`Failed to load font ${filePath}:`, err);
  }
});

document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('file-grid');
  const modal = document.getElementById('modal');
  const modalCanvas = document.getElementById('modal-canvas');
  const modalInfo = document.getElementById('modal-info');
  const modalClose = document.getElementById('modal-close');
  const modalFilename = document.getElementById('modal-filename');

  if (!grid) return;

  const MAX_CONCURRENT = 4;
  let activeLoads = 0;
  const queue = [];

  function enqueueLoad(card) {
    queue.push(card);
    processQueue();
  }

  function processQueue() {
    while (activeLoads < MAX_CONCURRENT && queue.length > 0) {
      const card = queue.shift();
      activeLoads++;
      loadThumbnail(card).finally(() => {
        activeLoads--;
        processQueue();
      });
    }
  }

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        enqueueLoad(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '200px' });

  document.querySelectorAll('.oz-card').forEach(card => observer.observe(card));

  function downloadResult(result, baseName) {
    if (result.element.tagName === 'CANVAS') {
      dlFromCanvas(result.element, baseName);
    } else {
      dlFromImg(result.element, baseName);
    }
  }

  async function loadThumbnail(card) {
    const filePath = card.dataset.file;
    const placeholder = card.querySelector('.file-placeholder');

    try {
      const response = await fetch('serve_file.php?file=' + encodeURIComponent(filePath));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.arrayBuffer();
      const result = await OZParser.parse(buffer, filePath);

      const el = result.element;

      let thumbEl;
      if (el.tagName === 'DIV') {
        // Unknown/unsupported format — show a compact label in the grid, full card in modal
        thumbEl = document.createElement('div');
        thumbEl.className = 'file-thumb file-unknown-thumb';
        thumbEl.textContent = result.format || 'Unknown';
      } else {
        thumbEl = el;
        thumbEl.classList.add('file-thumb');
        thumbEl.style.maxWidth = '150px';
        thumbEl.style.maxHeight = '150px';
        if (thumbEl.tagName !== 'CANVAS') thumbEl.style.objectFit = 'contain';
      }

      placeholder.replaceWith(thumbEl);

      card._ozResult = result;
      card._ozBuffer = buffer;

      // Add download button to card
      const baseName = dlBaseName(card.dataset.name);
      card.appendChild(createDlBtn(() => downloadResult(result, baseName)));
    } catch (err) {
      placeholder.textContent = 'Error';
      placeholder.title = err.message;
      placeholder.classList.add('file-error');
      console.error(`Failed to load ${filePath}:`, err);
    }
  }

  // Click to open modal
  grid.addEventListener('click', async (e) => {
    if (e.target.closest('.dl-btn')) return;
    const card = e.target.closest('.oz-card');
    if (!card) return;

    const filePath = card.dataset.file;
    const size = parseInt(card.dataset.size);
    const baseName = dlBaseName(card.dataset.name);
    modalFilename.textContent = filePath;
    modalCanvas.innerHTML = '';

    try {
      let buffer = card._ozBuffer;
      if (!buffer) {
        const response = await fetch('serve_file.php?file=' + encodeURIComponent(filePath));
        buffer = await response.arrayBuffer();
      }

      const result = await OZParser.parse(buffer, filePath);
      let el;

      if (result.element.tagName === 'CANVAS') {
        const src = result.element;
        el = document.createElement('canvas');
        el.width = src.width;
        el.height = src.height;
        el.getContext('2d').drawImage(src, 0, 0);
        el.style.maxWidth = '100%';
        el.style.imageRendering = 'pixelated';
      } else {
        el = result.element.cloneNode(true);
        el.style.maxWidth = '100%';
        el.style.maxHeight = '70vh';
      }

      modalCanvas.appendChild(el);

      modalInfo.innerHTML = '';
      const spans = document.createElement('div');
      spans.innerHTML = `
        <span>${result.width} x ${result.height}</span>
        <span>${result.format}</span>
        <span>${formatSize(size)}</span>
      `;
      Array.from(spans.children).forEach(s => modalInfo.appendChild(s));

      modalInfo.appendChild(createModalDlBtn(() => downloadResult(result, baseName)));
    } catch (err) {
      modalCanvas.innerHTML = `<div style="color:#ff6b6b">Error: ${err.message}</div>`;
      modalInfo.innerHTML = `<span>${formatSize(size)}</span>`;
    }

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  function closeModal() {
    modal.classList.remove('active');
    document.body.style.overflow = '';
  }

  modalClose.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeModal();
  });

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  initGroupToggle('file-grid', '.oz-card');
  initSelection('file-grid', '.oz-card');
});

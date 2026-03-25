document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('file-grid');
  const modal = document.getElementById('modal');
  const modalCanvas = document.getElementById('modal-canvas');
  const modalInfo = document.getElementById('modal-info');
  const modalClose = document.getElementById('modal-close');
  const modalFilename = document.getElementById('modal-filename');

  if (!grid) return;

  // Queue system to limit concurrent loads
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

  async function loadThumbnail(card) {
    const filePath = card.dataset.file;
    const placeholder = card.querySelector('.file-placeholder');

    try {
      const response = await fetch('serve_file.php?file=' + encodeURIComponent(filePath));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.arrayBuffer();
      const result = await OZParser.parse(buffer, filePath);

      const el = result.element;
      el.classList.add('file-thumb');

      // Scale down for thumbnail
      if (el.tagName === 'CANVAS') {
        el.style.maxWidth = '150px';
        el.style.maxHeight = '150px';
      } else {
        el.style.maxWidth = '150px';
        el.style.maxHeight = '150px';
        el.style.objectFit = 'contain';
      }

      placeholder.replaceWith(el);

      // Store data for modal
      card._ozResult = result;
      card._ozBuffer = buffer;
    } catch (err) {
      placeholder.textContent = 'Error';
      placeholder.title = err.message;
      placeholder.classList.add('file-error');
      console.error(`Failed to load ${filePath}:`, err);
    }
  }

  // Click to open modal
  grid.addEventListener('click', async (e) => {
    const card = e.target.closest('.oz-card');
    if (!card) return;

    const filePath = card.dataset.file;
    const size = parseInt(card.dataset.size);
    modalFilename.textContent = filePath;
    modalCanvas.innerHTML = '';

    // If we already parsed it for thumbnail, re-parse at full size for modal
    try {
      let buffer = card._ozBuffer;
      if (!buffer) {
        const response = await fetch('serve_file.php?file=' + encodeURIComponent(filePath));
        buffer = await response.arrayBuffer();
      }

      const result = await OZParser.parse(buffer, filePath);
      const el = result.element.cloneNode(true);

      if (el.tagName === 'CANVAS') {
        el.style.maxWidth = '100%';
        el.style.imageRendering = 'pixelated';
      } else {
        el.style.maxWidth = '100%';
        el.style.maxHeight = '70vh';
      }

      modalCanvas.appendChild(el);

      modalInfo.innerHTML = `
        <span>${result.width} x ${result.height}</span>
        <span>${result.format}</span>
        <span>${formatSize(size)}</span>
      `;
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
});

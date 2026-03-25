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

  document.querySelectorAll('.file-card').forEach(card => {
    observer.observe(card);
  });

  async function loadThumbnail(card) {
    const filePath = card.dataset.file;
    const placeholder = card.querySelector('.file-placeholder');

    try {
      const response = await fetch('serve_file.php?file=' + encodeURIComponent(filePath));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const buffer = await response.arrayBuffer();
      const parsed = TGAParser.parse(buffer);
      const canvas = TGAParser.toCanvas(parsed, 150);

      canvas.classList.add('file-thumb');
      placeholder.replaceWith(canvas);

      // Store parsed data for modal
      card._tgaParsed = parsed;
      card._tgaFileSize = buffer.byteLength;
    } catch (err) {
      placeholder.textContent = 'Error';
      placeholder.title = err.message;
      placeholder.classList.add('file-error');
      console.error(`Failed to load ${filePath}:`, err);
    }
  }

  // Click to open modal
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.file-card');
    if (!card || !card._tgaParsed) return;

    const parsed = card._tgaParsed;
    const h = parsed.header;

    const maxW = Math.min(window.innerWidth - 80, 1200);
    const canvas = TGAParser.toCanvas(parsed, h.width > maxW ? maxW : null);

    modalCanvas.innerHTML = '';
    modalCanvas.appendChild(canvas);

    modalFilename.textContent = card.dataset.file;
    modalInfo.innerHTML = `
      <span>${h.width} x ${h.height}</span>
      <span>${h.bitsPerPixel}-bit</span>
      <span>${h.imageType === 2 ? 'Uncompressed' : 'RLE'}</span>
      <span>${formatSize(card._tgaFileSize)}</span>
    `;

    modal.classList.add('active');
    document.body.style.overflow = 'hidden';
  });

  // Close modal
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

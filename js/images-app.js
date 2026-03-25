document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('file-grid');
  const modal = document.getElementById('modal');
  const modalCanvas = document.getElementById('modal-canvas');
  const modalInfo = document.getElementById('modal-info');
  const modalClose = document.getElementById('modal-close');
  const modalFilename = document.getElementById('modal-filename');

  if (!grid) return;

  // Queue system to limit concurrent loads (PHP built-in server is single-threaded)
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
      loadThumbnail(card, () => {
        activeLoads--;
        processQueue();
      });
    }
  }

  // Lazy load thumbnails - only enqueue when visible
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        enqueueLoad(entry.target);
        observer.unobserve(entry.target);
      }
    });
  }, { rootMargin: '200px' });

  document.querySelectorAll('.img-card').forEach(card => observer.observe(card));

  function loadThumbnail(card, done) {
    const filePath = card.dataset.file;
    const placeholder = card.querySelector('.file-placeholder');
    if (!placeholder) { done(); return; }

    const img = new Image();
    img.src = 'serve_file.php?file=' + encodeURIComponent(filePath);
    img.classList.add('file-thumb');

    img.onload = () => { placeholder.replaceWith(img); done(); };
    img.onerror = () => {
      placeholder.textContent = 'Error';
      placeholder.classList.add('file-error');
      done();
    };
  }

  // Click to open modal
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.img-card');
    if (!card) return;

    const filePath = card.dataset.file;
    const size = parseInt(card.dataset.size);
    const ext = filePath.split('.').pop().toUpperCase();

    const img = new Image();
    img.src = 'serve_file.php?file=' + encodeURIComponent(filePath);
    img.style.maxWidth = '100%';
    img.style.maxHeight = '70vh';
    img.style.imageRendering = 'pixelated';

    modalCanvas.innerHTML = '';
    modalCanvas.appendChild(img);

    modalFilename.textContent = filePath;

    img.onload = () => {
      modalInfo.innerHTML = `
        <span>${img.naturalWidth} x ${img.naturalHeight}</span>
        <span>${ext}</span>
        <span>${formatSize(size)}</span>
      `;
    };

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

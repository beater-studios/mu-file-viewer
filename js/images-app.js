document.addEventListener('DOMContentLoaded', () => {
  const grid = document.getElementById('file-grid');
  const modal = document.getElementById('modal');
  const modalCanvas = document.getElementById('modal-canvas');
  const modalInfo = document.getElementById('modal-info');
  const modalClose = document.getElementById('modal-close');
  const modalFilename = document.getElementById('modal-filename');

  if (!grid) return;

  const loader = new PriorityLoader({ maxConcurrent: 4 });
  grid._priorityLoader = loader;

  loader.setLoadFn((card, done) => {
    loadThumbnail(card, done);
  });

  document.querySelectorAll('.img-card').forEach(card => loader.observe(card));

  function loadThumbnail(card, done) {
    const filePath = card.dataset.file;
    const placeholder = card.querySelector('.file-placeholder');
    if (!placeholder) { done(); return; }

    const img = new Image();
    const url = 'serve_file.php?file=' + encodeURIComponent(filePath);
    img.src = url;
    img.classList.add('file-thumb');

    img.onload = () => {
      placeholder.replaceWith(img);

      // Add download button to card
      const baseName = dlBaseName(card.dataset.name);
      const ext = filePath.split('.').pop().toLowerCase();
      card.appendChild(createDlBtn(() => dlFromUrl(url, baseName + '.' + ext)));
      done();
    };
    img.onerror = () => {
      placeholder.textContent = 'Error';
      placeholder.classList.add('file-error');
      done();
    };
  }

  // Click to open modal
  grid.addEventListener('click', (e) => {
    if (e.target.closest('.dl-btn')) return;
    const card = e.target.closest('.img-card');
    if (!card) return;

    const filePath = card.dataset.file;
    const size = parseInt(card.dataset.size);
    const ext = filePath.split('.').pop();
    const baseName = dlBaseName(card.dataset.name);
    const url = 'serve_file.php?file=' + encodeURIComponent(filePath);

    const img = new Image();
    img.src = url;
    img.style.maxWidth = '100%';
    img.style.maxHeight = '70vh';
    img.style.imageRendering = 'pixelated';

    modalCanvas.innerHTML = '';
    modalCanvas.appendChild(img);

    modalFilename.textContent = filePath;

    img.onload = () => {
      modalInfo.innerHTML = '';
      const spans = document.createElement('div');
      spans.innerHTML = `
        <span>${img.naturalWidth} x ${img.naturalHeight}</span>
        <span>${ext.toUpperCase()}</span>
        <span>${formatSize(size)}</span>
      `;
      Array.from(spans.children).forEach(s => modalInfo.appendChild(s));

      modalInfo.appendChild(createModalDlBtn(() => {
        dlFromUrl(url, baseName + '.' + ext.toLowerCase());
      }));
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

  initGroupToggle('file-grid', '.img-card');
  initSelection('file-grid', '.img-card');
});

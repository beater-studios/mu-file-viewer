document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('audio-list');
  if (!list) return;

  initGroupToggle('audio-list', '.audio-item');
  initSelection('audio-list', '.audio-item');

  // Add download buttons and load duration for each audio item
  list.querySelectorAll('.audio-item').forEach(item => {
    const filePath = item.dataset.file;
    const ext = filePath.split('.').pop().toLowerCase();
    const baseName = dlBaseName(filePath.split('/').pop());
    const url = 'serve_file.php?file=' + encodeURIComponent(filePath);

    // Duration label
    const durEl = document.createElement('div');
    durEl.className = 'audio-duration';
    durEl.textContent = '--:--';
    item.querySelector('.audio-size').insertAdjacentElement('beforebegin', durEl);

    // Load metadata to get duration
    const audio = item.querySelector('audio');
    audio.addEventListener('loadedmetadata', () => {
      durEl.textContent = formatDuration(audio.duration);
    });
    // Trigger metadata load
    audio.preload = 'metadata';
    if (!audio.src && audio.querySelector('source')) {
      audio.load();
    }

    const dlBtn = createDlBtn(() => dlFromUrl(url, baseName + '.' + ext));
    item.appendChild(dlBtn);
  });

  function formatDuration(seconds) {
    if (!seconds || !isFinite(seconds)) return '--:--';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  let currentlyPlaying = null;

  list.addEventListener('click', (e) => {
    if (e.target.closest('.dl-btn')) return;
    const btn = e.target.closest('.audio-play-btn');
    if (!btn) return;

    const item = btn.closest('.audio-item');
    const audio = item.querySelector('audio');

    // If clicking the same item that's playing, toggle pause
    if (currentlyPlaying === item) {
      if (audio.paused) {
        audio.play();
        item.classList.add('playing');
        btn.innerHTML = '&#9646;&#9646;';
      } else {
        audio.pause();
        item.classList.remove('playing');
        btn.innerHTML = '&#9654;';
      }
      return;
    }

    // Stop previous
    if (currentlyPlaying) {
      const prevAudio = currentlyPlaying.querySelector('audio');
      const prevBtn = currentlyPlaying.querySelector('.audio-play-btn');
      prevAudio.pause();
      prevAudio.currentTime = 0;
      currentlyPlaying.classList.remove('playing');
      prevBtn.innerHTML = '&#9654;';
    }

    // Play new
    audio.play();
    item.classList.add('playing');
    btn.innerHTML = '&#9646;&#9646;';
    currentlyPlaying = item;

    // Reset when finished
    audio.onended = () => {
      item.classList.remove('playing');
      btn.innerHTML = '&#9654;';
      currentlyPlaying = null;
    };
  });
});

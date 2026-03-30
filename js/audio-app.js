document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('audio-list');
  if (!list) return;

  const mimeMap = { ogg: 'audio/ogg', wav: 'audio/wav', mp3: 'audio/mpeg' };

  function getAudioUrl(item) {
    return 'serve_file.php?file=' + encodeURIComponent(item.dataset.file);
  }

  function getOrCreateAudio(item) {
    if (item._audio) return item._audio;
    const ext = item.dataset.ext || 'mp3';
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.src = getAudioUrl(item);
    audio.type = mimeMap[ext] || 'audio/mpeg';
    item._audio = audio;
    return audio;
  }

  // Add download buttons and duration placeholders
  list.querySelectorAll('.audio-item').forEach(item => {
    const filePath = item.dataset.file;
    const ext = (item.dataset.ext || filePath.split('.').pop()).toLowerCase();
    const baseName = dlBaseName(filePath.split('/').pop());

    // Duration label (loaded lazily)
    const durEl = document.createElement('div');
    durEl.className = 'audio-duration';
    durEl.textContent = '--:--';
    item.querySelector('.audio-size').insertAdjacentElement('beforebegin', durEl);
    item._durEl = durEl;

    const dlBtn = createDlBtn(() => dlFromUrl(getAudioUrl(item), baseName + '.' + ext));
    item.appendChild(dlBtn);
  });

  // Lazy load duration via IntersectionObserver (only create Audio when visible)
  const durationObserver = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        const item = entry.target;
        durationObserver.unobserve(item);
        loadDuration(item);
      }
    });
  }, { rootMargin: '400px' });

  // Stagger duration loading to avoid overwhelming the server
  const DURATION_MAX_CONCURRENT = 6;
  let durationActive = 0;
  const durationQueue = [];

  function loadDuration(item) {
    if (item._durationLoaded) return;
    durationQueue.push(item);
    processDurationQueue();
  }

  function processDurationQueue() {
    while (durationActive < DURATION_MAX_CONCURRENT && durationQueue.length > 0) {
      const item = durationQueue.shift();
      if (item._durationLoaded) continue;
      durationActive++;
      const audio = getOrCreateAudio(item);
      const onMeta = () => {
        item._durEl.textContent = formatDuration(audio.duration);
        item._durationLoaded = true;
        cleanup();
      };
      const onError = () => { cleanup(); };
      const cleanup = () => {
        audio.removeEventListener('loadedmetadata', onMeta);
        audio.removeEventListener('error', onError);
        // Free the audio element if not currently playing
        if (currentlyPlaying !== item) {
          audio.src = '';
          item._audio = null;
        }
        durationActive--;
        processDurationQueue();
      };
      audio.addEventListener('loadedmetadata', onMeta);
      audio.addEventListener('error', onError);
      audio.load();
    }
  }

  list.querySelectorAll('.audio-item').forEach(item => durationObserver.observe(item));

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
    const audio = getOrCreateAudio(item);

    // Ensure src is set (may have been cleared after duration load)
    if (!audio.src || audio.src === '') {
      audio.src = getAudioUrl(item);
    }

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
      const prevAudio = currentlyPlaying._audio;
      const prevBtn = currentlyPlaying.querySelector('.audio-play-btn');
      if (prevAudio) {
        prevAudio.pause();
        prevAudio.currentTime = 0;
        // Free previous audio element
        prevAudio.src = '';
        currentlyPlaying._audio = null;
      }
      currentlyPlaying.classList.remove('playing');
      prevBtn.innerHTML = '&#9654;';
    }

    // Play new
    audio.play();
    item.classList.add('playing');
    btn.innerHTML = '&#9646;&#9646;';
    currentlyPlaying = item;

    // Update duration if not loaded yet
    if (!item._durationLoaded) {
      audio.addEventListener('loadedmetadata', () => {
        item._durEl.textContent = formatDuration(audio.duration);
        item._durationLoaded = true;
      }, { once: true });
    }

    // Reset when finished
    audio.onended = () => {
      item.classList.remove('playing');
      btn.innerHTML = '&#9654;';
      currentlyPlaying = null;
    };
  });

  initGroupToggle('audio-list', '.audio-item');
  initSelection('audio-list', '.audio-item');
});

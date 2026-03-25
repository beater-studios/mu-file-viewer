document.addEventListener('DOMContentLoaded', () => {
  const list = document.getElementById('audio-list');
  if (!list) return;

  let currentlyPlaying = null;

  list.addEventListener('click', (e) => {
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

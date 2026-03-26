/**
 * Group-by-directory toggle + search for file grid/list viewers.
 * Call initGroupToggle('container-id', '.card-selector') after DOMContentLoaded.
 */
const FOLDER_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M1.75 1A1.75 1.75 0 000 2.75v10.5C0 14.216.784 15 1.75 15h12.5A1.75 1.75 0 0016 13.25v-8.5A1.75 1.75 0 0014.25 3H7.5a.25.25 0 01-.2-.1l-.9-1.2C6.07 1.26 5.55 1 5 1H1.75z"/></svg>';
const SEARCH_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M10.68 11.74a6 6 0 111.06-1.06l3.04 3.04a.75.75 0 01-1.06 1.06l-3.04-3.04zM11.5 7a4.5 4.5 0 10-9 0 4.5 4.5 0 009 0z"/></svg>';
const CHEVRON_DOWN = '<svg class="chevron" viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M12.78 5.22a.75.75 0 010 1.06l-4.25 4.25a.75.75 0 01-1.06 0L3.22 6.28a.75.75 0 011.06-1.06L8 8.94l3.72-3.72a.75.75 0 011.06 0z"/></svg>';

function initGroupToggle(gridId, cardSelector) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const containerClass = grid.className.split(' ')[0] || 'file-grid';

  const countEl = grid.previousElementSibling;
  if (!countEl || !countEl.classList.contains('file-count')) return;

  // Search bar
  const searchWrap = document.createElement('div');
  searchWrap.className = 'search-bar';
  searchWrap.innerHTML = SEARCH_ICON + '<input type="text" class="search-input" placeholder="Search files...">';
  countEl.parentNode.insertBefore(searchWrap, countEl.nextSibling);

  const searchInput = searchWrap.querySelector('.search-input');
  let searchTimeout;
  searchInput.addEventListener('input', () => {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => filterCards(searchInput.value.trim().toLowerCase()), 150);
  });

  function filterCards(query) {
    const cards = grid.querySelectorAll(cardSelector);
    let visibleCount = 0;
    cards.forEach(card => {
      const name = (card.dataset.name || card.dataset.file || '').toLowerCase();
      const match = !query || name.includes(query);
      card.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });

    // Update group headers counts when grouped
    grid.querySelectorAll('.dir-group').forEach(group => {
      const subCards = group.querySelectorAll(cardSelector);
      let groupVisible = 0;
      subCards.forEach(c => { if (c.style.display !== 'none') groupVisible++; });
      const countBadge = group.querySelector('.dir-group-count');
      if (countBadge) countBadge.textContent = groupVisible;
      group.style.display = groupVisible === 0 ? 'none' : '';
    });
  }

  // Group toggle button
  const btn = document.createElement('button');
  btn.className = 'group-toggle-btn';
  btn.innerHTML = FOLDER_ICON + ' Group by folder';
  btn.title = 'Group files by directory';
  countEl.appendChild(btn);

  let grouped = false;
  let originalOrder = [];

  btn.addEventListener('click', () => {
    if (!grouped) {
      groupByDirectory();
      btn.innerHTML = FOLDER_ICON + ' Flat view';
      btn.classList.add('active');
    } else {
      ungroupByDirectory();
      btn.innerHTML = FOLDER_ICON + ' Group by folder';
      btn.classList.remove('active');
    }
    grouped = !grouped;
    // Re-apply search filter
    if (searchInput.value.trim()) {
      filterCards(searchInput.value.trim().toLowerCase());
    }
  });

  function getDir(filePath) {
    const lastSlash = filePath.lastIndexOf('/');
    return lastSlash > 0 ? filePath.substring(0, lastSlash) : '(root)';
  }

  function groupByDirectory() {
    const cards = Array.from(grid.querySelectorAll(cardSelector));
    if (cards.length === 0) return;

    originalOrder = cards.map(c => c);

    const groups = {};
    cards.forEach(card => {
      const dir = getDir(card.dataset.file);
      if (!groups[dir]) groups[dir] = [];
      groups[dir].push(card);
    });

    grid.innerHTML = '';
    const sortedDirs = Object.keys(groups).sort();

    sortedDirs.forEach(dir => {
      const section = document.createElement('div');
      section.className = 'dir-group';

      const header = document.createElement('div');
      header.className = 'dir-group-header';
      header.innerHTML = CHEVRON_DOWN + FOLDER_ICON +
        '<span class="dir-group-name">' + dir + '</span>' +
        '<span class="dir-group-count">' + groups[dir].length + '</span>';
      section.appendChild(header);

      // Collapse/expand on header click
      header.addEventListener('click', (e) => {
        // Don't collapse if clicking buttons inside header
        if (e.target.closest('.select-group-btn')) return;
        section.classList.toggle('collapsed');
      });

      const subcontainer = document.createElement('div');
      subcontainer.className = containerClass + ' dir-group-grid';
      groups[dir].forEach(card => subcontainer.appendChild(card));
      section.appendChild(subcontainer);

      grid.appendChild(section);
    });

    grid.classList.add('grouped');
  }

  function ungroupByDirectory() {
    grid.innerHTML = '';
    grid.classList.remove('grouped');
    originalOrder.forEach(card => grid.appendChild(card));
  }
}

/**
 * Multi-select + delete for file grid/list viewers.
 * Call initSelection('container-id', '.card-selector') after DOMContentLoaded.
 */
const TRASH_ICON = '<svg viewBox="0 0 16 16" width="14" height="14" fill="currentColor"><path d="M11 1.75V3h2.25a.75.75 0 010 1.5H2.75a.75.75 0 010-1.5H5V1.75C5 .784 5.784 0 6.75 0h2.5C10.216 0 11 .784 11 1.75zM6.5 1.75a.25.25 0 01.25-.25h2.5a.25.25 0 01.25.25V3h-3V1.75zM4.997 6.178a.75.75 0 10-1.493.144l.44 4.55a1.75 1.75 0 001.742 1.578h4.628a1.75 1.75 0 001.742-1.578l.44-4.55a.75.75 0 00-1.493-.144l-.44 4.55a.25.25 0 01-.249.222H5.686a.25.25 0 01-.249-.222l-.44-4.55z"/></svg>';
const CHECK_ICON = '<svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>';

function initSelection(gridId, cardSelector) {
  const grid = document.getElementById(gridId);
  if (!grid) return;

  const selected = new Set();
  let toolbar = null;

  // "Select all" button in the file-count bar (always visible)
  const countBar = grid.parentNode.querySelector('.file-count');
  if (countBar) {
    const selectAllPermanent = document.createElement('button');
    selectAllPermanent.className = 'group-toggle-btn';
    selectAllPermanent.innerHTML = CHECK_ICON + ' Select all';
    selectAllPermanent.addEventListener('click', () => {
      grid.querySelectorAll(cardSelector).forEach(card => {
        if (card.style.display !== 'none') {
          selected.add(card);
          card.classList.add('selected');
        }
      });
      syncToolbar();
    });
    countBar.appendChild(selectAllPermanent);
  }

  // Create toolbar (appears when items are selected)
  toolbar = document.createElement('div');
  toolbar.className = 'selection-toolbar';
  toolbar.style.display = 'none';
  toolbar.innerHTML = `
    <span class="sel-count"></span>
    <button class="sel-btn sel-none-btn">Deselect all</button>
    <button class="sel-btn sel-delete-btn">${TRASH_ICON} Delete selected</button>
  `;
  grid.parentNode.insertBefore(toolbar, grid);

  const countEl = toolbar.querySelector('.sel-count');
  const deselectAllBtn = toolbar.querySelector('.sel-none-btn');
  const deleteBtn = toolbar.querySelector('.sel-delete-btn');

  // Add checkboxes to existing cards
  addCheckboxes(grid.querySelectorAll(cardSelector));

  // Observe for new cards (when grouping changes the DOM)
  const observer = new MutationObserver(() => {
    const cards = grid.querySelectorAll(cardSelector);
    cards.forEach(card => {
      if (!card.querySelector('.select-checkbox')) {
        addCheckbox(card);
      }
    });
    // Also add group select buttons to new group headers
    grid.querySelectorAll('.dir-group-header').forEach(header => {
      if (!header.querySelector('.select-group-btn')) {
        addGroupSelectBtn(header);
      }
    });
    syncToolbar();
  });
  observer.observe(grid, { childList: true, subtree: true });

  function addCheckboxes(cards) {
    cards.forEach(card => addCheckbox(card));
  }

  function addCheckbox(card) {
    if (card.querySelector('.select-checkbox')) return;
    const cb = document.createElement('div');
    cb.className = 'select-checkbox';
    cb.innerHTML = CHECK_ICON;
    cb.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleCard(card);
    });
    card.appendChild(cb);
  }

  function addGroupSelectBtn(header) {
    const btn = document.createElement('button');
    btn.className = 'select-group-btn';
    btn.textContent = 'Select group';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const group = header.closest('.dir-group');
      if (!group) return;
      const cards = Array.from(group.querySelectorAll(cardSelector)).filter(c => c.style.display !== 'none');
      const allSelected = cards.every(c => selected.has(c));
      cards.forEach(c => {
        if (allSelected) {
          selected.delete(c);
          c.classList.remove('selected');
        } else {
          selected.add(c);
          c.classList.add('selected');
        }
      });
      btn.textContent = allSelected ? 'Select group' : 'Deselect group';
      syncToolbar();
    });
    header.appendChild(btn);
  }

  function toggleCard(card) {
    if (selected.has(card)) {
      selected.delete(card);
      card.classList.remove('selected');
    } else {
      selected.add(card);
      card.classList.add('selected');
    }
    syncToolbar();
  }

  function syncToolbar() {
    // Remove cards that are no longer in DOM
    for (const card of selected) {
      if (!grid.contains(card)) selected.delete(card);
    }
    const count = selected.size;
    if (count > 0) {
      toolbar.style.display = 'flex';
      countEl.textContent = count + ' selected';
    } else {
      toolbar.style.display = 'none';
    }
  }

  deselectAllBtn.addEventListener('click', () => {
    selected.forEach(card => card.classList.remove('selected'));
    selected.clear();
    syncToolbar();
  });

  deleteBtn.addEventListener('click', async () => {
    const count = selected.size;
    if (count === 0) return;

    if (!confirm(`Permanently delete ${count} file(s) from disk?`)) return;

    const files = Array.from(selected).map(card => card.dataset.file);

    try {
      const response = await fetch('delete_files.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ files }),
      });
      const result = await response.json();

      // Remove deleted cards from DOM
      const deletedSet = new Set(result.deleted);
      for (const card of selected) {
        if (deletedSet.has(card.dataset.file)) {
          card.remove();
        }
      }
      selected.clear();
      syncToolbar();

      if (result.failed.length > 0) {
        alert(`Failed to delete ${result.failed.length} file(s).`);
      }
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  });
}

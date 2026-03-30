/**
 * Priority loading queue with search integration.
 *
 * Usage:
 *   const loader = new PriorityLoader({ maxConcurrent: 4 });
 *   loader.observe(card);            // observe card for viewport-based loading
 *   loader.prioritize([card1, ...])  // bump cards to front (e.g. on search)
 *   loader.setLoadFn((card, done) => { ... done(); }); // set the load callback
 */
class PriorityLoader {
  constructor({ maxConcurrent = 4 } = {}) {
    this.maxConcurrent = maxConcurrent;
    this.active = 0;
    this.normalQueue = [];
    this.priorityQueue = [];
    this.loaded = new Set();
    this.queued = new Set();
    this._loadFn = null;

    this._observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this._enqueue(entry.target, false);
          this._observer.unobserve(entry.target);
        }
      });
    }, { rootMargin: '200px' });
  }

  setLoadFn(fn) {
    this._loadFn = fn;
  }

  observe(card) {
    if (this.loaded.has(card)) return;
    this._observer.observe(card);
  }

  /** Push cards to priority queue (e.g. search results). */
  prioritize(cards) {
    this.priorityQueue = [];
    for (const card of cards) {
      if (this.loaded.has(card)) continue;
      // Remove from normal queue if present
      const idx = this.normalQueue.indexOf(card);
      if (idx !== -1) this.normalQueue.splice(idx, 1);
      this.priorityQueue.push(card);
      this.queued.add(card);
    }
    this._process();
  }

  /** Clear priority queue (e.g. search cleared). */
  clearPriority() {
    this.priorityQueue = [];
  }

  _enqueue(card, priority) {
    if (this.loaded.has(card) || this.queued.has(card)) return;
    this.queued.add(card);
    if (priority) {
      this.priorityQueue.push(card);
    } else {
      this.normalQueue.push(card);
    }
    this._process();
  }

  _process() {
    while (this.active < this.maxConcurrent) {
      // Priority queue first
      let card = this.priorityQueue.shift();
      if (!card) card = this.normalQueue.shift();
      if (!card) break;

      if (this.loaded.has(card)) {
        this.queued.delete(card);
        continue;
      }

      this.active++;
      let finished = false;
      const finish = () => {
        if (finished) return;
        finished = true;
        this.active--;
        this.loaded.add(card);
        this.queued.delete(card);
        this._process();
      };

      if (this._loadFn) {
        try {
          const result = this._loadFn(card, finish);
          if (result && typeof result.then === 'function') {
            result.then(finish, finish);
          }
        } catch (e) {
          finish();
        }
      } else {
        finish();
      }
    }
  }
}

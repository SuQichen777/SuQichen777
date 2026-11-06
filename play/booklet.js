/* 張氏商行 · 玩物圖錄 — the pocket edition.
   On phones (and windows up to 1100px wide, if tall enough) the same pages are bound at the top
   into a small booklet: one page at a time, turned upward round the cords at its head.

   The booklet reuses the book's own pages. Each .face of the desktop book becomes one leaf, in
   reading order: front cover, ii, 1, 2 ... 8, finis, back cover. Nothing is copied.

   Layers (all cut from one photographed booklet, see _source-art/play/booklet-top-bound-blank.webp):
     backing  the leather board, its brass corners and the edges of the block; never moves
     leaves   one per page, each painted with the photographed top sheet (cords taken off it);
              the current leaf lies on top, the next one under it
     binding  the header strip and the six cords, over everything, so a leaf turns beneath them
   A turn is a real rotation round the leaf's head (rotateX, in perspective from the binding), with
   the leaf catching the light as it lifts and its shadow running up the page beneath.

   The desktop book keeps its own state (spreads); window.catalogueBook lets the two agree when the
   window crosses the breakpoint: spread t <-> pages 2t-1 and 2t. */
(function () {
  var root = document.documentElement;
  var QUERY = '(max-width: 1100px) and (min-height: 520px)';
  var book = document.querySelector('.book');
  if (!book || !window.matchMedia) { root.removeAttribute('data-booklet'); return; }
  var mq = window.matchMedia(QUERY);
  var force = !!window.BOOKLET_FORCE;           // the prototype page shows the booklet at any size
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var faces = Array.prototype.slice.call(book.querySelectorAll('.face'));
  var N = faces.length;
  var m = 0, active = false, running = null;
  var left = null;   // where the booklet was when the window last grew into the large book

  function el(tag, cls, parent) { var e = document.createElement(tag); e.className = cls; e.setAttribute('aria-hidden', 'true'); if (parent) parent.appendChild(e); return e; }
  var backing = el('div', 'booklet__backing'); book.insertBefore(backing, book.firstChild);
  var cast = el('div', 'booklet__cast', book); var castBand = el('i', '', cast);
  el('div', 'booklet__binding', book);
  faces.forEach(function (f) { el('span', 'leaf__light leaf__light--hi', f); el('span', 'leaf__light leaf__light--lo', f); });

  // where am I: a figure between the buttons, and a sentence for screen readers
  var stage = book.parentElement;
  var ind = document.createElement('p'); ind.className = 'booklet__ind'; stage.insertBefore(ind, book.nextSibling);
  var live = document.createElement('p'); live.className = 'booklet__live'; live.setAttribute('aria-live', 'polite'); stage.appendChild(live);
  function label(i) {
    var n = i + 1;
    if (i === 0) return { zh: '封面', 'zh-Hans': '封面', en: 'Front cover' };
    if (i === N - 1) return { zh: '封底', 'zh-Hans': '封底', en: 'Back cover' };
    return { zh: '第 ' + n + ' 頁 · 共 ' + N + ' 頁', 'zh-Hans': '第 ' + n + ' 页 · 共 ' + N + ' 页', en: 'Page ' + n + ' of ' + N };
  }
  function say(i) {
    var l = label(i), html = '';
    ['zh', 'zh-Hans', 'en'].forEach(function (k) { html += '<span lang="' + k + '">' + l[k] + '</span>'; });
    live.innerHTML = html;
    ind.innerHTML = '<b>' + (i + 1) + '</b><i>/</i>' + N;
  }

  /* ---------- state ---------- */
  var SHEETS = book.querySelectorAll('.sheet').length;
  function fromSpread(t) { return t <= 0 ? 0 : t >= SHEETS ? N - 1 : Math.min(N - 1, 2 * t - 1); }
  function toSpread(i) { return i <= 0 ? 0 : i >= N - 1 ? SHEETS : Math.ceil(i / 2); }
  var prev = document.querySelector('.turn--prev'), next = document.querySelector('.turn--next');

  function render() {
    faces.forEach(function (f, i) {
      f.classList.toggle('is-current', i === m);
      f.style.zIndex = 100 - 2 * i;              // an earlier page lies on top of a later one
    });
    book.setAttribute('data-page', m);
    if (prev) prev.disabled = m === 0;
    if (next) next.disabled = m === N - 1;
    say(m);
  }

  /* ---------- a page fits its leaf ----------
     Every size on a page is in --u, so a page is the same print at any size of booklet. Should a
     page still run over (a long word, a missing font), its type is let down a step at a time, to
     no less than 86%; past that the page scrolls inside its leaf rather than lose a line. */
  function fit() {
    faces.forEach(function (f) {
      var p = f.querySelector('.page'); if (!p) return;
      f.classList.remove('is-scroll'); f.style.removeProperty('--fit');
      var steps = [1, .96, .92, .89, .86], k = 0;
      while (p.scrollHeight > p.clientHeight + 1 && k < steps.length - 1) { k++; f.style.setProperty('--fit', steps[k]); }
      if (p.scrollHeight > p.clientHeight + 1) f.classList.add('is-scroll');
    });
  }

  /* ---------- turning ---------- */
  var EASE = 'cubic-bezier(.4, .02, .24, 1)';
  function turn(dir) {
    if (!active || running) return;
    var to = m + dir;
    if (to < 0 || to >= N) return;
    var leaf = faces[dir > 0 ? m : to];         // the leaf that moves: off the pile, or back onto it
    var under = faces[dir > 0 ? to : m];        // the page it uncovers, or covers again
    if (reduce.matches) return swap(leaf, under, to, dir);
    var r = leaf.getBoundingClientRect(), bk = book.getBoundingClientRect();
    var hinge = parseFloat(getComputedStyle(leaf).transformOrigin.split(' ')[1]) || 0;
    // the eye: well out in front, level with a point near the foot of the page (D below the hinge).
    // Seen from there the free edge rises from the first moment, and the leaf goes edge-on, a line
    // along the binding, at TH (about 83 degrees): that is where it passes out of sight
    var Lh = r.height - hinge, P = Lh * 7, D = Lh * .85, TH = Math.atan(P / D);
    var DUR = leaf.classList.contains('cover') ? 1000 : 840;   // the board is heavier than a leaf
    var opts = { duration: DUR, easing: EASE, fill: 'both', direction: dir > 0 ? 'normal' : 'reverse' };
    var tf = function (rad) { return 'translateY(' + D.toFixed(1) + 'px) perspective(' + P.toFixed(1) + 'px) translateY(' + (-D).toFixed(1) + 'px) rotateX(' + (rad * 180 / Math.PI).toFixed(3) + 'deg)'; };

    leaf.classList.add('is-turning'); under.classList.add('is-under');
    // the shadow lies on the page beneath, under the turning leaf
    cast.className = 'booklet__cast is-on' + (under.classList.contains('cover') ? ' on-cover' : '');
    cast.style.zIndex = 100 - 2 * (dir > 0 ? to : m) + 1;
    var top0 = r.top - bk.top + hinge - cast.offsetTop;   // the hinge, in the cast's own box

    var kHi = [], kLo = [], kCast = [];
    for (var s = 0; s <= 16; s++) {
      var p = s / 16, th = p * TH;
      // light from above and in front: brightest with the leaf tipped ~40 degrees toward it
      var lit = Math.cos(th - .7) - Math.cos(.7);   // (th - .7 rad: the lamp ~40 degrees up)
      kHi.push({ offset: p, opacity: Math.max(0, lit * 1.6).toFixed(3) });
      kLo.push({ offset: p, opacity: Math.max(0, (p - .45) / .55 * .9).toFixed(3) });
      // the free edge's place on screen, in perspective from the binding
      var yb = D + (Lh * Math.cos(th) - D) * P / (P - Lh * Math.sin(th));
      var lift = Math.sin(th);
      kCast.push({ offset: p, transform: 'translateY(' + (top0 + yb).toFixed(1) + 'px) scaleY(' + (.35 + 1.3 * lift).toFixed(3) + ')',
                   opacity: (Math.min(1, p * 5) * (1 - p * .5) * (1 - Math.pow(p, 6))).toFixed(3) });
    }
    var anims = [
      leaf.animate([{ transform: tf(0) }, { transform: tf(TH) }], opts),
      leaf.querySelector('.leaf__light--hi').animate(kHi, opts),
      leaf.querySelector('.leaf__light--lo').animate(kLo, opts),
      castBand.animate(kCast, opts)
    ];
    running = { anims: anims, finish: function () { finish(leaf, under, to, anims); } };
    anims[0].onfinish = running.finish;
  }
  function finish(leaf, under, to, anims) {
    if (!running) return;
    m = to; render();
    leaf.classList.remove('is-turning'); under.classList.remove('is-under');
    cast.className = 'booklet__cast';
    anims.forEach(function (a) { a.cancel(); });
    running = null;
  }
  // reduced motion: the page simply gives way to the next, in a moment
  function swap(leaf, under, to, dir) {
    leaf.classList.add('is-turning'); under.classList.add('is-under');
    var a = leaf.animate([{ opacity: dir > 0 ? 1 : 0 }, { opacity: dir > 0 ? 0 : 1 }], { duration: 160, fill: 'both' });
    running = { anims: [a], finish: function () { finish(leaf, under, to, [a]); } };
    a.onfinish = running.finish;
  }
  function settle() { if (running) { running.anims.forEach(function (a) { a.onfinish = null; }); running.finish(); } }

  function go(i) { settle(); m = Math.max(0, Math.min(N - 1, i)); render(); }

  /* ---------- hands ---------- */
  // a swipe up turns forward, down turns back. Swipes that start on a control are the control's;
  // the large engravings (links kept out of the tab order) still turn the page.
  var CONTROL = 'button, input, select, textarea, label, [contenteditable], a:not([tabindex="-1"])';
  var t0 = null, swallow = false;
  book.addEventListener('touchstart', function (e) {
    if (!active || e.touches.length !== 1) { t0 = null; return; }
    var t = e.touches[0];
    t0 = { x: t.clientX, y: t.clientY, time: Date.now(), control: !!e.target.closest(CONTROL) };
  }, { passive: true });
  book.addEventListener('touchmove', function (e) {
    if (t0 && e.touches.length !== 1) t0 = null;   // a pinch is a zoom, not a turn
  }, { passive: true });
  book.addEventListener('touchend', function (e) {
    if (!t0 || !active) return;
    var t = e.changedTouches[0], dx = t.clientX - t0.x, dy = t.clientY - t0.y, dt = Math.max(1, Date.now() - t0.time);
    var start = t0; t0 = null;
    if (start.control) return;
    var vertical = Math.abs(dy) > Math.abs(dx) * 1.4;
    var far = Math.abs(dy) > 56, quick = Math.abs(dy) > 22 && Math.abs(dy) / dt > .45;
    if (vertical && (far || quick)) {
      if (String(window.getSelection ? window.getSelection() : '').length) return;   // a drag to select text
      swallow = true; setTimeout(function () { swallow = false; }, 400);
      turn(dy < 0 ? 1 : -1);
    }
  }, { passive: true });
  book.addEventListener('touchcancel', function () { t0 = null; }, { passive: true });

  // a tap (or click) on the page turns it, as in the large book; links and buttons keep their own.
  // A tap that only clears a text selection is not a turn: the selection is gone by the click.
  var hadSelection = false;
  book.addEventListener('pointerdown', function () { hadSelection = String(window.getSelection ? window.getSelection() : '').length > 0; }, true);
  book.addEventListener('click', function (e) {
    if (!active) return;
    if (swallow) { swallow = false; return; }
    if (hadSelection) { hadSelection = false; return; }
    if (e.target.closest('a, button')) return;
    if (String(window.getSelection ? window.getSelection() : '').length) return;
    if (!e.target.closest('.face')) return;
    turn(m === N - 1 ? -1 : 1);
  });
  [prev, next].forEach(function (b, k) {
    if (b) b.addEventListener('click', function () { if (active) turn(k ? 1 : -1); });
  });
  document.addEventListener('keydown', function (e) {
    if (!active || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.target.closest && e.target.closest('input, textarea, select, [contenteditable]')) return;
    var k = e.key;
    if (k === 'ArrowDown' || k === 'PageDown' || k === 'ArrowRight') { e.preventDefault(); turn(1); }
    else if (k === 'ArrowUp' || k === 'PageUp' || k === 'ArrowLeft') { e.preventDefault(); turn(-1); }
  });

  /* ---------- one catalogue, two bindings ---------- */
  function fromHash() {
    var id = (location.hash || '').slice(1), target = id && document.getElementById(id);
    var f = target && target.closest('.face');
    return f ? faces.indexOf(f) : -1;
  }
  function enter() {
    if (active) return;
    active = true;
    root.setAttribute('data-booklet', '');
    book.classList.add('is-booklet');
    var api = window.catalogueBook, h = fromHash(), t = api ? api.get() : null;
    // back from the large book: the same page if the reader didn't turn it there, else the spread's first page
    if (h >= 0 && !left) m = h;
    else if (api) m = left && left.spread === t ? left.page : fromSpread(t);
    render();
    requestAnimationFrame(fit);
  }
  function leave() {
    if (!active) return;
    settle();
    active = false;
    root.removeAttribute('data-booklet');
    book.classList.remove('is-booklet');
    book.removeAttribute('data-page');
    faces.forEach(function (f) { f.style.zIndex = ''; f.style.removeProperty('--fit'); f.classList.remove('is-current', 'is-turning', 'is-under', 'is-scroll'); });
    if (window.catalogueBook) { window.catalogueBook.set(toSpread(m)); left = { page: m, spread: window.catalogueBook.get() }; }
  }
  function sync() { if (force || mq.matches) enter(); else leave(); }
  if (mq.addEventListener) mq.addEventListener('change', sync); else mq.addListener(sync);
  window.addEventListener('hashchange', function () { if (!active) return; var h = fromHash(); if (h >= 0) go(h); });
  var refit; window.addEventListener('resize', function () { if (!active) return; clearTimeout(refit); refit = setTimeout(fit, 150); });
  document.addEventListener('click', function (e) {   // a new edition sets its lines anew
    if (active && e.target.closest('[data-set-lang]')) requestAnimationFrame(fit);
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { if (active) fit(); });
  window.addEventListener('load', function () { if (active) fit(); });

  // for tests: hold a turn at any point (0..1) and look at it
  window.__booklet = {
    page: function () { return m; }, go: go, turn: turn, active: function () { return active; },
    hold: function (dir, p) { turn(dir); if (running) running.anims.forEach(function (a) { a.pause(); a.currentTime = a.effect.getTiming().duration * p; }); },
    release: settle
  };
  sync();
})();

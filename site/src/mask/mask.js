/* mask — raw pixels to rounded runs.

   mask.raw is the mask's own pixels: one byte per pixel, row by row, no header,
   84 x 82 of them. Ink is anything darker than 128, exactly like the mask's own
   black, and that is the whole input.

   The drawing rule is one line of the brief: inside a row, neighbouring ink
   pixels are not separate squares, they are one rectangle with rounded corners.
   So a row becomes a list of runs, and each run becomes one element:

     row  y:  ....####..##....   ->   .px at x=4 w=4   .px at x=10 w=2

   Rows never merge vertically. Each row is drawn on its own, on the grid pitch,
   touching the row above and below it: at rest the drawing is solid, the way the
   reference is.

   Size belongs to the CSS: the page hands the piece a box, #frame, and this file
   only divides that box by 84 x 82 to find the cell. In this project the number
   that sizes #frame is --frame, in src/estilos/tokens.css. Change it there and
   the whole drawing follows.

   The piece reads its data from its own folder — mask.raw sits next to this file
   — so it can be dropped into another page, at another depth, and still find it.
   Nothing here knows anything about the site around it.

   Five things move, and all of them are kept off the layout engine:
     in    the drawing grows in from the left, staggered one delay per column,
           as a scaleX on each run — no width, no layout, no reflow. A run grows
           out of its own left edge, so the cells travel rightwards;
     walk  the page's own climb, read into the ink: the drawing walks from the ink it
           is towards the ink it settles into, and the scroll's position, never its
           speed, is what says how far;
     out   the same wave again, but every cell is swallowed into its own right
           edge: the columns leave from the left and the cells leave to the
           right, which is the way the piece arrived, run backwards;
     near  the runs swell sideways around the pointer, inside a radius measured
           in cells, as a scaleX about each run's own centre — the drawing
           thickens under the hand and settles back behind it. Sideways only:
           the rows never move, the grid never shifts;
     fit   the frame resizing rescales the whole grid.

   The sweeps are public, because a page is not a loop:
     window.MASK.in()      grow in from the left
     window.MASK.out()     go out from the left
     window.MASK.replay()  out, then in — what a click on the piece does
     window.MASK.fade()    settle into the watermark ink and stay there
     window.MASK.play('in' | 'out', then, lead)   the two of them, with a
                           callback for when the sweep has landed and, if you
                           want it, milliseconds of head start on the wave

   And the page can ask for the whole clock at a different speed: --mask-pace, in
   CSS, where the site keeps its decisions. 1 is the piece as drawn; 0.5 is the same
   wave in half the time, which is what a visitor who has already seen it gets. The
   piece reads it at every sweep and does not care who wrote it.

   And the piece opens itself: it holds off WAIT, arrives, stands HOLD, and then
   settles into the watermark — the same drawing in a grayer ink, staying where it
   is instead of leaving. That is the site's opening, not a loop. The out sweep is
   kept for actually going: a link click, a page change.

   When a sweep lands, the piece says so out loud:
     document.addEventListener('mask:landed', function (e) { e.detail.kind })
   It does not know who is listening. That is how the rest of the page — the
   aside, whatever comes next — can take its cue from the drawing without the
   drawing knowing anything about it.

   Each run is two elements, because two motions happen at the same time during
   the opening: the cell carries the pointer's swell as an inline transform, and
   the ink inside it carries the sweeps as a CSS animation — which would stamp
   over any inline transform of its own. Two layers, one on each. */
(function () {
  'use strict';

  /* The two facts a headerless raw file cannot carry. tools/updatemask.js
     rewrites these two lines from mask.png, so they follow the image on their
     own; edit mask.png, run the tool, touch nothing here. */
  var W = 90;
  var H = 139;

  /* A pixel this dark is ink. The mask is pure 0 and 255, so anything between
     the two works; 128 keeps a re-scan of it honest. */
  var CUT = 128;

  /* The space between rows at rest, as a share of one cell. 0 is the reference:
     the rows touch and the drawing is one solid mass. */
  var GAP = 0;

  /* How far a run swells sideways under the pointer, as a share of one cell,
     measured on each side. This is the whole interaction. */
  var SPREAD = 0.6;

  /* The pointer's reach, in cells, and how fast the runs answer it. Under
     prefers-reduced-motion the answer is immediate rather than animated. */
  var REACH = 6.5;
  var EASE = 0.22;

  /* The sweeps: milliseconds of delay per column, and how long one run takes.
     STEP is the speed of the wave, GROW the length of a single run's move.
     WAIT is how long the piece holds off before arriving at all; HOLD is how
     long it stands there before settling into the watermark. */
  var STEP = 30;
  var GROW = 320;
  var WAIT = 500;
  var HOLD = 500;

  var frame = document.getElementById('frame');
  var art = document.getElementById('art');
  if (!frame || !art) return;

  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (still.matches) EASE = 1;

  /* Everything the pointer and a resize need to know about one run. */
  var runs = [];
  var byRow = [];
  var pulled = [];

  var cell = 5;     // one mask pixel, in CSS px
  var gap = 0;      // the resting space between rows, in CSS px
  var spread = 3;   // how far a run swells sideways under the pointer, per side
  var reach = 32;   // the pointer's reach, in CSS px
  var ox = 0;       // the drawing's own origin, for pointer maths
  var oy = 0;
  var span = 0;     // how much scroll the whole walk takes, in px

  var busy = false; // a sweep owns every transform right now
  var away = false; // the drawing is out, and stays out until it is called back
  var faded = false; // the drawing has settled into the watermark ink
  var lastFade = -1; // the last --mask-fade written, so a walk only writes changes

  var pointer = { x: -1e9, y: -1e9, on: false };
  var lastPointer = { x: -1e9, y: -1e9 };
  var raf = 0;

  /* ---------- the raw ---------- */

  /* One run per contiguous group of ink inside a row. Runs, not pixels, are
     what gets drawn — that is the entire conversion. */
  function runsOf(raw) {
    var list = [];
    for (var y = 0; y < H; y++) {
      var base = y * W;
      var x = 0;
      while (x < W) {
        if (raw[base + x] < CUT) {
          var start = x;
          while (x < W && raw[base + x] < CUT) x++;
          list.push({ x: start, y: y, len: x - start, el: null, cur: 1, stretched: false });
        } else {
          x++;
        }
      }
    }
    return list;
  }

  /* The raw file wins. The embedded copy is the same bytes, and exists only
     so the page still draws when it is opened straight from disk (file://),
     where fetch of a sibling file is refused. */
  function fromBase64(text) {
    var bin = atob(text);
    var out = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  }

  function embedded() {
    return window.MASK_RAW ? fromBase64(window.MASK_RAW) : new Uint8Array(0);
  }

  /* The raw is looked up next to this script, never relative to the page: the
     piece then works at any depth. document.currentScript is only readable while
     this file is the one executing, so the answer is taken now and kept. */
  var RAW_URL = (function () {
    var self = document.currentScript && document.currentScript.src;
    return self ? self.replace(/[^/]*$/, 'mask.raw') : 'mask.raw';
  })();

  function loadRaw() {
    return fetch(RAW_URL, { cache: 'no-store' }).then(function (res) {
      if (!res.ok) throw new Error('no mask.raw');
      return res.arrayBuffer();
    }).then(function (buf) {
      var raw = new Uint8Array(buf);
      return raw.length === W * H ? raw : embedded();
    }).catch(embedded);
  }

  /* ---------- the drawing ---------- */

  function build(list) {
    var frag = document.createDocumentFragment();
    for (var i = 0; i < list.length; i++) {
      /* The cell holds the geometry and answers the pointer; the ink inside it
         is what moves in the sweeps. See the note at the top of the file. */
      var el = document.createElement('div');
      var ink = document.createElement('span');
      el.className = 'px';
      ink.className = 'ink';
      el.appendChild(ink);
      frag.appendChild(el);
      list[i].el = el;
      list[i].inkEl = ink;
    }
    art.appendChild(frag);

    runs = list;
    byRow = [];
    for (var y = 0; y < H; y++) byRow.push([]);
    for (var j = 0; j < runs.length; j++) byRow[runs[j].y].push(runs[j]);
  }

  /* The cell is whatever divides the frame's box into 84 x 82 whole pixels, and
     never less than two of them. */
  function measure() {
    var box = frame.getBoundingClientRect();
    cell = Math.max(2, Math.floor(Math.min(box.width / W, box.height / H)));
    /* Whole-pixel gap, swell and offset: a fractional one would make every edge
       in the drawing a soft one on a 1x screen. */
    gap = Math.max(0, Math.round(cell * GAP));
    spread = Math.max(1, Math.round(cell * SPREAD));
    reach = cell * REACH;

    art.style.width = W * cell + 'px';
    art.style.height = H * cell + 'px';

    var inner = art.getBoundingClientRect();
    ox = inner.left;
    oy = inner.top;
  }

  /* Rest geometry: every run sits in its own row on whole pixels, with no
     transform of its own. */
  function place() {
    for (var i = 0; i < runs.length; i++) {
      var run = runs[i];
      run.left = run.x * cell;
      run.top = run.y * cell + Math.floor(gap / 2);
      run.w = run.len * cell;
      run.h = cell - gap;

      run.el.style.left = run.left + 'px';
      run.el.style.width = run.w + 'px';
      run.el.style.top = run.top + 'px';
      run.el.style.height = run.h + 'px';
      run.el.style.transform = '';
      run.cur = 1;
      run.stretched = false;
    }
    pulled = [];
  }

  function draw() {
    measure();
    place();
  }

  /* ---------- the pointer ---------- */

  /* Distance from the pointer to a run's resting box: 0 inside it, positive
     outside, so a bar is answered along its whole length and not only at its
     middle. */
  function distance(run) {
    var dx = pointer.x < run.left ? run.left - pointer.x
           : (pointer.x > run.left + run.w ? pointer.x - (run.left + run.w) : 0);
    var dy = pointer.y < run.top ? run.top - pointer.y
           : (pointer.y > run.top + run.h ? pointer.y - (run.top + run.h) : 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  /* 1 is a run at rest, 0 is a run the pointer is touching. Smoothstepped, so
     the swell has no edge to it. */
  function proximity(run) {
    if (!pointer.on) return 1;
    var d = distance(run);
    if (d >= reach) return 1;
    var t = 1 - d / reach;
    return 1 - t * t * (3 - 2 * t);
  }

  /* The only thing the pointer changes: how wide a run is, by scaleX about its
     own centre, so it swells the same amount to either side and nothing else in
     the drawing moves. A transform, never a width: the layout engine is not
     asked for anything. */
  function swell(run, k) {
    if (k === 1) {
      if (run.stretched) {
        run.el.style.transform = '';
        run.stretched = false;
      }
      return;
    }
    var grow = spread * (1 - k);
    run.el.style.transform = 'scaleX(' + ((run.w + 2 * grow) / run.w).toFixed(4) + ')';
    run.stretched = true;
  }

  function tick() {
    raf = 0;
    /* A sweep does not stop the pointer: the swell and the wave are on different
       layers on purpose. Only a drawing that is away has nothing to answer. */
    if (away || !runs.length) return;

    /* The runs in the pointer's band of rows, plus whatever is still on its way
       back from an earlier position. Nothing else is touched. */
    var batch = [];
    var y0 = 1e9;
    var y1 = -1e9;
    if (pointer.on) {
      y0 = Math.max(0, Math.floor((pointer.y - reach) / cell));
      y1 = Math.min(H - 1, Math.floor((pointer.y + reach) / cell));
      for (var y = y0; y <= y1; y++) {
        var row = byRow[y];
        for (var i = 0; i < row.length; i++) batch.push(row[i]);
      }
    }
    for (var p = 0; p < pulled.length; p++) {
      var run = pulled[p];
      if (run.y < y0 || run.y > y1) batch.push(run);
    }

    var kept = [];
    var moved = 0;
    for (var n = 0; n < batch.length; n++) {
      var r = batch[n];
      var k = proximity(r);
      if (k !== r.cur) {
        var next = r.cur + (k - r.cur) * EASE;
        if (Math.abs(k - next) < 0.004) next = k;
        if (next !== r.cur) {
          r.cur = next;
          swell(r, r.cur);
          moved++;
        }
      }
      if (r.cur < 1) kept.push(r);
    }
    pulled = kept;

    var pointerMoved = pointer.x !== lastPointer.x || pointer.y !== lastPointer.y;
    lastPointer.x = pointer.x;
    lastPointer.y = pointer.y;

    if (moved || kept.length || (pointer.on && pointerMoved)) {
      raf = requestAnimationFrame(tick);
    }
  }

  function wake() {
    if (!raf && !away) raf = requestAnimationFrame(tick);
  }

  /* ---------- the sweeps ---------- */

  /* The wave is the same in both directions: one delay per column, left to
     right. The delay lives inline because it is a property of the run's
     position, not of the stylesheet. lead is a head start for every column at
     once, which is how the piece waits before arriving without ever being seen
     waiting. pace is the page's --mask-pace, already read. Returns how late the
     last column starts. */
  function timing(lead, pace) {
    var last = 0;
    for (var i = 0; i < runs.length; i++) {
      var run = runs[i];
      var delay = Math.round((lead + run.x * STEP) * pace);
      if (delay > last) last = delay;
      run.inkEl.style.animationDelay = delay + 'ms';
      run.inkEl.style.animationDuration = Math.round(GROW * pace) + 'ms';
    }
    return last;
  }

  function untiming() {
    for (var i = 0; i < runs.length; i++) {
      runs[i].inkEl.style.animationDelay = '';
      runs[i].inkEl.style.animationDuration = '';
    }
  }

  /* kind: 'in' | 'out'. The class stays on for an out — it is what holds the
     drawing collapsed — and comes off again for an in. */
  function play(kind, then, lead) {
    if (busy || !runs.length) return;
    busy = true;

    if (kind === 'in') {
      away = false;
      faded = false;
      art.classList.remove('out', 'faded');
      /* Back in ink, and the walk starts again wherever the page is now. */
      walkNow();
    } else {
      art.classList.remove('grow');
    }

    var pace = paceOf();
    var last = timing(lead || 0, pace);
    art.classList.add(kind === 'in' ? 'grow' : 'out');

    setTimeout(function () {
      busy = false;
      away = kind === 'out';

      if (kind === 'in') {
        art.classList.remove('grow');
        untiming();
      }

      /* The rest of the page may be waiting for this. The piece does not know
         who is listening — it only says that it has landed, and from which
         side. */
      announce(kind);

      if (then) then();
      else if (!away && pointer.on) wake();
    }, still.matches ? 0 : last + GROW * pace + 100);
  }

  /* The piece's own clock, as the page set it: --mask-pace in CSS, 1 when nobody
     has said otherwise. Read at every sweep rather than once, because the answer is
     the page's and the page can change it. */
  /* ---------- the walk to the watermark ----------

     The page's own climb, read into the drawing's colour. --mask-fade is how far along
     the way to the watermark the ink is, and --mask-fade-by is how much scroll that
     takes, counted in screens; both live in the CSS, so the page decides and the piece
     obeys, exactly as it does with --mask-pace.

     It is the scroll's position, never its speed: scroll back and the ink comes back
     with it, and stopping stops it. */
  function walk() {
    if (faded) return;
    var t = span > 0 ? window.scrollY / span : 0;
    if (t > 1) t = 1;
    else if (t < 0) t = 0;
    /* Two decimals: nobody can see finer than that, and every write is a style
       recalculation for the whole drawing. */
    t = Math.round(t * 100) / 100;
    if (t === lastFade) return;
    lastFade = t;
    art.style.setProperty('--mask-fade', t);
  }

  /* How much page the walk takes, in px: --mask-fade-by screens of the window. Read
     rather than remembered, so the page can change its mind. */
  function measureWalk() {
    var v = parseFloat(getComputedStyle(art).getPropertyValue('--mask-fade-by'));
    span = (isFinite(v) && v > 0 ? v : 1) * window.innerHeight;
  }

  function walkNow() {
    measureWalk();
    walk();
  }

  function paceOf() {
    var v = parseFloat(getComputedStyle(art).getPropertyValue('--mask-pace'));
    return isFinite(v) && v > 0 ? v : 1;
  }

  /* The watermark: the drawing in a grayer ink, staying where it is instead of
     leaving. One class in the CSS does it, so there is no per-run work here. */
  function fade() {
    if (faded) return;
    faded = true;
    /* The watermark is a decision and the walk is the page's; the class has to win
       over whatever the walk left inline. */
    art.style.removeProperty('--mask-fade');
    lastFade = -1;
    art.classList.add('faded');
    announce('faded');
  }

  /* The piece says what happened, and nothing about who cares. */
  function announce(kind) {
    document.dispatchEvent(new CustomEvent('mask:landed', { detail: { kind: kind } }));
  }

  /* The opening: hold off, arrive, stand. Not a loop — after it, the page is the
     page.
     The watermark is off for now: the drawing stays in ink after arriving. To
     bring it back, uncomment the fade below — or call window.MASK.fade() whenever
     the click that should trigger it happens. */
  function opening() {
    play('in', function () {
      // setTimeout(fade, HOLD);
    }, still.matches ? 0 : WAIT);
  }

  function replay() {
    if (busy) return;
    if (away) { play('in'); return; }
    play('out', function () { play('in'); });
  }

  /* ---------- wiring ---------- */

  function live() {
    draw();
    requestAnimationFrame(opening);

    window.addEventListener('pointermove', function (event) {
      if (away) return;
      pointer.on = true;
      pointer.x = event.clientX - ox;
      pointer.y = event.clientY - oy;
      wake();
    }, { passive: true });

    /* The pointer going away means the runs go back to their own width. */
    window.addEventListener('pointerleave', function () {
      pointer.on = false;
      wake();
    });

    window.addEventListener('blur', function () {
      pointer.on = false;
      wake();
    });

    /* A lifted finger leaves no pointerleave behind, so the runs have to be
       released explicitly. A mouse is left alone: it is still there. */
    window.addEventListener('pointerup', function (event) {
      if (event.pointerType !== 'touch') return;
      pointer.on = false;
      wake();
    });

    window.addEventListener('pointercancel', function () {
      pointer.on = false;
      wake();
    });

    /* A click on the piece used to bring it back. Off for now — a click on the
       page should not start an animation. To bring it back:
       frame.addEventListener('click', replay); */

    /* The CSS owns the size, so the size is watched where it changes — on the
       frame itself, which is also what a zoom or a rotate moves. */
    var queued = 0;
    function requeue() {
      if (queued) return;
      queued = requestAnimationFrame(function () {
        queued = 0;
        draw();
        /* A new window height is a new walk: how much scroll it takes changed with
           it. */
        walkNow();
      });
    }

    /* The walk to the watermark is the page's climb, so it is wired here with the
       rest of the page's cues. */
    walkNow();
    window.addEventListener('scroll', walk, { passive: true });

    if (window.ResizeObserver) new ResizeObserver(requeue).observe(frame);
    window.addEventListener('resize', requeue);
    window.addEventListener('orientationchange', requeue);

    window.MASK = {
      play: play,
      in: function (then, lead) { play('in', then, lead); },
      out: function (then) { play('out', then); },
      fade: fade,
      replay: replay
    };
  }

  function start() {
    loadRaw().then(function (raw) {
      if (raw.length !== W * H) return;
      build(runsOf(raw));
      live();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

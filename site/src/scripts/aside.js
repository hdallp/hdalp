/* aside — the navigation: a column built entirely out of bars.

   There is no background panel. The black column IS the stack of bars, touching
   one another. Some bars carry an item (label + link), the rest are just bars.
   That is what lets the column assemble line by line, top to bottom, until it
   closes.

   The ITEMS list below drives the items: label, click target, and, if you want,
   how far that one bar stretches. The empty bars are derived — as many as it
   takes to close the column, with the items centred inside it.

   Four things move:
     in     the mark first, then every bar, one by one, top to bottom, each
            flying in from off-screen left;
     near   the pointer: a bar with an item stretches out to --stretch, an empty
            bar only --empty of that;
     cool   every bar cools towards --cool in proportion to how close the pointer
            is — and lets go slowly, on its own clock, so the colour stays on the
            bar for a while after the pointer has moved on;
     hover  the item's bar stretches --hover further, so its tip — and the label
            sitting on it — travels right. It never slides sideways: a bar that
            slid would open a gap against the edge of the column.

   The column arrives when the piece steps back: site/src/mask/mask.js announces
   mask:landed, and the arrival waits for the drawing to settle into its watermark
   (or to wipe out, if that ever comes first). The navbar does not wait: on a phone
   the row is the first thing the page shows, so it lands with the load. And the
   column only waits on a first visit, and then once a day — see firstVisit.

   Every number lives in site/src/estilos/aside.css. This file only reads. */
(function () {
  'use strict';

  /* ---------- the list ---------- */

  /* title   the item's label: it sits inside the bar and is the link's
             accessible name
     target  what the click brings: a URL or '#anchor', or a function
     stretch optional: how far this bar stretches under the pointer, in px — the
             default comes from --stretch in the CSS. It is what gives one item a
             length of its own. */
  var ITEMS = [
    { title: 'portfolio', target: './portfolio/' },
    { title: 'contato',   target: '#contato' },
    { title: 'sobre',     target: '#sobre' }
  ];

  /* OFF is how far past the screen edge a bar starts, so it really is out of
     sight. The pacing of the arrival — the mark's head start, the gap between
     bars, the length of one flight — is not here: it is --delay, --per-line and
     --flight in aside.css, because the two layouts pace themselves differently. */
  var OFF = 8;

  /* If the piece never announces that it left (missing raw, broken script), the
     navigation must not be held hostage by it. */
  var MAX_WAIT = 6000;

  var aside = document.getElementById('aside');
  if (!aside) return;

  /* The mark is page content, not data from this list: it is already in the HTML,
     and here it is only measured so it can arrive off-screen like the rest. */
  var mark = aside.querySelector('.mark');

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  var bars = [];
  var line = 44, stretch = 56, empty = 0.4, hover = 12, reach = 90;
  var ease = 0.2, coolEase = 0.03;
  var delayStep = 240, perLine = 45, flight = 620;
  var ink = [7, 7, 7], cool = [47, 107, 255];
  var last = 0;
  var entered = false;
  var arriving = false;
  /* When the arrival began. A rebuild in the middle of it — a resize, which is
     exactly when a viewport settles — needs it to pick the flight up where it was
     instead of flying the whole row again from the top. */
  var started = 0;

  var pointer = { x: -1e9, y: -1e9, on: false };
  var previous = { x: -1e9, y: -1e9 };
  var raf = 0;

  /* ---------- the numbers ---------- */

  /* One reader for the stylesheet, so every number this file uses comes from
     there and nowhere else. It is asked again on every build, because a media
     query can change the answer. */
  function css(name, fallback) {
    var v = parseFloat(getComputedStyle(aside).getPropertyValue(name));
    return isFinite(v) ? v : fallback;
  }

  /* The numbers that never change with the layout. The two colours are read once,
     as rgb, because the gradient is recomputed every frame and parsing two hex
     strings here is cheaper than asking the browser to resolve a colour per bar
     per frame. */
  function read() {
    var cs = getComputedStyle(aside);

    line = css('--line', 44);
    delayStep = css('--delay', 240);
    perLine = css('--per-line', 45);
    flight = css('--flight', 620);
    stretch = css('--stretch', 56);
    empty = css('--empty', 0.4);
    hover = css('--hover', 12);
    reach = css('--reach', 90);
    ease = css('--ease', 0.2);
    coolEase = css('--cool-ease', 0.03);

    /* Nothing is animated frame by frame when motion is not wanted: both clocks
       answer in one frame. */
    if (reduced.matches) {
      ease = 1;
      coolEase = 1;
    }

    var a = rgb(cs.getPropertyValue('--line-bg'));
    var b = rgb(cs.getPropertyValue('--cool'));
    if (a) ink = a;
    if (b) cool = b;
  }

  function rgb(value) {
    var v = (value || '').trim();
    var m = /^#([0-9a-f]{6})$/i.exec(v);
    if (m) {
      var n = parseInt(m[1], 16);
      return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }
    m = /^#([0-9a-f]{3})$/i.exec(v);
    if (m) {
      var s = m[1];
      return [parseInt(s[0] + s[0], 16), parseInt(s[1] + s[1], 16), parseInt(s[2] + s[2], 16)];
    }
    m = /rgba?\(([^)]+)\)/i.exec(v);
    if (m) {
      var parts = m[1].split(',');
      return [parseInt(parts[0], 10) || 0, parseInt(parts[1], 10) || 0, parseInt(parts[2], 10) || 0];
    }
    return null;
  }

  function mix(from, to, t) {
    return 'rgb('
      + Math.round(from[0] + (to[0] - from[0]) * t) + ','
      + Math.round(from[1] + (to[1] - from[1]) * t) + ','
      + Math.round(from[2] + (to[2] - from[2]) * t) + ')';
  }

  /* ---------- the column ---------- */

  /* The column's geometry.
     On a wide screen the column is a fixed box and the bars divide its height.
     Where the stylesheet says how many bars there are (--bars), the box is the bars
     instead: they keep their own height and the column becomes as tall as the count
     needs. Negative means one bar per item, no fillers — the navbar — and the count
     follows the list, so adding an item is adding an item.

     The division is done in whole pixels, and the remainder is handed out one pixel
     at a time to the first bars. Fractional heights are what used to leave a
     hairline of paper between two bars at some window sizes: two edges that should
     touch landing on either side of a device pixel. */
  function column() {
    var fixed = Math.round(css('--bars', 0));

    if (fixed < 0) return { count: ITEMS.length, base: css('--line', 44), extra: 0 };
    if (fixed > 0) return { count: fixed, base: css('--line', 44), extra: 0 };

    var height = Math.floor(aside.getBoundingClientRect().height || line);
    var count = Math.max(ITEMS.length, Math.round(height / line));
    var base = Math.floor(height / count);

    return { count: count, base: base, extra: height - base * count };
  }

  function build() {
    var c = column();
    var first = Math.max(0, Math.round((c.count - ITEMS.length) / 2));

    /* How long the arrival has been running, when one is running at all: a rebuild
       under it has to carry on, not start over (see the delays below). */
    var behind = arriving ? Date.now() - started : 0;

    /* The mark goes first because it carries no delay of its own and the first bar
       waits --delay for it. On a rebuild mid-arrival its delay is shifted like the
       bars' are, so the two stay in step. */
    if (mark) mark.style.animationDelay = (behind ? -behind : 0) + 'ms';

    /* Clear the old stack — the mark is page content and stays. */
    for (var i = bars.length - 1; i >= 0; i--) {
      aside.removeChild(bars[i].el);
    }
    bars = [];
    last = 0;

    for (var index = 0; index < c.count; index++) {
      var item = ITEMS[index - first];
      var el;

      if (item) {
        el = document.createElement('a');
        el.className = 'bar item';

        if (typeof item.target === 'function') {
          el.href = '#';
          el.addEventListener('click', (function (action) {
            return function (event) {
              event.preventDefault();
              leave(action);
            };
          })(item.target));
        } else {
          el.href = item.target || '#';
          /* Only a link that changes the page wipes the piece out first: the
             drawing is what leaves. A same-page anchor does not wipe — the
             drawing is not going anywhere. */
          if (item.target && item.target.charAt(0) !== '#') {
            el.addEventListener('click', (function (href) {
              return function (event) {
                event.preventDefault();
                leave(function () { window.location.href = href; });
              };
            })(item.target));
          }
        }

        var label = document.createElement('span');
        label.className = 'label';
        label.textContent = item.title;
        el.appendChild(label);
      } else {
        /* A bar with no item: it is column only. Nobody points at it, nobody
           reads it. */
        el = document.createElement('div');
        el.className = 'bar';
        el.setAttribute('aria-hidden', 'true');
      }

      /* When the arrival is already under way — a resize caught it mid-flight — the
         delay comes back shifted by how long it has been running: a negative delay
         is an animation that starts in the middle of itself, so the new bars carry
         on falling instead of jumping back to the top and landing twice. */
      var delay = delayStep + index * perLine - behind;
      if (delay > last) last = delay;
      /* Whole pixels, and the remainder spent one pixel at a time: the stack adds
         up to the column exactly, with no fractional edge anywhere in it. */
      el.style.height = (c.base + (index < c.extra ? 1 : 0)) + 'px';
      el.style.animationDelay = delay + 'ms';
      el.style.animationDuration = flight + 'ms';
      /* Where it stands in the sequence. The column ignores it; the navbar uses it
         for the staircase, and the size of the step is the stylesheet's business. */
      el.style.setProperty('--i', index);
      aside.appendChild(el);

      bars.push({
        el: el,
        item: !!item,
        stretch: item && item.stretch ? item.stretch : null,
        near: 0,
        over: 0,
        temp: 0,
        x: 0, y: 0, w: 0, h: 0
      });
    }

    /* How tall the navbar is, is decided by the layout — one row of bars, however
       many that turns out to be — so it is measured rather than calculated, and
       published for the page to keep its room (base.css). Measuring instead of
       counting is also what makes this survive a change of direction: the answer is
       whatever the row actually is. */
    if (Math.round(css('--bars', 0)) < 0) {
      document.documentElement.style.setProperty(
        '--bar-h', aside.getBoundingClientRect().height + 'px'
      );
    }
  }

  /* Put every bar back at rest — no written width, no background, no transform —
     so its real resting place can be measured. The pointer is measured against
     those boxes, so the stretch never feeds its own measurement. */
  function rest() {
    for (var i = 0; i < bars.length; i++) {
      bars[i].el.style.width = '';
      bars[i].el.style.transform = '';
      bars[i].el.style.backgroundColor = '';
      bars[i].near = 0;
      bars[i].over = 0;
      bars[i].temp = 0;
    }
  }

  function boxes() {
    /* Everything here is measured on the LAYOUT, never on the painted box.
       offsetTop, offsetLeft, offsetWidth and offsetHeight are layout numbers, and no
       animation touches them. getBoundingClientRect is the painted box, and during
       the arrival these elements ARE being animated: a bar measured mid-flight came
       back where the animation had put it rather than where it stands — a screen
       above, since a fresh bar takes the keyframe's -100vh fallback until its offset
       is written — and a start worked out from that measurement turns the drop into
       a rise.

       The aside is the frame everything is measured against: it is fixed and never
       transformed, so its own rect is the layout's origin. The bars are positioned,
       and the mark's ancestor is the aside, so for both of them the aside is the
       offsetParent and these offsets are its own. */
    var frame = aside.getBoundingClientRect();

    /* The mark first: it arrives like the bars, so it needs the same starts.
       Both axes are measured and written; which one is used is the layout's
       business (see the arrivals in aside.css). */
    if (mark) {
      var mx = frame.left + mark.offsetLeft;
      var my = frame.top + mark.offsetTop;
      mark.style.setProperty('--from-x', (-(mx + mark.offsetWidth) - OFF) + 'px');
      mark.style.setProperty('--from-y', (-(my + mark.offsetHeight) - OFF) + 'px');
    }

    for (var i = 0; i < bars.length; i++) {
      var bar = bars[i];
      var x = frame.left + bar.el.offsetLeft;
      var y = frame.top + bar.el.offsetTop;
      var w = bar.el.offsetWidth;
      var h = bar.el.offsetHeight;
      bar.x = x;
      bar.y = y;
      bar.w = w;
      bar.h = h;

      /* Where the bar comes from: far enough to be entirely off-screen, on the
         left for the column and above for the navbar, plus a little so it never
         touches an edge. */
      bar.el.style.setProperty('--from-x', (-(x + w) - OFF) + 'px');
      bar.el.style.setProperty('--from-y', (-(y + h) - OFF) + 'px');
    }
  }

  /* ---------- the arrival ---------- */

  function enter() {
    if (entered) return;
    entered = true;
    arriving = true;
    started = Date.now();

    aside.classList.add('ready', 'arriving');

    /* Once the arrival is over the class goes away: nothing stays animated or
       composited after the column is closed. The end state is the bars' own. */
    setTimeout(function () {
      aside.classList.remove('arriving');
      if (mark) mark.style.animationDelay = '';
      for (var i = 0; i < bars.length; i++) {
        bars[i].el.style.animationDelay = '';
        bars[i].el.style.animationDuration = '';
      }
      arriving = false;
      rest();
      boxes();
      if (pointer.on) wake();
    }, reduced.matches ? 0 : last + flight + 80);
  }

  /* Leaving the page. The piece wipes out first and the page goes after it. If
     the piece is not there to be asked — or is busy mid-sweep — the navigation
     does not wait for it forever. */
  function leave(then) {
    var done = false;
    function go() {
      if (done) return;
      done = true;
      then();
    }
    var mask = window.MASK;
    if (!mask || !mask.out) { go(); return; }
    mask.out(go);
    setTimeout(go, 2600);
  }

  /* To watch it as many times as you like: tear the column down and enter. */
  function out() {
    entered = false;
    arriving = false;
    aside.classList.remove('ready', 'arriving');
    build();
    rest();
    boxes();
  }

  function replay() {
    out();
    requestAnimationFrame(enter);
  }

  /* ---------- the first time ---------- */

  /* Whether the piece gets to go first on this visit.

     The column waits for the drawing to land: that is the opening, and an opening
     is only an opening once. On every visit after it, a navigation held back for
     seconds while a drawing the visitor has already seen finishes its sweep does
     not read as care — it reads as a page that is slow.

     So the wait is spent. It happens on the visit that has not had it, it is written
     down, and it comes back a day later. The day is not a promise about the visitor:
     it is how often the piece is allowed to make the page wait at all.

     Storage can be refused, and private windows do refuse it. Without it every visit
     is a first visit — the safe way round, since the worst case is the opening
     playing again. */
  var SPENT = 'hdalp.abertura';
  var DAY = 24 * 60 * 60 * 1000;

  function firstVisit() {
    var spent = 0;
    try { spent = Number(localStorage.getItem(SPENT)) || 0; } catch (e) { spent = 0; }
    if (spent && Date.now() - spent < DAY) return false;
    try { localStorage.setItem(SPENT, String(Date.now())); } catch (e) { /* then it will simply come back */ }
    return true;
  }

  /* ---------- the pointer ---------- */

  /* True when the pointer is outside the page. Browsers do not promise a
     pointerleave when the mouse leaves fast, when the window loses focus, or
     when the leave happens over one of our own bars — and a pointer that is never
     released leaves bars stretched for good. So the geometry has the last word:
     whatever the events said, if it is not over the page it is not near
     anything. */
  function away() {
    return pointer.x < 0 || pointer.y < 0
        || pointer.x > window.innerWidth || pointer.y > window.innerHeight;
  }

  /* Distance from the pointer to the bar's box: 0 inside it. */
  function distance(bar) {
    var dx = pointer.x < bar.x ? bar.x - pointer.x
           : (pointer.x > bar.x + bar.w ? pointer.x - (bar.x + bar.w) : 0);
    var dy = pointer.y < bar.y ? bar.y - pointer.y
           : (pointer.y > bar.y + bar.h ? pointer.y - (bar.y + bar.h) : 0);
    return Math.sqrt(dx * dx + dy * dy);
  }

  function step() {
    raf = 0;
    var moved = 0;

    if (pointer.on && away()) pointer.on = false;

    for (var i = 0; i < bars.length; i++) {
      var bar = bars[i];
      var toNear = 0;
      var toOver = 0;

      if (pointer.on) {
        var d = distance(bar);
        if (d < reach) {
          var t = 1 - d / reach;
          toNear = t * t * (3 - 2 * t);
        }
        if (bar.item && d === 0) toOver = 1;
      }

      var near = bar.near + (toNear - bar.near) * ease;
      var over = bar.over + (toOver - bar.over) * ease;
      /* The colour runs on its own clock, and a slow one: it is what makes the
         highlight stay on the bar after the pointer has moved past it. */
      var temp = bar.temp + (toNear - bar.temp) * coolEase;
      if (Math.abs(toNear - near) < 0.002) near = toNear;
      if (Math.abs(toOver - over) < 0.002) over = toOver;
      if (Math.abs(toNear - temp) < 0.004) temp = toNear;

      if (near !== bar.near || over !== bar.over || temp !== bar.temp) {
        var coolMoved = temp !== bar.temp;
        var shapeMoved = near !== bar.near || over !== bar.over;
        bar.near = near;
        bar.over = over;
        bar.temp = temp;

        /* The stretch is a width, never a scale: the label lives inside the bar
           and must not stretch with it. An empty bar answers for a fraction of
           it — it is column, not item. And the hover is more width, not a slide:
           sliding would open a paper gap against the edge of the column, and the
           bar would look cut short. */
        if (shapeMoved) {
          var limit = bar.item ? (bar.stretch || stretch) : stretch * empty;
          var grow = limit * near + (bar.item ? over * hover : 0);
          bar.el.style.width = (bar.w + grow).toFixed(2) + 'px';
        }

        /* The colour follows the distance only — not the weight — so the cooling
           reads as one gradient across the column instead of patchy rows. */
        if (coolMoved) {
          bar.el.style.backgroundColor = temp ? mix(ink, cool, temp) : '';
        }

        moved++;
      }
    }

    var movedPointer = pointer.x !== previous.x || pointer.y !== previous.y;
    previous.x = pointer.x;
    previous.y = pointer.y;

    if (moved || (pointer.on && movedPointer)) raf = requestAnimationFrame(step);
  }

  function wake() {
    if (!raf) raf = requestAnimationFrame(step);
  }

  /* Every way the pointer can stop being over the page. */
  function release() {
    if (!pointer.on) return;
    pointer.on = false;
    wake();
  }

  /* ---------- wiring ---------- */

  read();
  build();
  rest();
  boxes();

  /* The visit, asked once, and both the piece and the column take their cue from the
     same answer.

     The piece: a visit that has already seen the drawing does not need it at full
     length, so it is handed half a clock. --mask-pace is written on the root here,
     while the page is still being parsed, and the piece reads it when it starts —
     which is always later, because the piece waits for its raw to be fetched. */
  var first = firstVisit();
  if (!first) document.documentElement.style.setProperty('--mask-pace', '0.5');

  /* And the column: it waits for the piece to land on a first visit, and skips the
     wait entirely on every visit after it. The navbar never waits — on a phone the
     row is the first thing the page shows, so it lands with the page. */
  if (Math.round(css('--bars', 0)) < 0 || !first) enter();

  /* The piece announces each sweep it lands. The column arrives when the drawing
     has arrived ('in') — and equally if it ever steps back first ('faded', the
     watermark, or 'out', wiping away), so the navigation never waits on a state
     the drawing may not reach. */
  document.addEventListener('mask:landed', function (event) {
    var kind = event.detail && event.detail.kind;
    if (kind === 'in' || kind === 'faded' || kind === 'out') enter();
  });
  setTimeout(enter, MAX_WAIT);

  window.addEventListener('pointermove', function (event) {
    if (!entered || arriving) return;
    pointer.on = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    wake();
  }, { passive: true });

  window.addEventListener('pointerleave', release);
  window.addEventListener('pointerout', function (event) {
    /* A pointerout with no relatedTarget is the window itself being left. */
    if (!event.relatedTarget) release();
  }, true);
  document.addEventListener('mouseleave', release);
  window.addEventListener('blur', release);
  window.addEventListener('pageshow', release);

  /* A lifted finger leaves no pointerleave behind either. A mouse is left alone:
     it is still there. */
  window.addEventListener('pointerup', function (event) {
    if (event.pointerType !== 'touch') return;
    release();
  });
  window.addEventListener('pointercancel', release);

  var pending = 0;
  window.addEventListener('resize', function () {
    if (pending) return;
    pending = requestAnimationFrame(function () {
      pending = 0;
      /* The layout changed, and a media query may have changed every number with
         it: read again, then rebuild. */
      read();
      build();
      rest();
      boxes();
      if (pointer.on) wake();
    });
  });

  window.ASIDE = { enter: enter, out: out, replay: replay, bars: bars };
})();

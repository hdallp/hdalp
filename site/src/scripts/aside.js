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
   (or to wipe out, if that ever comes first).

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
    { title: 'início',    target: './' },
    { title: 'portfolio', target: './portfolio/' },
    { title: 'sobre',     target: '#sobre' },
    { title: 'contato',   target: '#contato' }
  ];

  /* The build. DELAY is how far the mark goes ahead, PER_LINE is the gap between
     one bar and the next — that is what makes the column rise line by line —
     FLIGHT is how long one bar takes to arrive, and OFF is how far past the
     screen edge it starts so it really is out of sight. */
  var DELAY = 240;
  var PER_LINE = 45;
  var FLIGHT = 620;
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
  var ink = [7, 7, 7], cool = [47, 107, 255];
  var last = 0;
  var entered = false;
  var arriving = false;

  var pointer = { x: -1e9, y: -1e9, on: false };
  var previous = { x: -1e9, y: -1e9 };
  var raf = 0;

  /* ---------- the numbers ---------- */

  /* Every measurement comes from the CSS, as custom properties: one place to
     tune. The two colours are read once, as rgb, because the gradient has to be
     recomputed every frame and parsing two hex strings here is cheaper than
     asking the browser to resolve a colour per bar per frame. */
  function read() {
    var cs = getComputedStyle(aside);

    function n(name, fallback) {
      var v = parseFloat(cs.getPropertyValue(name));
      return isFinite(v) ? v : fallback;
    }

    line = n('--line', 44);
    stretch = n('--stretch', 56);
    empty = n('--empty', 0.4);
    hover = n('--hover', 12);
    reach = n('--reach', 90);
    ease = n('--ease', 0.2);
    coolEase = n('--cool-ease', 0.03);

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

  /* How many bars fit, and how tall each one is — the remainder is spread over
     all of them so the stack closes at exactly the column's height. */
  function column() {
    var height = aside.getBoundingClientRect().height || line;
    var count = Math.max(ITEMS.length, Math.round(height / line));
    return { count: count, height: height / count };
  }

  function build() {
    var c = column();
    var first = Math.max(0, Math.round((c.count - ITEMS.length) / 2));

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

      var delay = DELAY + index * PER_LINE;
      if (delay > last) last = delay;
      el.style.height = c.height + 'px';
      el.style.animationDelay = delay + 'ms';
      el.style.animationDuration = FLIGHT + 'ms';
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
    /* The mark first: it arrives like the bars, so it needs the same start. */
    if (mark) {
      var m = mark.getBoundingClientRect();
      mark.style.setProperty('--from', (-(m.left + m.width) - OFF) + 'px');
    }

    for (var i = 0; i < bars.length; i++) {
      var bar = bars[i];
      var r = bar.el.getBoundingClientRect();
      bar.x = r.left;
      bar.y = r.top;
      bar.w = r.width;
      bar.h = r.height;

      /* Where the bar comes from: far enough to be entirely off-screen on the
         left, plus a little, so it never touches the edge. */
      bar.el.style.setProperty('--from', (-(r.left + r.width) - OFF) + 'px');
    }
  }

  /* ---------- the arrival ---------- */

  function enter() {
    if (entered) return;
    entered = true;
    arriving = true;

    aside.classList.add('ready', 'arriving');

    /* Once the arrival is over the class goes away: nothing stays animated or
       composited after the column is closed. The end state is the bars' own. */
    setTimeout(function () {
      aside.classList.remove('arriving');
      for (var i = 0; i < bars.length; i++) {
        bars[i].el.style.animationDelay = '';
        bars[i].el.style.animationDuration = '';
      }
      arriving = false;
      rest();
      boxes();
      if (pointer.on) wake();
    }, reduced.matches ? 0 : last + FLIGHT + 80);
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
      /* The height changed: the column needs a different number of bars. */
      build();
      rest();
      boxes();
      if (pointer.on) wake();
    });
  });

  window.ASIDE = { enter: enter, out: out, replay: replay, bars: bars };
})();

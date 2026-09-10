/* cursor — the pointer, drawn by hand.

   Ported from the Evoluttus presentation cursor, with the things that made it
   expensive fixed. What it does not do any more, and why:

     - it never moves with left/top. That was the original's way, and it makes the
       browser lay the page out again 60 times a second. Here the movement is a
       single transform: translate3d().
     - it never grows its own box. The element is one fixed 58px box and every
       state — blob, seal, rest — is a transform inside it. A box that resized
       would re-rasterise its layer on every hover, and the seal would arrive as a
       redraw instead of as a scale.
     - it has no backdrop-filter. Blurring the backdrop under a thing that is
       moving on every frame is the one genuinely expensive property here, and over
       flat paper it changes almost nothing. If the frosted look is wanted back,
       put `backdrop-filter: blur(2px)` on `.cursor::before` — and know what it
       costs.
     - it does not ask the DOM where the pointer is. The hover test comes from
       pointerover and closest(), never from elementFromPoint(), which forces a
       layout flush per move.
     - it does not keep a rAF alive when there is nothing to do: the loop stops as
       soon as the shape has settled, and the pointer being off the page cancels it
       outright.

   The shape is a spring, so it trails and can overshoot, and it skews with speed.
   Over anything clickable it becomes the seal of a link — the scalloped disc in
   site/assets/cursor/seal.svg, with an arrow through it — and while it is a seal it
   stays upright: no skew, and the angle eases back to zero.

   On a touch screen none of this runs and the native pointer stays. */
(function () {
  'use strict';

  /* Nothing of this belongs inside someone else's frame. */
  if (window.self !== window.top) return;

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------- the numbers ---------- */

  var SPRING = 0.12;      // pull towards the pointer: higher follows harder
  var DAMPING = 0.45;     // 1 is no overshoot; lower bounces more
  var SKEW_AT = 1.8;      // speed (px a frame) where the shape starts to stretch
  var SKEW = 0.055;       // how much it stretches
  var SKEW_MAX = 1.3;     // the most it stretches
  var SQUASH = 0.2;       // the most it flattens sideways
  var RETURN = 0.2;       // how fast it comes back to a circle
  var IDLE = 2000;        // ms without movement before it shrinks
  var IDLE_STEP = 200;    // the idle clock is only restarted this often

  /* Under reduced motion there is no spring and no skew: the shape is simply
     where the pointer is. */
  if (reduced.matches) {
    SPRING = 1;
    DAMPING = 0;
    SKEW = 0;
  }

  /* ---------- state ---------- */

  var at = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
  var shape = { x: at.x, y: at.y, vx: 0, vy: 0, angle: 0, sx: 1, sy: 1 };
  var shown = false;
  var over = false;       // the shape is a seal while this is true
  var raf = 0;
  var idleTimer = 0;
  var idleAt = 0;

  var el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);

  /* ---------- where it is ---------- */

  /* Position and shape in one transform, and nothing else. The centring is a
     `translate` in the CSS — a separate property, so it composes with this
     instead of fighting it. */
  function place() {
    var t = 'translate3d(' + shape.x.toFixed(2) + 'px, ' + shape.y.toFixed(2) + 'px, 0)';

    /* Nothing to turn or stretch: the transform stays as short as the work is. */
    if (shape.angle || shape.sx !== 1 || shape.sy !== 1) {
      t += ' rotate(' + shape.angle.toFixed(4) + 'rad)'
         + ' scale(' + shape.sx.toFixed(3) + ', ' + shape.sy.toFixed(3) + ')';
    }

    el.style.transform = t;
  }

  /* Nothing left to move: the loop can stop until the pointer moves again. */
  function settled() {
    return Math.abs(at.x - shape.x) < 0.05
        && Math.abs(at.y - shape.y) < 0.05
        && Math.abs(shape.vx) < 0.05
        && Math.abs(shape.vy) < 0.05
        && Math.abs(shape.sx - 1) < 0.005
        && Math.abs(shape.sy - 1) < 0.005
        && (!over || Math.abs(shape.angle) < 0.01);
  }

  function tick() {
    raf = 0;

    shape.vx = shape.vx * DAMPING + (at.x - shape.x) * SPRING;
    shape.vy = shape.vy * DAMPING + (at.y - shape.y) * SPRING;
    shape.x += shape.vx;
    shape.y += shape.vy;

    var speed = Math.sqrt(shape.vx * shape.vx + shape.vy * shape.vy);

    var toX = 1;
    var toY = 1;

    /* No stretching while it is a seal: a stamp that smears is a smudge. */
    if (SKEW > 0 && speed > SKEW_AT && !over) {
      /* It stretches along the direction it is going, and flattens across it. */
      shape.angle = Math.atan2(shape.vy, shape.vx);
      var stretch = Math.min(SKEW_MAX - 1, speed * SKEW);
      toX = 1 + stretch;
      toY = Math.max(SQUASH, 1 - stretch * 0.6);
    }

    shape.sx += (toX - shape.sx) * RETURN;
    shape.sy += (toY - shape.sy) * RETURN;

    /* A seal always upright: multiplying by a fraction walks the angle back to
       zero the short way, without spinning around. */
    if (over) shape.angle *= 0.8;

    place();

    if (!settled()) raf = requestAnimationFrame(tick);
  }

  function wake() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  /* ---------- the pointer ---------- */

  var CLICKABLE = 'a, button, [role="button"], input, textarea, select, label, summary';

  document.addEventListener('pointermove', function (event) {
    if (event.pointerType === 'touch') return;

    at.x = event.clientX;
    at.y = event.clientY;

    if (!shown) {
      shown = true;
      el.classList.add('ready');
    }

    /* A mouse can report a thousand moves a second; a two-second clock does not
       need to be restarted that often. */
    var now = event.timeStamp;
    if (idleTimer && now - idleAt < IDLE_STEP) {
      wake();
      return;
    }
    idleAt = now;
    clearTimeout(idleTimer);
    el.classList.remove('idle');
    idleTimer = setTimeout(function () {
      idleTimer = 0;
      el.classList.add('idle');
    }, IDLE);

    wake();
  }, { passive: true });

  /* The hover test comes from the events, never from elementFromPoint(). */
  document.addEventListener('pointerover', function (event) {
    var target = event.target;
    var clickable = !!(target && target.closest && target.closest(CLICKABLE));
    if (clickable === over) return;
    over = clickable;
    el.classList.toggle('hover', over);
  }, { passive: true });

  /* The pointer is not over the page any more, so neither is this: it goes, the
     clock stops, and the spring is dropped where it stands — nobody can see it
     land. */
  function hide() {
    shown = false;
    el.classList.remove('ready', 'idle');
    clearTimeout(idleTimer);
    idleTimer = 0;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
    shape.x = at.x;
    shape.y = at.y;
    shape.vx = 0;
    shape.vy = 0;
  }

  window.addEventListener('pointerleave', hide);
  document.addEventListener('mouseleave', hide);
  window.addEventListener('blur', hide);
})();

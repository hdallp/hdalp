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

   The blob's silhouette is not a circle while the page is moving: its sides carry
   a shallow wave, and the wave is read straight from the scroll position — one
   pixel of scroll, one pixel of pattern, no easing in between — so the roughness is
   printed on the page and travels with the content. It appears with the scroll and
   goes when the page stops. That path is built in screen space and the element is
   only translated, so the roughness always faces left and right: speed can tilt the
   body, never the wave.

   The shape is a spring, so it trails and can overshoot, and it skews with speed.
   Over anything clickable it becomes the seal — the scalloped disc in
   site/assets/cursor/seal.svg — and the seal answers the question the pointer is
   asking: the arrow for a link, which goes somewhere, and a chevron for something
   that opens, pointing the way it will move and turned round once it is open. As a
   seal it stops skewing and stops spinning with the direction of travel, and instead
   leans: it tips a few degrees with the vertical move, down one way and up the
   other, and rights itself when the pointer stops.

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
  var TILT = 3;           // degrees of lean per px a frame of vertical movement
  var TILT_MAX = 16;      // the most the seal leans, either way
  var WAVE = 1.25;        // how deep the silhouette's sides are shaped, in px
  var PERIOD = 9;         // px of height per undulation along the side
  var CRAWL = 0.08;       // how far the pattern travels per pixel of scroll.
                          // It is a fraction of the page's own movement, never a
                          // speed: the texture has no clock, so it reverses the
                          // instant the page reverses
  var POINTS = 48;        // how round the silhouette is
  var IDLE = 2000;        // ms without movement before it shrinks
  var IDLE_STEP = 200;    // the idle clock is only restarted this often
  var IDLE_SCROLL = 3200; // and longer than that when it was the page that moved
  var ROUGH_HOLD = 180;   // ms after the last scroll before the roughness fades
  var ROUGH_EASE = 0.12;  // how fast it appears and disappears

  /* Under reduced motion there is no spring and no skew: the shape is simply
     where the pointer is. */
  if (reduced.matches) {
    SPRING = 1;
    DAMPING = 0;
    SKEW = 0;
    TILT = 0;
    CRAWL = 0;            // the silhouette keeps its shape but stops crawling
  }

  /* ---------- state ---------- */

  var at = { x: window.innerWidth / 2, y: window.innerHeight / 2, crawl: 0, rough: 0 };
  var shape = { x: at.x, y: at.y, vx: 0, vy: 0, angle: 0, sx: 1, sy: 1, crawl: 0, rough: 0 };
  var lastScroll = -1e9;
  var shown = false;
  var over = false;       // the shape is a seal while this is true
  var raf = 0;
  var idleTimer = 0;
  var idleAt = 0;

  var el = document.createElement('div');
  el.className = 'cursor';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);

  /* ---------- the silhouette ---------- */

  /* The body is 30px across, drawn inside a 40px box so the stretch has room.
     Each point of the perimeter is precomputed as a SCREEN direction — not a
     direction inside the element — and with it the weight the wave is allowed:
     the square of the horizontal direction, so the shaping is full on the sides and
     fades to nothing at the top and the bottom.

     That distinction is the whole point of this version. The outline is built in
     screen space and the element itself is only ever translated, so nothing about
     the movement can turn the roughness away from the sides: speed still tilts the
     body, but the wave stays where it belongs. */
  var SIDE = 15;    // the body's radius
  var BOX = 40;     // the box the path is written into
  var RING = [];
  for (var r = 0; r < POINTS; r++) {
    var a = (r / POINTS) * Math.PI * 2;
    var cos = Math.cos(a);
    RING.push({ c: cos, s: Math.sin(a), w: cos * cos });
  }

  /* The body as a stretched ellipse turned to the direction of travel, plus the
     wave on top of it, all in screen coordinates. The two radii are pulled back by
     the wave's own depth so a crest never reaches past the box. */
  function outline() {
    var mid = BOX / 2;
    /* The roughness has its own amplitude: at rest it is zero and the body is a
       plain ellipse. It is the scroll that gives it depth, and it takes it back
       when the page stops. */
    var amp = WAVE * shape.rough;
    var rx = (SIDE - amp) * shape.sx;
    var ry = (SIDE - amp) * shape.sy;
    var cr = Math.cos(shape.angle);
    var sr = Math.sin(shape.angle);
    var d = '';

    for (var i = 0; i < POINTS; i++) {
      var p = RING[i];

      /* cos and sin of this direction measured from the body's own axis */
      var e = p.c * cr + p.s * sr;
      var f = p.s * cr - p.c * sr;

      /* the radius of that ellipse in this direction */
      var body = (rx * ry) / Math.sqrt((ry * e) * (ry * e) + (rx * f) * (rx * f));

      var y = body * p.s;
      var wave = Math.sin(((y + shape.crawl) / PERIOD) * Math.PI * 2);
      var radius = body + p.w * amp * wave;

      d += (i ? 'L' : 'M') + (mid + p.c * radius).toFixed(2)
        + ' ' + (mid + p.s * radius).toFixed(2);
    }

    return 'path("' + d + 'Z")';
  }

  var drawn = '';

  /* Writing a path is the one thing here that is not free, so the shape is only
     rebuilt when one of the things that draws it has actually moved. */
  function silhouette() {
    var key = shape.crawl.toFixed(2) + '|' + shape.rough.toFixed(3)
      + '|' + shape.sx.toFixed(3) + '|' + shape.sy.toFixed(3)
      + '|' + shape.angle.toFixed(3);
    if (key === drawn) return;
    drawn = key;
    el.style.setProperty('--blob', outline());
  }

  /* Give it its silhouette before the pointer even moves. It is called here, after
     the ring is built, and not up beside the element: var hoists the name but not
     the array, and calling it early took the whole file down with it. */
  silhouette();

  /* ---------- where it is ---------- */

  /* Position, and only position. The stretch and the tilt are not transforms any
     more — they are drawn into the silhouette, in screen space — so nothing the
     pointer does can rotate the roughness off the sides. */
  function place() {
    el.style.transform = 'translate3d(' + shape.x.toFixed(2) + 'px, '
      + shape.y.toFixed(2) + 'px, 0)';
  }

  /* Nothing left to move: the loop can stop until the pointer moves again. */
  function settled() {
    return Math.abs(at.x - shape.x) < 0.05
        && Math.abs(at.y - shape.y) < 0.05
        && Math.abs(shape.vx) < 0.05
        && Math.abs(shape.vy) < 0.05
        && Math.abs(shape.sx - 1) < 0.005
        && Math.abs(shape.sy - 1) < 0.005
        && (!over || Math.abs(shape.angle) < 0.01)
        && Math.abs(at.crawl - shape.crawl) < 0.05
        && Math.abs(at.rough - shape.rough) < 0.005;
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

    /* And it leans. While the seal is up, the rotation that matters is not the
       direction of travel — it is this: it tips with the vertical move, down one
       way and up the other, and rights itself when the pointer stops, because it
       is read from the spring's own vertical speed. It is written as a custom
       property because it lands on the seal, which is a pseudo-element, and there
       is no other way in. */
    if (TILT && over) {
      var lean = shape.vy * TILT;
      if (lean > TILT_MAX) lean = TILT_MAX;
      else if (lean < -TILT_MAX) lean = -TILT_MAX;
      el.style.setProperty('--tilt', lean.toFixed(2) + 'deg');
    }

    /* The crawl is the scroll, with nothing in between: no easing, no catch-up,
       no clock of its own. That is what keeps it tied to the page's position rather
       than to the speed of the wheel: scroll down and it moves down, scroll up and
       it is already going up, stop and it is already stopped. An eased follow would
       carry the old direction for a moment after you turned around, which is exactly
       what reading a speed looks like.

       How FAR it travels per pixel is CRAWL, and that is only a gain.

       The amplitude is the one thing that still has a clock of its own: the
       roughness arrives with the scroll and goes when the page stops. */
    if (performance.now() - lastScroll > ROUGH_HOLD) at.rough = 0;
    shape.crawl = at.crawl;
    shape.rough += (at.rough - shape.rough) * ROUGH_EASE;

    silhouette();
    place();

    if (!settled()) raf = requestAnimationFrame(tick);
  }

  function wake() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  /* ---------- the pointer ---------- */

  /* The last one is this site's own: a folder's header is a click target that is not
     a control — no button, no role — and it is the one that says the most, because
     the seal over it carries the chevron. */
  var CLICKABLE = 'a, button, [role="button"], input, textarea, select, label, summary, .pasta-cabeca';

  /* Something happened: the pointer moved, or the page did. Either one postpones
     the moment the cursor shrinks. */
  function activity(wait) {
    clearTimeout(idleTimer);
    el.classList.remove('idle');
    idleTimer = setTimeout(function () {
      idleTimer = 0;
      el.classList.add('idle');
    }, wait);
  }

  document.addEventListener('pointermove', function (event) {
    if (event.pointerType === 'touch') return;

    at.x = event.clientX;
    at.y = event.clientY;

    if (!shown) {
      shown = true;

      /* It appears where the pointer already is. The spring's home is the middle of
         the page and the reveal happens on the same event that first moves the
         target, so without this the first thing anyone sees is the cursor flying in
         from the centre. Landing it on the hand first makes the reveal a plain
         circle under the pointer — and it is also what drops the stretch and the
         lean, which a return after a leave would otherwise show, because hide()
         stops the loop where it stands. */
      shape.x = at.x;
      shape.y = at.y;
      shape.vx = 0;
      shape.vy = 0;
      shape.sx = 1;
      shape.sy = 1;
      shape.angle = 0;
      place();
      silhouette();

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
    activity(IDLE);

    wake();
  }, { passive: true });

  /* ---------- what the seal carries ----------

     The arrow has always meant "this goes somewhere" and that is all it means now: a
     link is a link. Everything else that can be clicked says what it will do, in the
     middle of the same seal —

       fora   it goes somewhere
       abre   it opens, so the chevron points the way it will move
       fecha  it is open, so the chevron is turned round
       nothing  it is clickable and claims nothing

     — and the answer is read off the element under the pointer. Nothing is guessed: an
     element that announces whether it is open is asked directly, and a folder is asked
     the same question through the class its script keeps. */
  function mark(target) {
    if (!target || !target.closest) return '';

    if (target.closest('a[href]')) return 'fora';

    var owner = target.closest('[aria-expanded]') || target.closest('.pasta');
    if (owner) {
      var open = owner.hasAttribute('aria-expanded')
        ? owner.getAttribute('aria-expanded') === 'true'
        : owner.classList.contains('is-aberta');
      return open ? 'fecha' : 'abre';
    }

    return '';
  }

  var marked = '';

  /* Writing an attribute is a DOM write, so it happens only when the answer has
     actually changed — the same rule the silhouette follows. */
  function sign(target) {
    var want = over ? mark(target) : '';
    if (want === marked) return;
    marked = want;
    if (want) el.setAttribute('data-marca', want);
    else el.removeAttribute('data-marca');
  }

  /* The hover test comes from the events, never from elementFromPoint(). */
  document.addEventListener('pointerover', function (event) {
    var target = event.target;
    var clickable = !!(target && target.closest && target.closest(CLICKABLE));
    if (clickable !== over) {
      over = clickable;
      el.classList.toggle('hover', over);
    }
    /* The mark is read from whatever the pointer landed on even when that did not
       change the hover state: moving from one link to the next changes the question
       without changing the answer to "is something hovered". */
    sign(target);
  }, { passive: true });

  /* A thing can change what it is on a click — a folder opens, and its chevron has to
     turn round — and no pointer event is coming to say so. The listeners that know
     are on the elements, and a click reaches them before it reaches the document, so
     by the time this runs the new state is already written. */
  document.addEventListener('click', function (event) {
    sign(event.target);
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

  /* Scrolling is what makes the roughness exist at all: the wave is read from the
     scroll position, so it is the page moving under the pointer that shapes the
     cursor — and the page stopping that takes it back. */
  window.addEventListener('scroll', function () {
    at.crawl = window.scrollY * CRAWL;
    at.rough = 1;
    lastScroll = performance.now();

    /* A page in motion is not a page being ignored: scrolling postpones the
       shrink, and postpones it by more than a moving pointer does. */
    activity(IDLE_SCROLL);
    wake();
  }, { passive: true });

  window.addEventListener('pointerleave', hide);
  document.addEventListener('mouseleave', hide);
  window.addEventListener('blur', hide);
})();

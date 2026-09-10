/* smooth — the wheel, eased.

   A mouse wheel moves the page in notches, and nothing in CSS changes that:
   scroll-behavior only touches anchor jumps, and the rest is the browser's own idea
   of a scroll, which counts the notches. So this file takes the wheel over and
   eases the page towards where the wheel asked it to be — the page arrives a moment
   later, and the difference is the whole point.

   It gives up everything it does not need:

     touch        never touched. Those devices have momentum of their own and do it
                  better than this could.
     trackpads    a trackpad reports a stream of tiny deltas, not notches, and its
                  momentum is the good part. Those events are left alone — only a
                  real notch is worth easing.
     pinch        ctrl + wheel is zoom, and zoom is not ours.
     reduced      prefers-reduced-motion turns the whole file off.
     everything   keyboard, anchors, focus, the browser reopening where it was: if
     else         the page moves without us, we notice and believe the page instead
                  of our own numbers.

   And with no JavaScript, or if this file fails, the native scroll is still there.
   Nothing here is load-bearing. */
(function () {
  'use strict';

  if (window.self !== window.top) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var EASE = 0.11;    // how much of what is left each frame takes
  var LINE = 16;      // a wheel that counts lines instead of pixels
  var NOTCH = 12;     // below this a delta is a trackpad, not a wheel
  var DONE = 0.4;     // closer than this and the page is there

  var target = window.scrollY;
  var current = target;
  var wrote = target;   // the last position we asked for
  var raf = 0;

  function bottom() {
    return Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
  }

  function clamp(y) {
    var end = bottom();
    return y < 0 ? 0 : y > end ? end : y;
  }

  function tick() {
    raf = 0;

    current += (target - current) * EASE;
    if (Math.abs(target - current) < DONE) current = target;

    wrote = current;
    window.scrollTo(0, current);

    if (current !== target) raf = requestAnimationFrame(tick);
  }

  function wake() {
    if (!raf) raf = requestAnimationFrame(tick);
  }

  window.addEventListener('wheel', function (event) {
    if (event.ctrlKey || event.defaultPrevented) return;

    var delta = event.deltaY;
    if (event.deltaMode === 1) delta *= LINE;
    else if (event.deltaMode === 2) delta *= window.innerHeight;

    if (Math.abs(delta) < NOTCH) return;

    event.preventDefault();
    target = clamp(target + delta);
    current = clamp(current);
    wake();
  }, { passive: false });

  /* Whoever moved the page first wins. Our own writes are recognised by comparing
     the page with the last position we asked for — anything else is somebody else,
     and gets adopted as the new truth. */
  window.addEventListener('scroll', function () {
    var y = window.scrollY;
    if (Math.abs(y - wrote) <= 1.5) return;

    current = y;
    target = y;
    wrote = y;
    if (raf) {
      cancelAnimationFrame(raf);
      raf = 0;
    }
  }, { passive: true });

  var pending = 0;
  window.addEventListener('resize', function () {
    if (pending) return;
    pending = requestAnimationFrame(function () {
      pending = 0;
      current = target = wrote = clamp(window.scrollY);
    });
  });

  /* For anything that wants to scroll the page from elsewhere — a future menu, a
     "back to top". It eases like the wheel does. */
  window.SMOOTH = {
    to: function (y) {
      target = clamp(y);
      wake();
    },
    where: function () {
      return { current: current, target: target, bottom: bottom() };
    }
  };
})();

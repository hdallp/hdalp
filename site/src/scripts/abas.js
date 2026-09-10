/* abas — the portfolio's drawer.

   The shape is all in site/src/estilos/portfolio.css. What a shape cannot do is
   choose, so this file does the choosing: which tab is showing, and the body growing
   from the height it had to the height it now has.

   The panels are all in the page and none of them is hidden there, so a page that
   never runs this shows every category one after the other, read top to bottom.
   Nothing here is load-bearing. */
(function () {
  'use strict';

  var drawer = document.querySelector('.portfolio .abas');
  var body = document.querySelector('.portfolio .mestre-corpo');
  if (!drawer || !body) return;

  var tabs = [].slice.call(drawer.querySelectorAll('[role="tab"]'));
  if (!tabs.length) return;

  var panels = [];
  for (var i = 0; i < tabs.length; i++) {
    panels.push(document.getElementById(tabs[i].getAttribute('aria-controls')));
  }

  var still = window.matchMedia('(prefers-reduced-motion: reduce)');
  var letGo = 0;

  /* One reader for the stylesheet, so the clock this file waits on is the same clock
     the CSS transitions on. */
  function css(name, fallback) {
    var v = parseFloat(getComputedStyle(body).getPropertyValue(name));
    return isFinite(v) ? v : fallback;
  }

  /* Which one is showing.

     The body is told the height it had, then the panels change, then it is told the
     height it has: two numbers and the transition in the stylesheet between them.
     That is the whole animation — nothing is measured except to know where the
     growth starts. `silent` is the first call, which is not a change: the page is
     already showing all of them, and collapsing that is not an animation, it is a
     correction. */
  function show(index, focus, silent) {
    var before = silent ? 0 : body.getBoundingClientRect().height;

    for (var i = 0; i < tabs.length; i++) {
      var on = i === index;
      tabs[i].setAttribute('aria-selected', on ? 'true' : 'false');
      /* One tab is reachable with the tab key — the one that is showing. The arrow
         keys are how the rest are reached, which is what a tab list is. */
      tabs[i].tabIndex = on ? 0 : -1;
      if (panels[i]) panels[i].hidden = !on;
    }

    if (focus) tabs[index].focus();

    if (silent || still.matches) {
      body.style.height = '';
      return;
    }

    /* Ask for the height of the panel that has just arrived, then start from where
       the body was: the browser has to see both, one frame apart, or there is nothing
       to travel. */
    body.style.height = 'auto';
    var after = body.getBoundingClientRect().height;
    body.style.height = before + 'px';
    body.getBoundingClientRect();
    body.style.height = after + 'px';

    /* And the height is let go of once it has arrived, so the body is the page's
       again and not this file's. */
    clearTimeout(letGo);
    letGo = setTimeout(function () { body.style.height = ''; }, css('--abre', 320) + 80);
  }

  function wire(tab, index) {
    tab.addEventListener('click', function () { show(index, false); });
  }

  for (var j = 0; j < tabs.length; j++) wire(tabs[j], j);

  /* The keyboard: the arrows walk the tabs, Home and End go to the ends. A tab list
     that can only be clicked is a tab list half built. */
  drawer.addEventListener('keydown', function (event) {
    var at = tabs.indexOf(document.activeElement);
    if (at < 0) return;

    var to = -1;
    if (event.key === 'ArrowRight') to = at + 1;
    else if (event.key === 'ArrowLeft') to = at - 1;
    else if (event.key === 'Home') to = 0;
    else if (event.key === 'End') to = tabs.length - 1;
    else return;

    event.preventDefault();
    if (to < 0) to = tabs.length - 1;
    if (to >= tabs.length) to = 0;
    show(to, true);
  });

  show(0, false, true);
})();

/* pastas — the portfolio's folders, opened one at a time.

   The shape is all in site/src/estilos/portfolio.css; what the shape cannot do by
   itself is be a control. The header is already a button — it is what the mouse and
   the keyboard aim at — so what is missing is only the state: the class the pocket
   grows from, and the aria a screen reader reads it by.

   The folders are shut from the moment this file runs, and not one moment before:
   `.pastas` on the section is what the CSS hangs the shut state on, so a page that
   never runs this shows every folder open and readable. Nothing here is
   load-bearing.

   Several can be open at once. A portfolio read as a stack of tabs is not a
   instrument that should close one to open another — the next one you open is
   usually the one you are comparing it to. */
(function () {
  'use strict';

  var section = document.querySelector('.portfolio');
  if (!section) return;

  var pastas = section.querySelectorAll('.pasta');
  if (!pastas.length) return;

  section.classList.add('pastas');

  function wire(pasta, index) {
    var topo = pasta.querySelector('.pasta-topo');
    var corpo = pasta.querySelector('.pasta-corpo');
    if (!topo || !corpo) return;

    /* The pocket is what the button announces, so it needs a name to be
       announced by. The page does not have to write one: it is made here. */
    if (!corpo.id) corpo.id = 'pasta-' + (index + 1);
    topo.setAttribute('aria-controls', corpo.id);
    topo.setAttribute('aria-expanded', 'false');

    topo.addEventListener('click', function () {
      var open = pasta.classList.toggle('aberta');
      topo.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  for (var i = 0; i < pastas.length; i++) wire(pastas[i], i);
})();

/* abas — the portfolio's folders.

   Ported from the folder lab (folder-effect-lab/index.html). What a shape cannot do
   is decide, so this file decides: which folder is open, and the words on its handle.

   Folded is the stylesheet's default, so a page that never runs this shows the case
   and its title and nothing else. Nothing here is load-bearing.

   One thing the lab got wrong and this does not: there, the click to open was bound
   to the whole folder — so a click anywhere inside the open drawer closed it again,
   which made the contents unusable. Here the handles are the tab and the header, and
   the drawer's own contents are left alone.

   The pile is two deep, and that is the one thing to keep in mind here. The folder in
   front is the case and the four categories live inside it, so a plain search inside a
   folder finds THEIR parts, not its own: the case has no tab, and searching for one
   hands it the first category's. Both controls are therefore looked for where they
   belong — the tab among the folder's own children, the handle inside its own header. */
(function () {
  'use strict';

  var portfolio = document.querySelector('.portfolio');
  if (!portfolio) return;

  var ABRIR = 'abrir ↓';
  var FECHAR = 'fechar ✕';

  /* A folder's own tab, which is a child of the folder itself. Not a querySelector:
     the case wraps the four categories, so searching inside it finds THEIR tab — and
     the case would then answer to the first category's tab, opening and closing with
     it. The tab is always the folder's own child, so that is where it is looked for. */
  function tabOf(folder) {
    for (var i = 0; i < folder.children.length; i++) {
      if (folder.children[i].classList.contains('pasta-aba')) return folder.children[i];
    }
    return null;
  }

  var folders = [].slice.call(portfolio.querySelectorAll('.pasta')).map(function (folder) {
    /* The folder's own header: the first one inside it, which is the case for every
       folder, since a drawer only ever comes after it. */
    var head = folder.querySelector('.pasta-cabeca');
    return {
      el: folder,
      tab: tabOf(folder),
      head: head,
      /* And the handle is looked for inside that header, never inside the folder, for
         the same reason the tab is: the first handle down there is a category's. */
      handle: head ? head.querySelector('.pasta-alca') : null
    };
  }).filter(function (folder) {
    /* A folder this file can work is a folder with something that works it: a tab above
       it, a handle on it, or both. The case has only the handle. */
    return !!(folder.tab || folder.handle);
  });

  if (!folders.length) return;

  function define(folder, open) {
    folder.el.classList.toggle('is-aberta', open);
    if (folder.handle) folder.handle.textContent = open ? FECHAR : ABRIR;
    /* Whichever control the folder has says which state it is in. A button that does not
       announce what it does is a button that lies, and the case has no tab to announce
       for it. */
    [folder.tab, folder.handle].forEach(function (control) {
      if (control && control.tagName === 'BUTTON') {
        control.setAttribute('aria-expanded', open ? 'true' : 'false');
      }
    });
  }

  function toggle(folder) {
    define(folder, !folder.el.classList.contains('is-aberta'));
  }

  folders.forEach(function (folder) {
    /* The tab opens it. The case has none: its handle below is its whole control. */
    if (folder.tab) {
      folder.tab.addEventListener('click', function () {
        toggle(folder);
      });
    }

    /* And so does the header — which is what makes the whole bar feel like the
       handle. A control inside it is left out, because every control acts on its own:
       the handle below, and the cover's two buttons, which open and close the lot. */
    if (folder.head) {
      folder.head.addEventListener('click', function (event) {
        if (event.target.closest('a, button')) return;
        toggle(folder);
      });
    }

    /* Deliberately without stopPropagation: the click travels on, and the cursor is
       listening for it to turn its own mark around. */
    if (folder.handle) {
      folder.handle.addEventListener('click', function () {
        toggle(folder);
      });
    }

  });

  /* The first state: the case open, the four categories folded away inside it. */
  folders.forEach(function (folder, index) {
    define(folder, index === 0);
  });


  /* There are no buttons for this: the folders are opened one at a time, by hand. This
     is for a page that wants to open one from elsewhere, and for watching the thing
     work while it is being built. */
  window.PASTAS = {
    abrir: function () {
      folders.forEach(function (folder) { define(folder, true); });
    },
    fechar: function () {
      folders.forEach(function (folder) { define(folder, false); });
    },
    lista: folders
  };
})();

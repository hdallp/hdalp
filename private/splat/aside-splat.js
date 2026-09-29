/* aside-splat.js — barra de navegação dos splats com a mesma física e animação do site principal */

(function () {
  'use strict';

  var aside = document.getElementById('aside');
  if (!aside) return;

  var mark = aside.querySelector('.mark');
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)');

  var items = [];
  var bars = [];
  var line = 66, stretch = 84, empty = 0.4, hover = 18, reach = 135;
  var ease = 0.2, coolEase = 0.03;
  var delayStep = 240, perLine = 45, flight = 620;
  var ink = [7, 7, 7], cool = [0, 0, 136];
  var last = 0;
  var entered = false;
  var arriving = false;
  var started = 0;
  var activeId = null;

  var pointer = { x: -1e9, y: -1e9, on: false };
  var previous = { x: -1e9, y: -1e9 };
  var raf = 0;
  var OFF = 8;

  function css(name, fallback) {
    var v = parseFloat(getComputedStyle(aside).getPropertyValue(name));
    return isFinite(v) ? v : fallback;
  }

  function read() {
    var cs = getComputedStyle(aside);

    line = css('--line', 66);
    delayStep = css('--delay', 240);
    perLine = css('--per-line', 45);
    flight = css('--flight', 620);
    stretch = css('--stretch', 84);
    empty = css('--empty', 0.4);
    hover = css('--hover', 18);
    reach = css('--reach', 135);
    ease = css('--ease', 0.2);
    coolEase = css('--cool-ease', 0.03);

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

  function isMobile() {
    return window.matchMedia('(max-width: 900px)').matches;
  }

  function getEffectiveItems() {
    if (isMobile()) {
      return [{
        id: '__mobile_others__',
        title: 'Outros',
        isMobileOthers: true
      }];
    }
    return items;
  }

  function column() {
    var effective = getEffectiveItems();
    var fixed = Math.round(css('--bars', 0));
    if (fixed < 0) return { count: effective.length, base: css('--line', 66), extra: 0 };
    if (fixed > 0) return { count: fixed, base: css('--line', 66), extra: 0 };

    var height = Math.floor(aside.getBoundingClientRect().height || line);
    var count = Math.max(effective.length, Math.round(height / line));
    var base = Math.floor(height / count);

    return { count: count, base: base, extra: height - base * count };
  }

  function build() {
    var effective = getEffectiveItems();
    var c = column();
    var first = Math.max(0, Math.round((c.count - effective.length) / 2));
    var behind = arriving ? Date.now() - started : 0;

    if (mark) mark.style.animationDelay = (behind ? -behind : 0) + 'ms';

    for (var i = bars.length - 1; i >= 0; i--) {
      aside.removeChild(bars[i].el);
    }
    bars = [];
    last = 0;

    for (var index = 0; index < c.count; index++) {
      var item = effective[index - first];
      var el;

      if (item) {
        el = document.createElement('a');

        if (item.isMobileOthers) {
          el.className = 'bar item is-mobile-others';
          el.href = '#';
          el.addEventListener('click', function (event) {
            event.preventDefault();
            if (window.openMobileSplatsMenu) {
              window.openMobileSplatsMenu();
            }
          });

          var label = document.createElement('span');
          label.className = 'label';
          label.textContent = item.title;
          el.appendChild(label);
        } else {
          var isItemLocked = item.locked && !item.unlocked;
          el.className = 'bar item' + (item.id === activeId ? ' is-active' : '') + (isItemLocked ? ' is-locked' : '');
          el.href = '?model=' + encodeURIComponent(item.id);
          el.setAttribute('data-id', item.id);

          el.addEventListener('click', (function (splatItem) {
            return function (event) {
              event.preventDefault();
              if (window.selectSplat) {
                window.selectSplat(splatItem.id);
              }
            };
          })(item));

          var label = document.createElement('span');
          label.className = 'label';

          if (isItemLocked) {
            label.innerHTML = '<svg class="lock-icon" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg><span class="redacted-box" title="Arquivo bloqueado"></span>';
          } else {
            label.textContent = item.title;
          }

          el.appendChild(label);
        }
      } else {
        el = document.createElement('div');
        el.className = 'bar';
        el.setAttribute('aria-hidden', 'true');
      }

      var delay = delayStep + index * perLine - behind;
      if (delay > last) last = delay;

      el.style.height = (c.base + (index < c.extra ? 1 : 0)) + 'px';
      el.style.animationDelay = delay + 'ms';
      el.style.animationDuration = flight + 'ms';
      el.style.setProperty('--i', index);
      aside.appendChild(el);

      bars.push({
        el: el,
        item: !!item,
        id: item ? item.id : null,
        stretch: item && item.stretch ? item.stretch : null,
        near: 0,
        over: 0,
        temp: 0,
        x: 0, y: 0, w: 0, h: 0
      });
    }

    if (Math.round(css('--bars', 0)) < 0) {
      document.documentElement.style.setProperty(
        '--bar-h', aside.getBoundingClientRect().height + 'px'
      );
    }
  }

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
    var frame = aside.getBoundingClientRect();

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

      bar.el.style.setProperty('--from-x', (-(x + w) - OFF) + 'px');
      bar.el.style.setProperty('--from-y', (-(y + h) - OFF) + 'px');
    }
  }

  function enter() {
    if (entered) return;
    entered = true;
    arriving = true;
    started = Date.now();

    aside.classList.add('ready', 'arriving');

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

  function setActive(id) {
    activeId = id;
    for (var i = 0; i < bars.length; i++) {
      if (bars[i].item) {
        if (bars[i].id === id) {
          bars[i].el.classList.add('is-active');
        } else {
          bars[i].el.classList.remove('is-active');
        }
      }
    }
  }

  function setItems(newItems, currentActiveId) {
    items = newItems || [];
    if (currentActiveId) activeId = currentActiveId;
    read();
    build();
    rest();
    boxes();
  }

  function away() {
    return pointer.x < 0 || pointer.y < 0
        || pointer.x > window.innerWidth || pointer.y > window.innerHeight;
  }

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

        if (shapeMoved) {
          var limit = bar.item ? (bar.stretch || stretch) : stretch * empty;
          var grow = limit * near + (bar.item ? over * hover : 0);
          bar.el.style.width = (bar.w + grow).toFixed(2) + 'px';
        }

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

  function release() {
    if (!pointer.on) return;
    pointer.on = false;
    wake();
  }

  window.addEventListener('pointermove', function (event) {
    if (!entered || arriving) return;
    pointer.on = true;
    pointer.x = event.clientX;
    pointer.y = event.clientY;
    wake();
  }, { passive: true });

  window.addEventListener('pointerleave', release);
  window.addEventListener('pointerout', function (event) {
    if (!event.relatedTarget) release();
  }, true);
  document.addEventListener('mouseleave', release);
  window.addEventListener('blur', release);
  window.addEventListener('pageshow', release);

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
      read();
      build();
      rest();
      boxes();
      if (pointer.on) wake();
    });
  });

  function unlockItem(id, title) {
    for (var i = 0; i < items.length; i++) {
      if (items[i].id === id) {
        items[i].unlocked = true;
        break;
      }
    }
    for (var j = 0; j < bars.length; j++) {
      if (bars[j].id === id) {
        bars[j].el.classList.remove('is-locked');
        var label = bars[j].el.querySelector('.label');
        if (label) {
          label.textContent = title;
        }
      }
    }
  }

  window.SPLAT_ASIDE = {
    setItems: setItems,
    setActive: setActive,
    unlockItem: unlockItem,
    enter: enter
  };
})();

/* DEV Forge — interactions, accessibility and motion */
(function () {
  'use strict';

  var df = document.getElementById('df');
  if (!df) return;

  var themeButtons = df.querySelectorAll('[data-theme-set]');
  var themeMeta = document.querySelector('meta[name="theme-color"]');
  var themes = {
    light: { body: '#F2EBDD', meta: '#F2EBDD' },
    dark: { body: '#1D1D19', meta: '#1D1D19' }
  };

  function applyTheme(theme, persist) {
    theme = themes[theme] ? theme : 'light';
    df.setAttribute('data-theme', theme);
    document.body.style.backgroundColor = themes[theme].body;
    if (themeMeta) themeMeta.setAttribute('content', themes[theme].meta);
    Array.prototype.forEach.call(themeButtons, function (button) {
      button.setAttribute('aria-pressed',
        button.getAttribute('data-theme-set') === theme ? 'true' : 'false');
    });
    if (persist) {
      try { localStorage.setItem('devforge-theme', theme); } catch (error) {}
    }
  }

  var initialTheme = 'light';
  try {
    var storedTheme = localStorage.getItem('devforge-theme');
    if (storedTheme === 'light' || storedTheme === 'dark') initialTheme = storedTheme;
  } catch (error) {}
  applyTheme(initialTheme, false);

  Array.prototype.forEach.call(themeButtons, function (button) {
    button.addEventListener('click', function () {
      applyTheme(button.getAttribute('data-theme-set'), true);
    });
  });

  /* Mobile navigation closes after a destination is selected. */
  var menu = df.querySelector('.m-menu');
  if (menu) {
    menu.addEventListener('click', function (event) {
      if (event.target.closest && event.target.closest('.m-panel a')) {
        menu.removeAttribute('open');
      }
    });
    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && menu.hasAttribute('open')) {
        menu.removeAttribute('open');
        var summary = menu.querySelector('summary');
        if (summary) summary.focus();
      }
    });
  }

  /* Reading progress is throttled to one update per animation frame. */
  var progress = document.querySelector('#readingProgress span');
  var ticking = false;
  function updateProgress() {
    if (!progress) return;
    var doc = document.documentElement;
    var max = doc.scrollHeight - window.innerHeight;
    var value = max > 0 ? (window.scrollY / max) * 100 : 0;
    progress.style.width = Math.max(0, Math.min(100, value)) + '%';
    ticking = false;
  }
  window.addEventListener('scroll', function () {
    if (!ticking) {
      window.requestAnimationFrame(updateProgress);
      ticking = true;
    }
  }, { passive: true });
  window.addEventListener('resize', updateProgress, { passive: true });
  updateProgress();

  /* Keep the footer year current without changing the publication's edition. */
  var year = document.getElementById('currentYear');
  if (year) year.textContent = String(new Date().getFullYear());

  /* Highlight the current chapter in the desktop navigation. */
  var navLinks = Array.prototype.slice.call(df.querySelectorAll('.nav-links a[href^="#"]'));
  var sections = navLinks.map(function (link) {
    return document.querySelector(link.getAttribute('href'));
  }).filter(Boolean);

  if ('IntersectionObserver' in window && sections.length) {
    var observer = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        navLinks.forEach(function (link) {
          if (link.getAttribute('href') === '#' + entry.target.id) {
            link.setAttribute('aria-current', 'location');
          } else {
            link.removeAttribute('aria-current');
          }
        });
      });
    }, { rootMargin: '-25% 0px -65% 0px', threshold: 0 });
    sections.forEach(function (section) { observer.observe(section); });
  }

  /* Interactive SVG compass: drag the hinge with mouse or touch. */
  var compass = document.getElementById('compassRotor');
  var compassHandle = document.getElementById('compassHandle');
  var compassSvg = compass && compass.ownerSVGElement;
  if (compass && compassHandle && compassSvg) {
    var compassAngle = 0;
    var pivot = { x: 217, y: 91 };
    var dragStart = null;

    function pointInSvg(event) {
      var point = compassSvg.createSVGPoint();
      point.x = event.clientX;
      point.y = event.clientY;
      return point.matrixTransform(compassSvg.getScreenCTM().inverse());
    }
    function pointerAngle(event) {
      var point = pointInSvg(event);
      return Math.atan2(point.y - pivot.y, point.x - pivot.x) * 180 / Math.PI;
    }
    function setCompassAngle(value) {
      compassAngle = ((value + 180) % 360 + 360) % 360 - 180;
      compass.setAttribute('transform', 'rotate(' + compassAngle + ' ' + pivot.x + ' ' + pivot.y + ')');
      compassHandle.setAttribute('aria-valuenow', String(Math.round(compassAngle)));
      compassHandle.setAttribute('aria-valuetext', Math.round(compassAngle) + ' degrees');
    }

    compassHandle.addEventListener('pointerdown', function (event) {
      if (event.button !== undefined && event.button !== 0) return;
      dragStart = { pointerAngle: pointerAngle(event), compassAngle: compassAngle };
      if (compassHandle.setPointerCapture) compassHandle.setPointerCapture(event.pointerId);
      event.preventDefault();
    });
    compassHandle.addEventListener('pointermove', function (event) {
      if (!dragStart) return;
      setCompassAngle(dragStart.compassAngle + pointerAngle(event) - dragStart.pointerAngle);
    });
    function stopCompassDrag() { dragStart = null; }
    compassHandle.addEventListener('pointerup', stopCompassDrag);
    compassHandle.addEventListener('pointercancel', stopCompassDrag);
    compassHandle.addEventListener('lostpointercapture', stopCompassDrag);
    compassHandle.addEventListener('keydown', function (event) {
      var step = event.shiftKey ? 15 : 5;
      if (event.key === 'ArrowRight' || event.key === 'ArrowUp') {
        setCompassAngle(compassAngle + step); event.preventDefault();
      } else if (event.key === 'ArrowLeft' || event.key === 'ArrowDown') {
        setCompassAngle(compassAngle - step); event.preventDefault();
      } else if (event.key === 'Home') {
        setCompassAngle(0); event.preventDefault();
      }
    });
  }

  /* Custom cursor: desktop fine pointers only, and never with reduced motion. */
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var cursor = document.getElementById('dfCursor');

  if (cursor && finePointer.matches && !reducedMotion.matches) {
    var root = document.documentElement;
    var cursorVisible = false;

    document.addEventListener('mousemove', function (event) {
      cursor.style.transform =
        'translate3d(' + event.clientX + 'px,' + event.clientY + 'px,0)';
      if (!cursorVisible) {
        cursorVisible = true;
        root.classList.add('df-cur-on');
      }
      cursor.setAttribute('data-show', '1');

      var target = event.target && event.target.closest
        ? event.target.closest('[data-cursor],a,button,summary')
        : null;
      var state = 'default';
      if (target) {
        state = target.getAttribute('data-cursor') ||
          ((target.tagName === 'A' || target.tagName === 'SUMMARY') ? 'link' : 'button');
      }
      if (cursor.getAttribute('data-state') !== state) {
        cursor.setAttribute('data-state', state);
      }
    }, { passive: true });

    document.addEventListener('mouseleave', function () {
      cursor.setAttribute('data-show', '0');
      root.classList.remove('df-cur-on');
      cursorVisible = false;
    });
    document.addEventListener('mouseenter', function () {
      cursor.setAttribute('data-show', '1');
    });
  }
})();
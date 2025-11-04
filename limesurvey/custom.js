/******************
    User custom JS (theme) — OATutor integration
******************/
// themes/<your-theme>/custom.js
(function () {
  // ==== CONFIG ====
  const CHILD_ORIGIN = 'https://stonesitter.github.io';   // origin of your OATutor
  const NEXT_SELECTORS = [
    '#ls-button-submit',
    '#ls-button-next',
    '.ls-move-next-btn',
    "button[name='move']",
    "button[value='movenext']"
  ].join(',');
  const TOKEN = 'oatu_' + Math.random().toString(36).slice(2); // per-page token

  // ==== Helpers ====
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const frame = () => $('#oatutor-frame');

  function hideNext() {
    $$(NEXT_SELECTORS).forEach(btn => {
      btn.disabled = true;
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0';           // effective + hard to override
      btn.style.transition = 'opacity 0.2s';
      btn.dataset.oatuHidden = 'true';
    });
  }

  function showNext() {
    $$(NEXT_SELECTORS).forEach(btn => {
      btn.disabled = false;
      btn.style.pointerEvents = '';
      btn.style.opacity = '1';
      btn.removeAttribute('data-oatuHidden');
    });
  }

  function installOnce() {
    const f = frame();
    if (!f) return; // this page has no OATutor iframe

    // 1) Hide Next immediately + after small delays (defeat rerenders)
    hideNext();
    setTimeout(hideNext, 0);
    setTimeout(hideNext, 300);
    setTimeout(hideNext, 800);

    // 2) MutationObserver: if LS re-renders the navigator, re-hide
    const nav = document.getElementById('navigator-container') || document.body;
    try {
      const mo = new MutationObserver(() => hideNext());
      mo.observe(nav, { childList: true, subtree: true });
    } catch (_) {}

    // 3) Parent <-> Child messaging (no URL params)
    window.addEventListener('message', (e) => {
      const d = e && e.data || {};
      if (e.origin !== CHILD_ORIGIN) return;

      // Child asks for init -> send parent origin + token
      if (d.type === 'OATU_NEED_INIT') {
        try {
          f.contentWindow.postMessage(
            { type: 'OATU_INIT', parentOrigin: location.origin, token: TOKEN },
            CHILD_ORIGIN
          );
        } catch (err) {
          console.warn('[LS] Failed to send OATU_INIT:', err);
        }
        return;
      }

      // Child says it is complete -> verify token, then unlock Next
      if (d.type === 'OATUTOR_COMPLETE') {
        if (d.token !== TOKEN) {
          console.warn('[LS] Token mismatch, ignoring completion', d.token);
          return;
        }
        showNext();
      }
    }, false);
  }

  // Run on initial load and on PJAX
  const start = () => installOnce();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
  document.addEventListener('pjax:complete', start);
})();

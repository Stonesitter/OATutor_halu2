// src/util/parentMessaging.js

// 1) Capture init from parent
(function installInitListenerOnce() {
  if (window.__oatuInitListenerInstalled) return;
  window.__oatuInitListenerInstalled = true;

  window.addEventListener('message', (e) => {
    const d = e?.data || {};
    if (d.type !== 'OATU_INIT') return;

    window._OATU_INIT = {
      parentOrigin: d.parentOrigin || null,
      token: d.token || null,
    };
    console.log('[OATutor] OATU_INIT received:', window._OATU_INIT);
  });
})();

// 2) On first mount, ask parent for init if we’re iframed
(function pingParentForInitOnce() {
  if (window.__oatuInitPinged) return;
  window.__oatuInitPinged = true;

  if (window.parent !== window) {
    try {
      // We don't yet know the parent's origin, so target "*".
      // Parent will validate our origin before responding.
      window.parent.postMessage({ type: 'OATU_NEED_INIT' }, '*');
      console.log('[OATutor] asked parent for OATU_INIT');
    } catch (e) {
      console.warn('[OATutor] failed to ask parent for init:', e);
    }
  }
})();

// 3) Send completion to parent using the stored init
export function sendCompletionToParent(extra = {}) {
  try {
    if (window.parent === window) return; // not in an iframe
    const parentOrigin = window._OATU_INIT?.parentOrigin || null;
    const token = window._OATU_INIT?.token || null;

    if (!parentOrigin) {
      console.warn('[OATutor] parentOrigin not set; skip postMessage.');
      return;
    }
    const payload = { type: 'OATUTOR_COMPLETE', token, ...extra };
    console.log('[OATutor] posting completion to parent:', parentOrigin, payload);
    window.parent.postMessage(payload, parentOrigin);
  } catch (e) {
    console.warn('[OATutor] sendCompletionToParent failed:', e);
  }
}

// Optional: helper for testing in the iframe console
window.__oatuPingParent = function () {
  sendCompletionToParent({ status: 'test-ping' });
  console.log('[OATutor] ping; init =', window._OATU_INIT);
};

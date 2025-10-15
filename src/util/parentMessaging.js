// src/util/parentMessaging.js
export function sendCompletionToParent(payload = {}) {
  try {
    const qs = new URLSearchParams(window.location.search);
    const parentOrigin = qs.get("parentOrigin");   // e.g. https://stonesitter.limesurvey.net
    const token        = qs.get("pmToken");        // e.g. oatu_12345

    if (!parentOrigin) {
      console.warn("[OATutor] No parentOrigin in URL; not posting.");
      return;
    }
    if (window.parent === window) {
      console.warn("[OATutor] Not inside an iframe; not posting.");
      return;
    }

    window.parent.postMessage(
      { type: "OATUTOR_COMPLETE", token, ...payload },
      parentOrigin
    );
    console.log("[OATutor] Posted OATUTOR_COMPLETE →", parentOrigin, { token, payload });
  } catch (e) {
    console.error("[OATutor] sendCompletionToParent failed:", e);
  }
}

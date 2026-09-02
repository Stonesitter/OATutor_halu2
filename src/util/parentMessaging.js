// src/util/parentMessaging.js
//
// Bridge between OATutor (in an iframe) and the hosting survey page (LimeSurvey).
//
// The parent is the only sink for this study's interaction data, so this module
// is written to lose nothing when the two sides start up out of step:
//
//   1. RETRY   the OATU_NEED_INIT ping is repeated until the parent answers.
//              Previously it was sent exactly once at module load; if the
//              parent's listener was not installed yet, the ping was lost and
//              every later message was silently dropped for the rest of the
//              page (no answer logs, and no OATUTOR_COMPLETE, so the survey's
//              Next button never appeared).
//   2. BUFFER  messages produced before the handshake completes are queued and
//              flushed in order once it does, so the opening PROBLEM_OPENED is
//              not lost to a late listener. OATUTOR_COMPLETE queues with the
//              rest: the Next button must never be released ahead of the data.
//   3. REPLAY  loggable events are mirrored to localStorage per lesson and
//              re-sent after a page reload. The parent's hidden log input only
//              holds its value in the DOM, so a reload before the page is
//              submitted would otherwise wipe everything.
//
// Replay safety: it is only correct because a page cannot be re-rendered with
// an already-populated log input. The survey has the Previous button disabled,
// and every OATutor question group holds exactly two non-mandatory questions
// (the iframe and the log), so no validation error can re-render one either.
// Lesson ids are reused across the order A / order B branches, but their group
// relevance is mutually exclusive, so a participant sees each lesson once.

const RETRY_INTERVAL_MS = 300;          // ping cadence while waiting for the parent
const RETRY_SLOW_AFTER_MS = 30000;      // back off to a slower cadence after this
const RETRY_SLOW_INTERVAL_MS = 2000;
const LOGGER_ATTACH_GRACE_MS = 1500;    // let the per-group logger attach before flushing
const DISCONNECT_NOTICE_AFTER_MS = 20000;

// Off on purpose. With the retry above, "connected eventually" is the only
// outcome whenever the parent's script is present at all -- the theme hides the
// Next button and installs its message listener in the same synchronous call,
// so the two stand or fall together. That leaves exactly one reachable trigger:
// the theme script did not load. In that case the Next button was never hidden,
// so the participant is not stuck and has nothing to recover by reloading -- the
// notice would alarm someone whose only real problem is invisible to them, and
// hand them advice that cannot work. check_export.py catches those responses
// afterwards, which is where that failure belongs.
const SHOW_DISCONNECT_NOTICE = false;

const HISTORY_KEY_PREFIX = 'oatu-history-';
const HISTORY_TTL_MS = 24 * 60 * 60 * 1000;
const HISTORY_MAX_EVENTS = 500;

// Types the parent's per-group script writes into the hidden log input. These
// are the ones worth persisting and replaying.
const LOGGABLE_TYPES = [
    'OATUTOR_ANSWER_SUBMITTED',
    'OATUTOR_PROBLEM_OPENED',
    'OATUTOR_NEXT_PROBLEM',
    'OATUTOR_REFLECTION_SUBMITTED',
];

const isIframed = () => window.parent !== window;
const isLoggable = (type) => LOGGABLE_TYPES.includes(type);

/* ------------------------------------------------------------------ *
 * Persistent per-lesson history (survives a reload of the survey page)
 * ------------------------------------------------------------------ */

// Identifies the survey page. The route is #/lessons/<lessonId>.
function lessonKey() {
    const match = /#\/lessons\/([A-Za-z0-9_-]+)/.exec(window.location.hash || '');
    return HISTORY_KEY_PREFIX + (match ? match[1] : 'unknown');
}

function readHistory() {
    try {
        const raw = window.localStorage.getItem(lessonKey());
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        const cutoff = Date.now() - HISTORY_TTL_MS;
        return parsed.filter((entry) => (entry?._savedAt || 0) > cutoff);
    } catch (e) {
        console.warn('[OATutor] could not read replay history:', e);
        return [];
    }
}

function appendHistory(message) {
    try {
        const history = readHistory();
        history.push({ ...message, _savedAt: Date.now() });
        window.localStorage.setItem(
            lessonKey(),
            JSON.stringify(history.slice(-HISTORY_MAX_EVENTS))
        );
    } catch (e) {
        // Private-mode Safari and full quotas throw here. Replay is a safety
        // net, not a requirement, so degrade quietly.
        console.warn('[OATutor] could not persist replay history:', e);
    }
}

/* ------------------------------------------------------------------ *
 * Handshake, queue and flush
 * ------------------------------------------------------------------ */

const state = {
    init: null,         // { parentOrigin, token } once the parent has answered
    queue: [],          // messages produced before the flush
    flushed: false,     // true once the queue and the replay have gone out
    retryTimer: null,
    retryStartedAt: 0,
    noticeTimer: null,
    noticeEl: null,
    // Read once, at module load, so it holds only what previous page loads
    // produced. Events from this load are appended to storage as they happen.
    replay: [],
};

function post(message) {
    const { parentOrigin, token } = state.init;
    window.parent.postMessage({ ...message, token }, parentOrigin);
}

function flush() {
    if (state.flushed) return;
    state.flushed = true;

    const pending = state.replay.concat(state.queue);
    state.replay = [];
    state.queue = [];

    if (pending.length) {
        console.log(`[OATutor] flushing ${pending.length} buffered message(s) to parent`);
    }
    pending.forEach((message) => {
        // eslint-disable-next-line no-unused-vars
        const { _savedAt, ...clean } = message;
        post(clean);
    });
}

function onConnected() {
    if (state.retryTimer) {
        clearTimeout(state.retryTimer);
        state.retryTimer = null;
    }
    hideDisconnectNotice();

    // Everything waits for the parent's per-group logger, which attaches on the
    // survey page's DOMContentLoaded. OATUTOR_COMPLETE waits with it on purpose:
    // it is what reveals the survey's Next button, so releasing it before the
    // replayed events have been written would hand the participant an unlocked
    // Next button over an empty log input -- the exact data loss this is here to
    // prevent, and most likely on the reload path, where they are already
    // waiting to move on.
    //
    // postMessage preserves order between the same pair of windows, so the
    // logger has written the input before the theme sees the completion.
    setTimeout(flush, LOGGER_ATTACH_GRACE_MS);
}

function ping() {
    try {
        // The parent's origin is not known yet; it validates ours before replying.
        window.parent.postMessage({ type: 'OATU_NEED_INIT' }, '*');
    } catch (e) {
        console.warn('[OATutor] failed to ask parent for init:', e);
    }
    const elapsed = Date.now() - state.retryStartedAt;
    const delay = elapsed > RETRY_SLOW_AFTER_MS ? RETRY_SLOW_INTERVAL_MS : RETRY_INTERVAL_MS;
    state.retryTimer = setTimeout(ping, delay);
}

/* ------------------------------------------------------------------ *
 * In-frame notice when the survey page never answers (disabled; see the
 * SHOW_DISCONNECT_NOTICE comment above before turning this on)
 * ------------------------------------------------------------------ */

function showDisconnectNotice() {
    if (!SHOW_DISCONNECT_NOTICE || state.init || state.noticeEl) return;
    const el = document.createElement('div');
    el.setAttribute('data-oatu-notice', 'true');
    el.style.cssText = [
        'position:fixed', 'top:0', 'left:0', 'right:0', 'z-index:99999',
        'padding:12px 16px', 'background:#b3261e', 'color:#fff',
        'font:600 15px/1.4 system-ui,-apple-system,sans-serif', 'text-align:center',
    ].join(';');
    el.textContent =
        'This exercise could not connect to the survey. If you cannot continue, '
        + 'reload this page — your progress is saved. If that does not help, '
        + 'please contact the researcher before going on.';
    document.body.appendChild(el);
    state.noticeEl = el;
}

function hideDisconnectNotice() {
    if (state.noticeEl) {
        state.noticeEl.remove();
        state.noticeEl = null;
    }
    if (state.noticeTimer) {
        clearTimeout(state.noticeTimer);
        state.noticeTimer = null;
    }
}

/* ------------------------------------------------------------------ *
 * Start-up
 * ------------------------------------------------------------------ */

(function installOnce() {
    if (window.__oatuMessagingInstalled) return;
    window.__oatuMessagingInstalled = true;

    window.addEventListener('message', (e) => {
        const d = e?.data || {};
        if (d.type !== 'OATU_INIT') return;
        if (state.init) return; // already connected; ignore repeats

        state.init = {
            parentOrigin: d.parentOrigin || e.origin || null,
            token: d.token || null,
        };
        if (!state.init.parentOrigin) {
            console.warn('[OATutor] OATU_INIT without a parent origin; ignoring.');
            state.init = null;
            return;
        }
        console.log('[OATutor] OATU_INIT received:', state.init);
        onConnected();
    });

    if (!isIframed()) return;

    state.replay = readHistory();
    if (state.replay.length) {
        console.log(
            `[OATutor] found ${state.replay.length} event(s) from an earlier load of this `
            + 'lesson; they will be re-sent once the parent connects.'
        );
    }

    state.retryStartedAt = Date.now();
    ping();

    if (SHOW_DISCONNECT_NOTICE) {
        state.noticeTimer = setTimeout(showDisconnectNotice, DISCONNECT_NOTICE_AFTER_MS);
    }
})();

function postToParent(type, extra = {}, logContext = 'message') {
    try {
        if (!isIframed()) return; // not in an iframe

        const message = { type, ...extra };

        // Persist before sending: a reload can happen between the two.
        if (isLoggable(type)) appendHistory(message);

        // Queue until the replay and the backlog have gone out, so ordering
        // survives. Nothing overtakes the flush.
        if (!state.flushed) {
            state.queue.push(message);
            console.log(`[OATutor] queued ${logContext} (parent not ready yet):`, message);
            return;
        }

        console.log(`[OATutor] posting ${logContext} to parent:`, state.init.parentOrigin, message);
        post(message);
    } catch (e) {
        console.warn('[OATutor] postToParent failed:', e);
    }
}

// Send completion to parent using the stored init
export function sendCompletionToParent(extra = {}) {
    postToParent('OATUTOR_COMPLETE', extra, 'completion');
}

// Send answer submission events to the parent for logging/analytics
export function sendAnswerSubmissionToParent(extra = {}) {
    const payload = { ...extra };
    if (!('timestamp' in payload)) {
        payload.timestamp = new Date().toISOString();
    }
    postToParent('OATUTOR_ANSWER_SUBMITTED', payload, 'answer submission');
}

// Send "Problem Opened" signal to parent for timing measurement
export function sendProblemOpenedToParent(extra = {}) {
    const payload = { ...extra };
    if (!('timestamp' in payload)) {
        payload.timestamp = new Date().toISOString();
    }
    postToParent('OATUTOR_PROBLEM_OPENED', payload, 'problem opened');
}

// Send "Next Problem" click signal to parent for timing measurement
export function sendNextProblemToParent(extra = {}) {
    const payload = { ...extra };
    if (!('timestamp' in payload)) {
        payload.timestamp = new Date().toISOString();
    }
    postToParent('OATUTOR_NEXT_PROBLEM', payload, 'next problem click');
}

// Send reflection submission to parent for logging
export function sendReflectionToParent(extra = {}) {
    const payload = { ...extra };
    if (!('timestamp' in payload)) {
        payload.timestamp = new Date().toISOString();
    }
    postToParent('OATUTOR_REFLECTION_SUBMITTED', payload, 'reflection submission');
}

// Helpers for testing from the iframe console
window.__oatuPingParent = function () {
    sendCompletionToParent({ status: 'test-ping' });
    console.log('[OATutor] ping; init =', state.init);
};

window.__oatuStatus = function () {
    return {
        iframed: isIframed(),
        connected: !!state.init,
        parentOrigin: state.init?.parentOrigin || null,
        flushed: state.flushed,
        queued: state.queue.length,
        pendingReplay: state.replay.length,
        storedHistory: readHistory().length,
    };
};

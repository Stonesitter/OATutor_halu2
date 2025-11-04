# 🧭 OATutor × LimeSurvey Integration

This repository documents the integration of **OATutor** lessons (interactive learning units) into **LimeSurvey** via `<iframe>` embedding and secure `postMessage()` communication.  
The integration enables two key features:

1. **Navigation Control** – LimeSurvey’s “Next” button is hidden until a learner completes the OATutor lesson.
2. **Client-Side Logging** – Answer submissions inside OATutor are logged directly into hidden LimeSurvey question fields (no Firebase or third-party data involved).

All data processing occurs in the participant’s browser; only LimeSurvey stores responses.

---

## 🏗️ System Architecture

```
 ┌────────────────────────────────────────────┐
 │ LimeSurvey (University server)             │
 │                                            │
 │  ┌──────────────────────────────────────┐  │
 │  │ Question Group                       │  │
 │  │ ├── OATutor iframe                   │  │
 │  │ │   Hosted on GitHub Pages           │  │
 │  │ │   Sends postMessages to parent     │  │
 │  │ ├── Hidden question (logger field)   │  │
 │  │ │   Receives JSON logs from iframe   │  │
 │  │ └────────────────────────────────────┘  │
 │                                            │
 │ Theme custom.js                            │
 │ ├─ Hides/Shows “Next” button               │
 │ ├─ Responds to initialization handshake    │
 │ └─ Logs submission data into hidden field  │
 └────────────────────────────────────────────┘
```

---

## 📂 File Structure Overview

```
/OATutor_halu2/
  └── src/util/parentMessaging.js     # Handles iframe-to-parent communication
/limesurvey/themes/oatutor_next_toggle/
  ├── custom.js                       # Theme integration logic
  ├── manifest.json
  └── config.xml
```

---

## 🔁 Message Flow

### 1️⃣ Initialization
When OATutor loads in the iframe, it sends:
```js
window.parent.postMessage({ type: 'OATU_NEED_INIT' }, '*');
```

LimeSurvey’s theme (`custom.js`) responds:
```js
{ type: 'OATU_INIT', parentOrigin: location.origin, token: 'oatu_<random>' }
```

OATutor stores this configuration as `window._OATU_INIT`.

---

### 2️⃣ Lesson Completion
Once a lesson is completed, OATutor sends:
```js
{ type: 'OATUTOR_COMPLETE', token: ..., lessonId: ... }
```
→ LimeSurvey validates the token and **reveals the “Next” button**.

---

### 3️⃣ Answer Submission Logging
Every answer submission in OATutor triggers:
```js
{ type: 'OATUTOR_ANSWER_SUBMITTED', token: ..., stepId: ..., attemptRaw: ..., isCorrect: ... }
```
→ LimeSurvey appends the submission to a hidden logger question’s value (JSON array).

---

## 🧩 Components and Roles

| Component | Location | Role |
|------------|-----------|------|
| **OATutor iframe** | Question HTML | Renders the lesson and sends completion & submission data |
| **parentMessaging.js** | `/src/util/` | Sends and receives `postMessage()` events between iframe and parent |
| **LimeSurvey theme (custom.js)** | `/themes/oatutor_next_toggle/` | Handles handshake, unlocks “Next,”  |
| **LimeSurvey Question Group | Source Code | Script handles listener and logs Data into the logger Question| see questionLoggerScript.txt |
| **LimeSurvey Iframe Question | Source Code| Script shows OATutor iframe – id:"oatutor-frame" is need for Handshake| 
| **Hidden logger question** | Display | "Always-hidden" needs to be off! – to hide input-field set custom css-class or 'd-none' |

---

## 🧱 Example LimeSurvey Setup

### 1️⃣ Question Group Structure
Each group corresponds to one OATutor page:
- **Question 1:** *Iframe question*  
- **Question 2:** *Hidden “log” question*

### 2️⃣ Iframe Question Source

```html
<p>Please complete the activity below. The “Next” button will appear after you finish.</p>

<iframe
  id="oatutor-frame"
  src="https://stonesitter.github.io/OATutor_halu2/#/lessons/7BSivgkK-psrE-71qi2JQ38C"
  width="100%"
  height="800"
  sandbox="allow-scripts allow-same-origin"
  style="border: 1px solid #ccc; border-radius: 6px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
</iframe>
```

### 3️⃣ Hidden Logger Question

| Setting | Value |
|----------|--------|
| **Question type** | Short free text |
| **Code** | `oatutor_log_1` |
| **Relevance equation** | `1` |
| **CSS class** | `d-none` |
| **Important: Don't use "always-hide-Question" or otherwise the Question doesn't exist in the DOM
| **Purpose** | Stores submission JSON |

Example stored value:
```json
[
  {
    "timestamp": "2025-11-03T17:21:09.839Z",
    "problemId": "acebe80ProlificIDa",
    "stepTitle": "Your Prolific ID",
    "attempt": "34",
    "isCorrect": false
  }
]
```

---

## ⚙️ Theme Logic (custom.js)

The custom theme file `/themes/oatutor_next_toggle/custom.js` handles:

| Task | Description |
|------|--------------|
| **Initialization** | Responds to OATutor’s `OATU_NEED_INIT` with `OATU_INIT`. |
| **Token Verification** | Ensures secure communication per page. |
| **Next Button Toggle** | Hides the button until `OATUTOR_COMPLETE`. |
| **Answer Logging** | Listens for `OATUTOR_ANSWER_SUBMITTED` and writes to hidden field. |

`CHILD_ORIGIN` must exactly match your OATutor site’s origin:
```js
const CHILD_ORIGIN = 'https://stonesitter.github.io';
```

---

## 🧠 Message Types Reference

| Type | Direction | Description |
|------|------------|-------------|
| `OATU_NEED_INIT` | Child → Parent | Requests initialization handshake |
| `OATU_INIT` | Parent → Child | Sends parent origin and token |
| `OATUTOR_COMPLETE` | Child → Parent | Signals lesson completion |
| `OATUTOR_ANSWER_SUBMITTED` | Child → Parent | Sends answer submission data |

---

## 🔒 Security Notes

- All communication uses `window.postMessage()` and is restricted by `origin`.  
- A random per-page `TOKEN` ensures the iframe can’t spoof other pages.  
- GitHub Pages serves static content only — no user data or analytics.  
- LimeSurvey (university infrastructure) remains the **sole data processor** under GDPR.

---

## 🧰 Debugging Checklist

| Step | Expected Output | Console Context |
|------|-----------------|----------------|
| OATutor loads | `[OATutor] asked parent for OATU_INIT` | iframe |
| Parent responds | `[OATutor] OATU_INIT received:` | iframe |
| Submit answer | `[OATutor] posting answer submission to parent:` | iframe |
| Parent receives | `[LS] Logged OATUTOR_ANSWER_SUBMITTED:` | parent (LimeSurvey) |
| Lesson complete | “Next” button becomes visible | parent |

If you see:  
`[OATutor] parentOrigin not set; skip postMessage.` → your handshake failed (theme or iframe ID mismatch).

---

## 🌐 Hosting Notes

- **OATutor**: hosted via GitHub Pages (static assets only).  
  No personal data leaves LimeSurvey.  
- **LimeSurvey**: runs on the university’s secure server and stores all logs.
- **Optional**: OATutor can be self-hosted on a university web server by copying the `/build` folder.

---

## ⚡ Quick Setup for New Users

1. **Clone** this repository (or your fork).  
2. **Build** OATutor → deploy to GitHub Pages or local web server.  
3. In **LimeSurvey**, create a new survey using the `oatutor_next_toggle` theme.  
4. For each page (question group):  
   - Add one iframe question with `id="oatutor-frame"`.  
   - Add one hidden text question (code: `oatutor_log_X`).  
5. Test the connection via browser console.  
   - Expect `[OATutor] OATU_INIT received:` inside iframe logs.  
6. Verify logs are written to the hidden question field after submission.  

---

## 👥 Credits

- **Integration:** Manuel Althaler  
- **OATutor Framework:** OpenAI Tutor Project  
- **Survey Platform:** LimeSurvey (University of Vienna instance)

---

> **Note:**  
> All components communicate locally in the browser through `window.postMessage`.  
> No external analytics, Firebase, or cookies are used in this setup.  
> This integration meets GDPR requirements as long as LimeSurvey is hosted within institutional infrastructure.

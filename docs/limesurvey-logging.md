# LimeSurvey Logging Mechanism

## Overview

OATutor communicates with LimeSurvey via postMessage to log answer submissions and signal completion.

## Message Types

### 1. `OATUTOR_ANSWER_SUBMITTED`
Sent every time a student submits an answer to a problem step.

**Payload:**
```javascript
{
  type: 'OATUTOR_ANSWER_SUBMITTED',
  token: string,
  timestamp: string (ISO),
  oats_user_id: string,
  problemId: string,
  stepId: string,
  stepTitle: string,
  stepIndex: number,
  courseName: string,
  lesson: { id, name },
  seed: string,
  attemptRaw: string,
  attemptEvaluated: string,
  isCorrect: boolean,
  reason: string,
  knowledgeComponents: array,
  hintsProgress: array,
  usedHints: boolean
}
```

### 2. `OATUTOR_COMPLETE`
Sent when a lesson is completed (graduated or exhausted).

**Payload:**
```javascript
{
  type: 'OATUTOR_COMPLETE',
  token: string,
  status: 'graduated' | 'exhausted',
  lessonId: string
}
```

## LimeSurvey Setup Per Question Group

Each question group that contains an OATutor iframe needs:

### 1. Iframe Question
- Question type: Text display or similar
- Contains the OATutor iframe with correct ID:
```html
<iframe id="oatutor-frame" src="https://stonesitter.github.io/OATutor_halu2/#/lessons/{LESSON_ID}" ...></iframe>
```

### 2. Hidden Logger Question
- Question type: Short text (hidden via CSS or question settings)
- Has a specific SGQA code for targeting
- Stores accumulated JSON log of all answer submissions

### 3. Logger Script (per question group)
Add this script to the question group source:

```html
<script>
(function() {
  const CHILD_ORIGIN = 'https://stonesitter.github.io';  // OATutor deployment origin
  const HIDDEN_INPUT_SELECTOR = '#answer{SGQA}';  // Replace {SGQA} with actual code, e.g., #answer123X456X789

  document.addEventListener('DOMContentLoaded', function() {
    const hiddenInput = document.querySelector(HIDDEN_INPUT_SELECTOR);

    if (!hiddenInput) {
      console.warn('[LS] Hidden OATutor log input not found:', HIDDEN_INPUT_SELECTOR);
      return;
    }

    window.addEventListener('message', function(e) {
      const d = e && e.data;
      if (e.origin !== CHILD_ORIGIN) return;
      if (d.type !== 'OATUTOR_ANSWER_SUBMITTED') return;

      try {
        const prev = hiddenInput.value ? JSON.parse(hiddenInput.value) : [];
        prev.push({
          timestamp: d.timestamp || new Date().toISOString(),
          oats_user_id: d.oats_user_id || null,
          problemId: d.problemId,
          stepId: d.stepId,
          stepTitle: d.stepTitle,
          attempt: d.attemptRaw,
          isCorrect: d.isCorrect
        });
        hiddenInput.value = JSON.stringify(prev);
        console.log('[LS] Logged OATUTOR_ANSWER_SUBMITTED:', prev);
      } catch (err) {
        console.error('[LS] Failed to log OATUTOR_ANSWER_SUBMITTED:', err);
      }
    });
  });
})();
</script>
```

**Note:** LimeSurvey Expression Manager can auto-expand `{G16log.sgqa}` syntax to the actual SGQA code.

## Data Flow

```
Student submits answer in OATutor iframe
         │
         ▼
ProblemCard.js calls sendAnswerSubmissionToParent()
         │
         ▼
parentMessaging.js posts OATUTOR_ANSWER_SUBMITTED to parent
         │
         ▼
LimeSurvey logger script receives message
         │
         ▼
Appends to hidden input as JSON array
         │
         ▼
When survey page advances, LimeSurvey saves hidden field value
```

## Stored Log Format

The hidden field accumulates a JSON array:

```json
[
  {
    "timestamp": "2024-01-15T10:30:00.000Z",
    "oats_user_id": "abc123",
    "problemId": "a07f039inaccurate1_chem_aq_01",
    "stepId": "a07f039inaccurate1_chem_aq_01a",
    "stepTitle": "Step 1",
    "attempt": "42",
    "isCorrect": true
  },
  {
    "timestamp": "2024-01-15T10:31:00.000Z",
    "oats_user_id": "abc123",
    "problemId": "a07f039inaccurate1_chem_aq_01",
    "stepId": "a07f039inaccurate1_chem_aq_01b",
    "stepTitle": "Step 2",
    "attempt": "wrong answer",
    "isCorrect": false
  }
]
```

## Theme-Level Integration (custom.js)

The theme's custom.js handles:
1. Hiding the "Next" button until lesson completion
2. Responding to `OATU_NEED_INIT` with parent origin and token
3. Showing "Next" button on `OATUTOR_COMPLETE`

See `/limesurvey/custom.js` for implementation.

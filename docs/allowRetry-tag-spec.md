# allowRetry Tag Specification

## Overview

The `allowRetry` tag controls whether students can re-attempt a question after submitting an incorrect answer. This is distinct from `allowRecycle`, which controls whether problems can appear again later in a session.

## Expected Output in coursePlans.json

After conversion, each lesson object in `coursePlans.json` should include the `allowRetry` property as a boolean:

```json
{
    "id": "lesson-id-here",
    "name": "Lesson Name",
    "topics": "",
    "allowRecycle": false,
    "allowRetry": true,
    "learningObjectives": {
        "kc_1": 0.85
    },
    "showStuMastery": false,
    "doMasteryUpdate": false,
    "keepMCOrder": true,
    "giveStuFeedback": false
}
```

## Behavior

| Value | Behavior |
|-------|----------|
| `true` | Students can modify their answer and resubmit after an incorrect attempt |
| `false` | Input is disabled after the first submission (student cannot retry) |
| not set | Currently defaults to `false` (input disabled after first attempt) |

## Code Reference

The property is read in `src/components/problem-layout/Problem.js` at line 53:

```javascript
const allowRetry = this.props.lesson?.allowRetry;
```

It is then passed down through:
- `Problem.js` -> `ProblemCardWrapper` -> `ProblemCard` -> `ProblemInput`

The retry logic is enforced in `src/components/problem-input/ProblemInput.js` at lines 136-139.

## Difference from allowRecycle

| Tag | Purpose |
|-----|---------|
| `allowRecycle` | Can the same problem appear again later in the session? |
| `allowRetry` | Can the student re-attempt a question immediately after getting it wrong? |

These are independent settings and should be configurable separately.

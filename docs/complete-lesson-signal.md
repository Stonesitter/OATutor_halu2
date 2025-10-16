# LimeSurvey Integration (feat/limesurvey-integration)

## Overview
This feature integrates OATutor lessons into LimeSurvey pages
and controls the “Next” button based on lesson completion.

## Summary of Changes
- Added `custom.js` logic to hide/show LimeSurvey’s "Next" button.
- Added postMessage communication between LimeSurvey and OATutor.
- Modified `parentMessaging.js` and `Platform.js` to support parent handshake.
- Introduced custom theme: `oatutor_next_toggle`.

## How It Works
1. **LimeSurvey side:**
   - Pages containing `<iframe id="oatutor-frame">` trigger the button lock.
   - When OATutor sends a completion message, the button is unlocked.

2. **OATutor side:**
   - `parentMessaging.js` listens for initialization from the parent.
   - When a lesson is completed, `sendCompletionToParent()` sends a signal back.

3. **Communication flow:**
   - OATutor iframe → window.parent.postMessage("OATUTOR_COMPLETE")
   - LimeSurvey custom.js → shows Next button


## Deployment Steps
1. In LimeSurvey:
- Use the custom theme `oatutor_next_toggle`.
- Add the lesson iframe:
  ```html
  <iframe
    id="oatutor-frame"
    src="https://stonesitter.github.io/OATutor_halu2/#/lessons/xxxx"
    sandbox="allow-scripts allow-same-origin"
    width="100%"
    height="800"
  ></iframe>
  ```

## LimeSurvey Theme: `oatutor_next_toggle`

This theme handles the “Next button” visibility logic for OATutor lessons.

**Files included:**  
- `custom.js` — hides/shows the Next button based on postMessage events from OATutor.  
- `config.xml` / `manifest.json` — theme metadata and parent theme reference.

**Usage:**
1.1. Download the `limesurvey-theme/` folder from this repo.
1.2. Zip it:
   ```bash
   cd limesurvey-theme
   zip -r oatutor_next_toggle.zip .
1.3. In LimeSurvey, go to:
   Configuration → Themes → Upload Theme
   Upload oatutor_next_toggle.zip.
1.4. Apply it to your survey (Survey settings → Presentation → Theme).

Once applied, any question group containing:
<iframe id="oatutor-frame" src="..."></iframe>
will automatically hide the “Next” button until OATutor sends the completion message.



2. Ensure your survey page contains only **one active OATutor iframe**.
If multiple are present, only the one with the ID `oatutor-frame` controls the button.

3. OATutor app must include:
- Updated `parentMessaging.js`
- Updated `Platform.js` with `CompletionBeacon` and `sendCompletionToParent` logic

## Troubleshooting
- **Next button not hidden:** Check that your iframe has `id="oatutor-frame"`.
- **Token not received:** Ensure `parentMessaging.js` is loaded before lesson components.
- **Lesson doesn’t load:** Verify the iframe URL includes `#/lessons/...`.

## Future Improvements
- Handle multiple iframe synchronization gracefully.
- Allow custom data attributes (`data-oatutor`) instead of hardcoded IDs.
- Add automated test for postMessage handshake.
- Create Button at "finished"-Website that lets one get unstuck, if stuck without Next Button
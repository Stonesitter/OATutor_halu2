# Hint Pathway Variants

## Overview

A lesson normally serves one fixed set of hints. This fork lets the embedding
page choose between several named sets on the same lesson, through a
`hintpathway` URL parameter.

The pathway mechanism itself is upstream: `preprocessProblemPool.js` collects
every file in a step's `tutoring/` directory into `step.hints`, keyed by the
part of the filename that follows the step id. Upstream only ever writes one
such file (`DefaultPathway`) and selects between pathways with the A/B test
mode, which offers two levels and is not steerable from outside the app. The
parameter replaces that selection.

## The URL parameter

```
#/lessons/<lessonId>?hintpathway=V2Pathway
```

| Value | Result |
|-------|--------|
| a pathway the step has | that pathway's hints are served |
| a pathway the step lacks | falls back to `DefaultPathway`, logs a warning |
| omitted | `DefaultPathway`, i.e. unchanged upstream behaviour |

The parameter is read in `src/App.js`, where `queryParamToContext` maps it onto
`context.hintPathway`. `additionalContext` is spread into `ThemeContext` after
`treatmentMapping`, so the parameter wins over the default.

It is also listed in `queryParamsToKeep` (`src/App.js:68`). This is not
cosmetic: `onLocationChange` rebuilds the URL from that list and calls
`window.history.replaceState`, so a parameter left out of it disappears from the
address bar. The value survives in React state for the rest of the session, but
a page reload would then serve `DefaultPathway` without anything saying so.

## Fallback

`src/components/problem-layout/ProblemCard.js` resolves the pathway against the
step before using it. Previously `this.step.hints[context.hintPathway]` yielded
`undefined` for an unknown pathway and the `for (let hint of this.hints)` loop
below threw, which takes down the whole iframe.

This matters because not every lesson has variants. Pre- and post-test problems
only ever have `DefaultPathway`, so a participant whose URL carries a pathway
would otherwise lose the session on the first pre-test problem.

## Generated variants

`src/tools/generateHintVariants.js` writes `V1Pathway` … `V4Pathway` next to
each acquisition problem's `DefaultPathway`, by recombining the two wordings
that already exist in the pool: the accurate one from `accurate_*`, the
inaccurate one from `inaccurate4_*`. No new hint text is authored.

It runs from `updateContent.sh`, after the pool is copied and before
preprocessing. The files are build output and are gitignored; the
`DefaultPathway` files they are derived from are checked in.

Hint ids encode their step (`<stepId>-h1`), so copying an array between problems
rebases that prefix -- otherwise `dependencies` would reference a step that is
not present, and `_findHintId` would not resolve them.

The generator also writes `generated/hint-variants-manifest.json`, which records
for each item and condition the variants in which that item is shown
accurately. The survey generator reads it instead of deriving the same table a
second time.

### Which variants exist

All six condition folders get `V1Pathway` … `V4Pathway`, including the three
that have nothing to vary (`control`, `accurate`, `inaccurate4`, where the four
files are identical). One uniform URL template then works for every lesson, and
the conditions that do not vary exercise the same code path as the ones that do.

## Reported back to the host page

Both `postMessage` payloads carry the pathway:

| Message | Field | Value |
|---------|-------|-------|
| `OATUTOR_PROBLEM_OPENED` | `hintPathway` | the **requested** pathway (`Platform.js:368`, `:482`) |
| `OATUTOR_ANSWER_SUBMITTED` | `hintPathway` | the **effective** pathway after fallback (`ProblemCard.js:301`) |

The two differ only when the fallback fired: the card that resolves the pathway
does not exist yet when the problem is opened. A log in which they disagree is
therefore a usable signal, not an inconsistency — a host page that wants to tell
"the parameter never arrived" (both report `DefaultPathway`) apart from "the
variant files are not deployed" (only the requested one names a variant) has to
store both fields rather than one.

## Code Reference

| File | What |
|------|------|
|  `src/App.js:56-66` | `queryParamToContext`, including `hintpathway` |
|  `src/App.js:68-76` | `queryParamsToKeep` |
|  `src/App.js:294` | `hintPathway` default from `treatmentMapping` |
| `src/components/problem-layout/ProblemCard.js:75-90` | resolution and fallback |
| `src/tools/generateHintVariants.js` | variant generation and design checks |
| `src/tools/preprocessProblemPool.js:121-144` | pathway discovery (upstream) |

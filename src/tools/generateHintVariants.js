/**
 * Generates the named hint pathways that let the survey randomise WHICH item
 * carries the inaccurate feedback, instead of that being fixed by the condition.
 *
 * Without this, item identity and error-ness are fully confounded: in every
 * condition the inaccurate feedback always sits on the same problems, so an
 * observed effect could just as well come from those specific items.
 *
 * Runs against the copied content pool, before preprocessProblemPool.js. The
 * files it writes are build output -- they are regenerated on every content
 * update and are not checked in.
 *
 * Reads:  <cond>_<subject>_aq_0N/steps/<step>/tutoring/<step>DefaultPathway.json
 * Writes: the same directory, <step>V1Pathway.json .. <step>V4Pathway.json
 *         plus generated/hint-variants-manifest.json for the survey generator.
 */

const fs = require("fs");
const path = require("path");

const { CONTENT_SOURCE } = require("../../common/global-config");

const POOL = path.join(__dirname, "..", "content-sources", CONTENT_SOURCE, "content-pool");
const MANIFEST = path.join(__dirname, "..", "..", "generated", "hint-variants-manifest.json");

const SUBJECTS = ["chem", "precalc"];
const ITEMS = [1, 2, 3, 4];
const VARIANTS = [1, 2, 3, 4];

// Where the accurate and the inaccurate wording of each item comes from.
const ACCURATE_SOURCE = "accurate";
const INACCURATE_SOURCE = "inaccurate4";

/**
 * Which items carry the INACCURATE hint, per condition folder and variant.
 *
 * The numbering is deliberate: for 25% and 75% the variant number names the
 * item that falls out of line -- the single inaccurate one at 25%, the single
 * accurate one at 75%.
 *
 * ---------------------------------------------------------------------------
 * inaccurate2 (the 50% condition) is the one line that is a judgement call.
 * Marlene originally proposed two complementary pairs, {1,2} and {3,4}. That
 * balances the items but keeps 1 bound to 2 and 3 bound to 4 forever, so a
 * difference between those items is not spread out, only moved onto the pair.
 * Four pairs cost nothing here (four variants are generated either way) and
 * break the coupling, and she agreed to them on 2026-09-29. To go back to two
 * pairs, make variants 3 and 4 repeat 1 and 2.
 * ---------------------------------------------------------------------------
 */
const INACCURATE_ITEMS = {
    accurate:    { 1: [],          2: [],          3: [],          4: []          },
    inaccurate1: { 1: [1],         2: [2],         3: [3],         4: [4]         },
    inaccurate2: { 1: [1, 2],      2: [3, 4],      3: [1, 3],      4: [2, 4]      },
    inaccurate3: { 1: [2, 3, 4],   2: [1, 3, 4],   3: [1, 2, 4],   4: [1, 2, 3]   },
    inaccurate4: { 1: [1, 2, 3, 4], 2: [1, 2, 3, 4], 3: [1, 2, 3, 4], 4: [1, 2, 3, 4] },
};

// The control condition serves no hints at all; its pathway is an empty array.
// It still gets V1..V4 so that every lesson accepts the same URL parameter.
const NO_HINT_CONDITIONS = ["control"];

const ALL_CONDITIONS = Object.keys(INACCURATE_ITEMS).concat(NO_HINT_CONDITIONS);

function fail(msg) {
    console.error(`generateHintVariants: ${msg}`);
    process.exit(1);
}

/** The pool prefixes every problem id with 'a' + a hash of its source sheet. */
function findProblemDir(condition, subject, item) {
    const suffix = `${condition}_${subject}_aq_${String(item).padStart(2, "0")}`;
    const matches = fs
        .readdirSync(POOL)
        .filter((d) => d.endsWith(suffix) && /^a[0-9a-f]{6}/.test(d));
    if (matches.length !== 1) {
        fail(`expected exactly one directory ending in ${suffix}, found ${matches.length}`);
    }
    return path.join(POOL, matches[0]);
}

/** Every step of a problem, as { stepId, tutoringDir, defaultPathwayFile }. */
function stepsOf(problemDir) {
    const stepsDir = path.join(problemDir, "steps");
    return fs.readdirSync(stepsDir).map((stepId) => {
        const tutoringDir = path.join(stepsDir, stepId, "tutoring");
        const file = path.join(tutoringDir, `${stepId}DefaultPathway.json`);
        if (!fs.existsSync(file)) {
            fail(`${stepId}: no DefaultPathway.json -- cannot derive variants`);
        }
        return { stepId, tutoringDir, defaultPathwayFile: file };
    });
}

/**
 * Hint ids and their dependencies are derived from the step they belong to
 * ("<stepId>-h1"). Copying a hint array between conditions therefore has to
 * rewrite that prefix, or dependencies point at a step that is not there.
 */
function rebaseHints(hints, fromStepId, toStepId) {
    const serialised = JSON.stringify(hints);
    const textCarriesStepId = hints.some(
        (h) => typeof h.text === "string" && h.text.includes(fromStepId)
    );
    if (textCarriesStepId) {
        fail(`${fromStepId}: hint text contains the step id; refusing to rewrite blindly`);
    }
    return JSON.parse(serialised.split(fromStepId).join(toStepId));
}

function readJSON(file) {
    return JSON.parse(fs.readFileSync(file, "utf8"));
}

/** OATutor renders a literal "\n" as a line break (renderText.js). */
function normalise(text) {
    return String(text).replace(/\\n/g, " ").replace(/\s+/g, " ").trim();
}

function textsOf(hints) {
    return hints.map((h) => normalise(h.text || ""));
}

function main() {
    // --- collect the two source wordings for every subject and item ---------
    const sources = {};
    for (const subject of SUBJECTS) {
        sources[subject] = {};
        for (const item of ITEMS) {
            const entry = {};
            for (const [role, condition] of [
                ["accurate", ACCURATE_SOURCE],
                ["inaccurate", INACCURATE_SOURCE],
            ]) {
                const steps = stepsOf(findProblemDir(condition, subject, item));
                if (steps.length !== 1) {
                    fail(`${condition}_${subject}_aq_0${item}: expected 1 step, found ${steps.length}`);
                }
                entry[role] = {
                    stepId: steps[0].stepId,
                    hints: readJSON(steps[0].defaultPathwayFile),
                };
            }
            if (entry.accurate.hints.length === 0 || entry.inaccurate.hints.length === 0) {
                fail(`${subject}_aq_0${item}: a source pathway is empty`);
            }
            sources[subject][item] = entry;
        }
    }

    // --- write the variants -------------------------------------------------
    const manifest = {};
    let written = 0;

    for (const condition of ALL_CONDITIONS) {
        const servesNoHints = NO_HINT_CONDITIONS.includes(condition);
        for (const subject of SUBJECTS) {
            for (const item of ITEMS) {
                const steps = stepsOf(findProblemDir(condition, subject, item));
                for (const step of steps) {
                    const own = readJSON(step.defaultPathwayFile);
                    for (const variant of VARIANTS) {
                        let hints;
                        if (servesNoHints) {
                            if (own.length !== 0) {
                                fail(`${step.stepId}: ${condition} is expected to serve no hints`);
                            }
                            hints = own;
                        } else {
                            const inaccurateItems = INACCURATE_ITEMS[condition][variant];
                            const role = inaccurateItems.includes(item) ? "inaccurate" : "accurate";
                            const src = sources[subject][item][role];
                            hints = rebaseHints(src.hints, src.stepId, step.stepId);
                        }
                        fs.writeFileSync(
                            path.join(step.tutoringDir, `${step.stepId}V${variant}Pathway.json`),
                            JSON.stringify(hints, null, 4) + "\n"
                        );
                        written += 1;
                    }
                }

                // Which variants show this item accurately, for the survey.
                if (!servesNoHints) {
                    const key = `${subject}_aq_0${item}`;
                    manifest[key] = manifest[key] || {};
                    manifest[key][condition] = VARIANTS.filter(
                        (v) => !INACCURATE_ITEMS[condition][v].includes(item)
                    );
                }
            }
        }
    }

    verify(sources, manifest);

    fs.mkdirSync(path.dirname(MANIFEST), { recursive: true });
    fs.writeFileSync(
        MANIFEST,
        JSON.stringify({ inaccurateItems: INACCURATE_ITEMS, accurateBy: manifest }, null, 4) + "\n"
    );
    console.log(`generateHintVariants: wrote ${written} pathway files`);
}

/**
 * Checks the design, not the code: a wrong hint in the right file looks exactly
 * like a right one, so nothing downstream would notice. This is the only place
 * that can.
 */
function verify(sources, manifest) {
    const EXPECTED_INACCURATE_COUNT = {
        accurate: 0, inaccurate1: 1, inaccurate2: 2, inaccurate3: 3, inaccurate4: 4,
    };

    for (const condition of Object.keys(INACCURATE_ITEMS)) {
        // Each variant carries the share of inaccurate feedback its condition promises.
        for (const variant of VARIANTS) {
            const n = INACCURATE_ITEMS[condition][variant].length;
            if (n !== EXPECTED_INACCURATE_COUNT[condition]) {
                fail(`${condition} V${variant}: ${n} inaccurate items, expected ${EXPECTED_INACCURATE_COUNT[condition]}`);
            }
            const unique = new Set(INACCURATE_ITEMS[condition][variant]);
            if (unique.size !== n) {
                fail(`${condition} V${variant}: duplicate items in the table`);
            }
        }
        // Every item is the deviating one equally often -- the whole point.
        const perItem = ITEMS.map(
            (i) => VARIANTS.filter((v) => INACCURATE_ITEMS[condition][v].includes(i)).length
        );
        if (new Set(perItem).size !== 1) {
            fail(`${condition}: items are inaccurate ${perItem.join("/")} times -- not balanced`);
        }
    }

    // Every generated file holds one of the two source wordings and nothing else.
    for (const condition of ALL_CONDITIONS) {
        const servesNoHints = NO_HINT_CONDITIONS.includes(condition);
        for (const subject of SUBJECTS) {
            for (const item of ITEMS) {
                for (const step of stepsOf(findProblemDir(condition, subject, item))) {
                    const pathways = fs
                        .readdirSync(step.tutoringDir)
                        .filter((f) => f.endsWith("Pathway.json"));
                    const expected = ["DefaultPathway"].concat(VARIANTS.map((v) => `V${v}Pathway`));
                    const found = pathways
                        .map((f) => f.slice(step.stepId.length).replace(/\.json$/, ""))
                        .sort();
                    if (JSON.stringify(found) !== JSON.stringify(expected.slice().sort())) {
                        fail(`${step.stepId}: pathways are ${found.join(",")}, expected ${expected.join(",")}`);
                    }
                    if (servesNoHints) continue;

                    const accurate = textsOf(sources[subject][item].accurate.hints);
                    const inaccurate = textsOf(sources[subject][item].inaccurate.hints);
                    for (const variant of VARIANTS) {
                        const file = path.join(step.tutoringDir, `${step.stepId}V${variant}Pathway.json`);
                        const got = textsOf(readJSON(file));
                        const isAccurate = JSON.stringify(got) === JSON.stringify(accurate);
                        const isInaccurate = JSON.stringify(got) === JSON.stringify(inaccurate);
                        if (!isAccurate && !isInaccurate) {
                            fail(`${step.stepId} V${variant}: matches neither source wording`);
                        }
                        const shouldBeInaccurate = INACCURATE_ITEMS[condition][variant].includes(item);
                        if (shouldBeInaccurate !== isInaccurate) {
                            fail(`${step.stepId} V${variant}: expected ${shouldBeInaccurate ? "inaccurate" : "accurate"}, got the other`);
                        }
                        // accurate and inaccurate must actually differ, or the
                        // check above proves nothing.
                        if (isAccurate && isInaccurate) {
                            fail(`${subject}_aq_0${item}: the two source wordings are identical`);
                        }
                        const manifestSaysAccurate =
                            manifest[`${subject}_aq_0${item}`][condition].includes(variant);
                        if (manifestSaysAccurate !== isAccurate) {
                            fail(`${step.stepId} V${variant}: manifest disagrees with the file on disk`);
                        }
                    }
                }
            }
        }
    }
    console.log("generateHintVariants: design checks passed");
}

main();

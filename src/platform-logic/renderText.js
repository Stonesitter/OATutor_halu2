import React from "react";
import { InlineMath, BlockMath } from "react-katex";
import { dynamicText } from "../config/config.js";
import { variabilize, chooseVariables } from "./variabilize.js";
import Spacer from "@components/Spacer";
import ErrorBoundary from "@components/ErrorBoundary";
import RenderMedia from "@components/RenderMedia";
import { CONTENT_SOURCE } from "@common/global-config";

/**
 * Parses text and extracts inline and block LaTeX segments.
 * Supports:
 *   \(...\) inline math
 *   $...$ inline math
 *   $$...$$ inline math (for backward compatibility)
 *   \[...\] block math
 *   \begin{...}...\end{...} block math
 */
function splitPreservingMathBlocks(text) {
    const blockRegex =
        /(\\\[[\s\S]*?\\\])|(\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\})/g;

    let segments = [];
    let last = 0;
    let m;

    while ((m = blockRegex.exec(text)) !== null) {
        // Plain text before the block
        if (m.index > last) {
            const plain = text.slice(last, m.index);
            const plainLines = plain.split(/\r\n|\n|\\n/);
            for (const line of plainLines) segments.push(line);
        }

        // Entire math block: push as ONE unbroken segment
        segments.push(m[0]);

        last = blockRegex.lastIndex;
    }

    // Trailing plain text
    if (last < text.length) {
        const plain = text.slice(last);
        const plainLines = plain.split(/\r\n|\n|\\n/);
        for (const line of plainLines) segments.push(line);
    }

    return segments;  // IMPORTANT: do NOT filter empties
}

function parseMathSegments(text) {
    const segments = [];

    // Order matters: more specific patterns (begin/end, \[ \], \(\), $$, $) first.
    // Single backslashes in the *runtime* string are written as double here.
    const pattern =
	  /(\\\(([\s\S]*?)\\\))|(\${2}([\s\S]*?)\${2})|(\$(?!\$)([^$]+)\$)|(\\\[([\s\S]*?)\\\])|(\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\})/g;

    let lastIndex = 0;
    let match;

    while ((match = pattern.exec(text)) !== null) {
	// Plain text before this match
	if (match.index > lastIndex) {
	    segments.push({
		type: "text",
		value: text.slice(lastIndex, match.index),
	    });
	}

	if (match[1]) {
	    // \(...\) -> inline
	    segments.push({ type: "inline", value: match[2].trim() });
	} else if (match[3]) {
	    // $$...$$ -> inline
	    segments.push({ type: "inline", value: match[4].trim() });
	} else if (match[5]) {
	    // $...$ -> inline
	    segments.push({ type: "inline", value: match[6].trim() });
	} else if (match[7]) {
	    // \[...\] -> block
	    segments.push({ type: "block", value: match[8].trim() });
	} else if (match[9]) {
	    // \begin{...}...\end{...} -> block
	    segments.push({ type: "block", value: match[9].trim() });
	}

	lastIndex = pattern.lastIndex;
    }

    // Remaining trailing text
    if (lastIndex < text.length) {
	segments.push({ type: "text", value: text.slice(lastIndex) });
    }

    return segments;
}

/**
 * Renders author / spreadsheet text.
 */
function renderText(text, problemID, variabilization, context) {
    if (typeof text !== "string") return text;

    text = text.replaceAll("\\neq", "≠");
    text = text.replaceAll("**", "^");

    let result = parseForMetaVariables(text, context);

    for (const d in dynamicText) {
	result = result.split(d).join(dynamicText[d]);
    }

    if (variabilization) {
	result = variabilize(result, variabilization);
    }

    const lines = splitPreservingMathBlocks(result);



    return lines.map((line, idx) => {
	if (line.trim() === "") {
	    return (
		<div key={idx} style={{ marginBottom: "1em" }}>
		    {/* blank line */}
		</div>
	    );
	}

	const segments = parseMathSegments(line);

	let lineParts = segments.map((seg) => {
	    if (seg.type === "text") {
		const subParts = seg.value.split("##");
		return subParts.map((sp, kdx) => {
		    const isMedia = kdx % 2 !== 0;

		    if (isMedia) {
			return (
			    <center key={Math.random() * 2 ** 16}>
				<RenderMedia
				    url={sp}
				    problemID={problemID}
				    contentSource={CONTENT_SOURCE}
				/>
			    </center>
			);
		    }

		    return parseForFillInQuestions(sp);
		});
	    }

	    if (seg.type === "inline") {
		return (
		    <ErrorBoundary
			componentName={"InlineMath"}
			replacement={seg.value}
			inline
			key={Math.random() * 2 ** 16}
		    >
			<InlineMath
			    math={seg.value}
			    renderError={(error) => {
				throw error;
			    }}
			/>
		    </ErrorBoundary>
		);
	    }

	    if (seg.type === "block") {
		return (
		    <ErrorBoundary
			componentName={"BlockMath"}
			replacement={seg.value}
			inline={false}
			key={Math.random() * 2 ** 16}
		    >
			<BlockMath
			    math={seg.value}
			    renderError={(error) => {
				throw error;
			    }}
			/>
		    </ErrorBoundary>
		);
	    }

	    return null;
	});

	if (idx !== lines.length - 1) {
	    lineParts.push(
		<Spacer height={2} width={2} key={Math.random() * 2 ** 16} />
	    );
	}

	return (
	    <div key={idx} style={{ marginBottom: "0.75em" }}>
		{lineParts}
	    </div>
	);
    });
}

/**
 * Renders text generated from ChatGPT.
 */
function renderGPTText(text, problemID, variabilization, context) {
    if (typeof text !== "string") return text;

    text = preprocessChatGPTResponse(text);
    text = text.replaceAll("\\neq", "≠");
    text = text.replaceAll("**", "^");

    let result = parseForMetaVariables(text, context);

    for (const d in dynamicText) {
	result = result.split(d).join(dynamicText[d]);
    }

    if (variabilization) {
	result = variabilize(result, variabilization);
    }

    const lines = result.split(/\r\n|\n|\\n/g);


    return lines.map((line, idx) => {
	if (line.trim() === "") {
	    return (
		<div key={idx} style={{ marginBottom: "1em" }}>
		    {/* blank line */}
		</div>
	    );
	}

	const segments = parseMathSegments(line);

	let lineParts = segments.map((seg) => {
	    if (seg.type === "text") {
		const subParts = seg.value.split("##");
		return subParts.map((sp, kdx) => {
		    const isMedia = kdx % 2 !== 0;

		    if (isMedia) {
			return (
			    <center key={Math.random() * 2 ** 16}>
				<RenderMedia
				    url={sp}
				    problemID={problemID}
				    contentSource={CONTENT_SOURCE}
				/>
			    </center>
			);
		    }

		    return parseForFillInQuestions(sp);
		});
	    }

	    if (seg.type === "inline") {
		return (
		    <ErrorBoundary
			componentName={"InlineMath"}
			replacement={seg.value}
			inline
			key={Math.random() * 2 ** 16}
		    >
			<InlineMath
			    math={seg.value}
			    renderError={(error) => {
				throw error;
			    }}
			/>
		    </ErrorBoundary>
		);
	    }

	    if (seg.type === "block") {
		return (
		    <ErrorBoundary
			componentName={"BlockMath"}
			replacement={seg.value}
			inline={false}
			key={Math.random() * 2 ** 16}
		    >
			<BlockMath
			    math={seg.value}
			    renderError={(error) => {
				throw error;
			    }}
			/>
		    </ErrorBoundary>
		);
	    }

	    return null;
	});

	if (idx !== lines.length - 1) {
	    lineParts.push(
		<Spacer height={2} width={2} key={Math.random() * 2 ** 16} />
	    );
	}

	return (
	    <div key={idx} style={{ marginBottom: "0.75em" }}>
		{lineParts}
	    </div>
	);
    });
}

const META_REGEX = /%\{([^{}%"]+)}/g;

const mapper = {
    oats_user_id: (context) => context.userID,
};

/**
 * Replace %{variable} with metadata.
 */
function parseForMetaVariables(str, context) {
    return str.replaceAll(META_REGEX, (ogMatch, group1) => {
	if (group1 in mapper) {
	    return mapper[group1].call(this, context);
	}
	return ogMatch;
    });
}

function preprocessChatGPTResponse(input) {
    const mathBlockRegex =
        /(\\\[[\s\S]*?\\\])|(\\\([\s\S]*?\\\))|(\${2}[\s\S]*?\${2})|(\\begin\{[^}]+\}[\s\S]*?\\end\{[^}]+\})/g;

    let parts = [];
    let lastIndex = 0;
    let m;

    // Extract math blocks and mark them as "protected"
    while ((m = mathBlockRegex.exec(input)) !== null) {
        if (m.index > lastIndex) {
            let plain = input.slice(lastIndex, m.index);
            plain = plain.replace(/\n/g, "\\n"); // encode only plain-text newlines
            parts.push(plain);
        }

        parts.push(m[0]); // keep math block unchanged
        lastIndex = mathBlockRegex.lastIndex;
    }

    // trailing text
    if (lastIndex < input.length) {
        let plain = input.slice(lastIndex);
        plain = plain.replace(/\n/g, "\\n");
        parts.push(plain);
    }

    // Your money handling remains unchanged
    let result = parts.join("");

    const moneyRegex = /\$(\d{1,3}(,\d{3})*(\.\d{2})?|(\d+))/g;
    result = result.replace(moneyRegex, (_, moneyValue) => `\uFF04${moneyValue}`);
    result = result.replace(/\uFF04/g, "$");


    return result;
}


/**
 * Convert sequences of 3+ underscores to fill-in blanks.
 */
function parseForFillInQuestions(str) {
    const strParts = str.split(/_{3,}/);
    let result = [];

    strParts.forEach((part, idx) => {
	if (idx > 0) {
	    result.push(
		<span
		    key={Math.random() * 2 ** 16}
		    aria-label={"fill in the blank"}
		    style={{
			marginLeft: "0.5ch",
			marginRight: "0.5ch",
			paddingLeft: "2.5ch",
			paddingRight: "2.5ch",
			position: "relative",
			background: "rgb(242,243,244)",
			borderRadius: "0.6ch",
		    }}
		>
		    <div
			style={{
			    position: "absolute",
			    bottom: 3.5,
			    left: 4,
			    right: 4,
			    height: 1.5,
			    borderRadius: "0.6ch",
			    background: "rgb(75,76,77)",
			}}
		    />
		</span>
	    );
	}

	result.push(part);
    });

    return result;
}

export { renderText, renderGPTText, chooseVariables };

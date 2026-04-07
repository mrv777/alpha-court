// ── Types ──────────────────────────────────────────────────────────────

export interface Citation {
  endpoint: string;
  displayValue: string;
  startIndex: number;
  endIndex: number;
}

export interface ParsedCitations {
  cleanText: string;
  citations: Citation[];
}

export interface TextSegment {
  type: "text";
  content: string;
}

export interface CitationSegment {
  type: "citation";
  endpoint: string;
  displayValue: string;
}

export type StreamSegment = TextSegment | CitationSegment;

export interface StreamParseResult {
  segments: StreamSegment[];
  remainingBuffer: string;
}

// ── Full-text citation parser ──────────────────────────────────────────

const CITATION_RE = /\[\[cite:([^|]+)\|([^\]]*(?:\([^)]*\)[^\]]*)*)\]\]/g;

/**
 * Parse all [[cite:endpoint|displayValue]] citations from a complete text string.
 * Malformed citations (incomplete brackets) are left as-is in the clean text.
 */
export function parseCitations(text: string): ParsedCitations {
  if (!text) return { cleanText: "", citations: [] };

  const citations: Citation[] = [];
  let cleanText = "";
  let lastIndex = 0;

  for (const match of text.matchAll(CITATION_RE)) {
    const matchStart = match.index;
    const matchEnd = matchStart + match[0].length;

    // Text before this citation
    cleanText += text.slice(lastIndex, matchStart);

    const endpoint = match[1];
    const displayValue = match[2];

    citations.push({
      endpoint,
      displayValue,
      startIndex: cleanText.length,
      endIndex: cleanText.length + displayValue.length,
    });

    cleanText += displayValue;
    lastIndex = matchEnd;
  }

  // Remaining text after last citation
  cleanText += text.slice(lastIndex);

  return { cleanText, citations };
}

// ── Streaming citation parser ──────────────────────────────────────────

/**
 * Parse a streaming chunk combined with a buffer from previous chunks.
 * Returns parsed segments and any remaining buffer (incomplete citation).
 *
 * Handles:
 * - Complete citations within the chunk
 * - Partial citations at the end (buffered for next call)
 * - Malformed citations that can't be completed (rendered as bold text)
 * - Nested parens in display values
 */
export function parseCitationStream(
  chunk: string,
  buffer: string
): StreamParseResult {
  const input = buffer + chunk;
  const segments: StreamSegment[] = [];
  let pos = 0;

  while (pos < input.length) {
    const openBracket = input.indexOf("[[", pos);

    // No more potential citations — check if remaining text might start one
    if (openBracket === -1) {
      // Check if we're near the end and there's a single '[' that could be start of '[['
      const singleBracket = input.indexOf("[", pos);
      if (singleBracket !== -1 && singleBracket >= input.length - 1) {
        // Single '[' at end — buffer it
        if (singleBracket > pos) {
          segments.push({ type: "text", content: input.slice(pos, singleBracket) });
        }
        return { segments, remainingBuffer: input.slice(singleBracket) };
      }
      // No potential citations, emit rest as text
      if (pos < input.length) {
        segments.push({ type: "text", content: input.slice(pos) });
      }
      return { segments, remainingBuffer: "" };
    }

    // Emit text before the potential citation
    if (openBracket > pos) {
      segments.push({ type: "text", content: input.slice(pos, openBracket) });
    }

    // Check if this looks like a citation start: [[cite:
    const afterOpen = input.slice(openBracket);

    if (!afterOpen.startsWith("[[cite:")) {
      // Could be a partial "[[ci..." at the very end
      if (openBracket + afterOpen.length < 7 + openBracket && input.length - openBracket < 8) {
        // Might be a partial citation start at end of input — buffer it
        return { segments, remainingBuffer: input.slice(openBracket) };
      }
      // Not a citation pattern — emit "[" as text, advance by 1
      segments.push({ type: "text", content: "[" });
      pos = openBracket + 1;
      continue;
    }

    // Find the pipe separator
    const pipeIndex = input.indexOf("|", openBracket + 7);
    if (pipeIndex === -1) {
      // No pipe yet — might be incomplete, buffer from here
      return { segments, remainingBuffer: input.slice(openBracket) };
    }

    // Find closing ]]
    const closeBracket = input.indexOf("]]", pipeIndex + 1);
    if (closeBracket === -1) {
      // No closing brackets yet — buffer from the citation start
      return { segments, remainingBuffer: input.slice(openBracket) };
    }

    // We have a complete citation
    const endpoint = input.slice(openBracket + 7, pipeIndex);
    const displayValue = input.slice(pipeIndex + 1, closeBracket);

    segments.push({ type: "citation", endpoint, displayValue });
    pos = closeBracket + 2;
  }

  return { segments, remainingBuffer: "" };
}

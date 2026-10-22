/**
 * Message splitter utility
 * Splits a single bot response string into 1–3 short chat bubbles.
 */

const MAX_BUBBLES = 3;
const MAX_SEGMENT_CHARS = 200;

/**
 * Split a bot message into multiple short bubbles for display.
 * Rules:
 * 1. Split on paragraph breaks (\n\n)
 * 2. If any segment is still >200 chars, split at sentence boundary (. ! ?)
 * 3. Keep trailing question in its own bubble if preceded by a statement
 * 4. Collapse to max 3 bubbles by merging trailing segments
 */
export function splitBotMessage(text: string): string[] {
  if (!text.trim()) return [];

  // Step 1: Split on paragraph breaks
  let segments = text
    .split(/\n\n+/)
    .map(s => s.trim())
    .filter(Boolean);

  // Step 2: Further split any segment over max chars at sentence boundary
  const refined: string[] = [];
  for (const seg of segments) {
    if (seg.length <= MAX_SEGMENT_CHARS) {
      refined.push(seg);
    } else {
      const sentences = splitAtSentenceBoundary(seg);
      refined.push(...sentences);
    }
  }

  // Step 3: Separate trailing question from preceding statement (if combined in one segment)
  const withQSplit = separateTrailingQuestion(refined);

  // Step 4: Collapse to MAX_BUBBLES by merging overflow into last bubble
  if (withQSplit.length <= MAX_BUBBLES) return withQSplit;

  const capped = withQSplit.slice(0, MAX_BUBBLES - 1);
  const remainder = withQSplit.slice(MAX_BUBBLES - 1).join(' ');
  capped.push(remainder);
  return capped;
}

function splitAtSentenceBoundary(text: string): string[] {
  // Match sentence endings: . ! ? followed by space or end
  const sentenceRegex = /[.!?](?:\s+|$)/g;
  const parts: string[] = [];
  let last = 0;
  let current = '';
  let match: RegExpExecArray | null;

  while ((match = sentenceRegex.exec(text)) !== null) {
    const end = match.index + match[0].length;
    current += text.slice(last, end);
    last = end;

    if (current.trim().length > 0) {
      if (parts.length === 0 || current.length > MAX_SEGMENT_CHARS / 2) {
        // Enough content to form a bubble
        parts.push(current.trim());
        current = '';
      }
    }
  }

  // Remainder
  const tail = (current + text.slice(last)).trim();
  if (tail) {
    if (parts.length > 0 && tail.length < 60) {
      // Short tail — append to last bubble
      parts[parts.length - 1] += ' ' + tail;
    } else {
      parts.push(tail);
    }
  }

  return parts.length > 0 ? parts : [text];
}

function separateTrailingQuestion(segments: string[]): string[] {
  const result: string[] = [];

  for (const seg of segments) {
    // Check if segment ends with a question and has a preceding statement
    const questionSplit = seg.match(/^(.+?[.!])\s+([^.!]+\?)\s*$/s);
    if (questionSplit && questionSplit[1].length > 20 && questionSplit[2].length > 10) {
      result.push(questionSplit[1].trim());
      result.push(questionSplit[2].trim());
    } else {
      result.push(seg);
    }
  }

  return result;
}

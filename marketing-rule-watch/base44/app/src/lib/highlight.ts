// Grounding guarantees every span is an exact substring of its page, so `found: false`
// should never happen. The UI still handles it rather than showing a wrong highlight.

export type HighlightParts =
  | { found: true; before: string; match: string; after: string }
  | { found: false; text: string };

export function splitOnSpan(text: string, span: string): HighlightParts {
  const start = span ? text.indexOf(span) : -1;
  if (start < 0) return { found: false, text };
  return {
    found: true,
    before: text.slice(0, start),
    match: span,
    after: text.slice(start + span.length),
  };
}

export function truncate(text: string, maxLength = 160): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).trimEnd() + "…";
}

// Wraps a quote in curly quotes unless the span already carries its own quote marks.
export function quoted(span: string): string {
  return /^["“]/.test(span) ? span : `“${span}”`;
}

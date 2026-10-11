// Word-level diff (LCS) between a flagged quote and a suggested rewrite, for the rewrite drawer.
// Tokens are whitespace-separated words with punctuation kept attached ("returns." is one token).
// Returns two segment lists, one per side, with consecutive words of the same kind merged:
//   original:  [{type: "same"|"del", text}]   suggested: [{type: "same"|"add", text}]
// Returns null when either side has more than maxTokens words, so callers show plain text instead.

export const WORD_DIFF_MAX_TOKENS = 400;

export function tokenize(text) {
  return String(text ?? "").split(/\s+/).filter(Boolean);
}

function pushSegment(segments, type, word) {
  const last = segments[segments.length - 1];
  if (last && last.type === type) last.text += ` ${word}`;
  else segments.push({ type, text: word });
}

export function wordDiff(originalText, suggestedText, maxTokens = WORD_DIFF_MAX_TOKENS) {
  const a = tokenize(originalText);
  const b = tokenize(suggestedText);
  if (a.length > maxTokens || b.length > maxTokens) return null;

  // lcs[i][j] = length of the LCS of a[i:] and b[j:], stored row-major in one flat array.
  const width = b.length + 1;
  const lcs = new Uint16Array((a.length + 1) * width);
  for (let i = a.length - 1; i >= 0; i -= 1) {
    for (let j = b.length - 1; j >= 0; j -= 1) {
      lcs[i * width + j] =
        a[i] === b[j] ? lcs[(i + 1) * width + j + 1] + 1 : Math.max(lcs[(i + 1) * width + j], lcs[i * width + j + 1]);
    }
  }

  const original = [];
  const suggested = [];
  let i = 0;
  let j = 0;
  while (i < a.length && j < b.length) {
    if (a[i] === b[j]) {
      pushSegment(original, "same", a[i]);
      pushSegment(suggested, "same", b[j]);
      i += 1;
      j += 1;
    } else if (lcs[(i + 1) * width + j] >= lcs[i * width + j + 1]) {
      pushSegment(original, "del", a[i]);
      i += 1;
    } else {
      pushSegment(suggested, "add", b[j]);
      j += 1;
    }
  }
  for (; i < a.length; i += 1) pushSegment(original, "del", a[i]);
  for (; j < b.length; j += 1) pushSegment(suggested, "add", b[j]);
  return { original, suggested };
}

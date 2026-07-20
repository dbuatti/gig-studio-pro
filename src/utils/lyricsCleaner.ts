const MINOR_WORDS = new Set([
  'a', 'an', 'the', 'of', 'in', 'on', 'at', 'to', 'for',
  'and', 'or', 'but', 'by', 'with', 'from', 'is', 'it',
]);

function looksLikeSuggestion(line: string): boolean {
  if (/^\[.*\]$/.test(line)) return false;
  if (line.length > 50) return false;
  const words = line.split(/\s+/);
  if (words.length > 8) return false;
  return words.every(w => {
    if (!w) return true;
    if (/^[A-Z][a-z']/.test(w)) return true;
    if (/^[A-Z]+$/.test(w)) return true;
    if (MINOR_WORDS.has(w.toLowerCase())) return true;
    return false;
  });
}

export function cleanLyrics(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let skipSuggestions = false;

  for (const raw of lines) {
    const line = raw.trim();

    if (/^you might also like/i.test(line)) {
      skipSuggestions = true;
      continue;
    }

    if (skipSuggestions) {
      if (!line) continue;
      if (/^\[.*\]$/.test(line)) {
        skipSuggestions = false;
      } else if (looksLikeSuggestion(line)) {
        continue;
      } else {
        skipSuggestions = false;
      }
    }

    if (!line) {
      if (result.length > 0 && result[result.length - 1] !== '') result.push('');
      continue;
    }

    if (/^see\s+.+\s+(live|tour)/i.test(line)) continue;
    if (/^get tickets/i.test(line)) continue;
    if (/^\d+\s*(embed|share)/i.test(line)) continue;
    if (/^(embed|share|url:)/i.test(line)) continue;
    if (/^lyrics$/i.test(line)) continue;
    if (/\$/.test(line)) continue;

    if (/^(writer|publisher|label|producer|album|released)/i.test(line) && /:/.test(line)) continue;

    result.push(line);
  }

  // strip trailing suggestion-like lines (promos after last section)
  let lastSectionIdx = -1;
  for (let i = result.length - 1; i >= 0; i--) {
    if (/^\[.*\]$/.test(result[i])) {
      lastSectionIdx = i;
      break;
    }
  }
  if (lastSectionIdx >= 0) {
    while (result.length > lastSectionIdx + 1 && looksLikeSuggestion(result[result.length - 1])) {
      result.pop();
    }
    // also drop trailing blank lines before the cut
    while (result.length > lastSectionIdx + 1 && result[result.length - 1] === '') {
      result.pop();
    }
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

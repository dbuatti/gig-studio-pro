export function cleanLyrics(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let afterSuggestions = false;

  for (const raw of lines) {
    const line = raw.trim();

    // strip everything from "You might also like" onward
    if (/^you might also like/i.test(line)) {
      afterSuggestions = true;
      continue;
    }
    if (afterSuggestions) continue;

    if (!line) {
      if (result.length > 0 && result[result.length - 1] !== '') result.push('');
      continue;
    }

    // known promotional / interstitial lines
    if (/^see\s+.+\s+(live|tour)/i.test(line)) continue;
    if (/^get tickets/i.test(line)) continue;
    if (/^\d+\s*(embed|share)/i.test(line)) continue;
    if (/^(embed|share|url:)/i.test(line)) continue;
    if (/^lyrics$/i.test(line)) continue;
    if (/\$/.test(line)) continue;

    // metadata lines
    if (/^(writer|publisher|label|producer|album|released)/i.test(line) && /:/.test(line)) continue;

    result.push(line);
  }

  return result.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

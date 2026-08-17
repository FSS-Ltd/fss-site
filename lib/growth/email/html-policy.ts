function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

export function escapeEmailHtmlText(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function emailHtmlVisibleText(value: string): string {
  return value
    .replace(/<[^>]*>/g, " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

export function hasCanonicalEmailHtmlText(html: string, text: string): boolean {
  return canonicalEmailHtmlTextRange(html, text) !== null;
}

export function removeCanonicalEmailHtmlText(
  html: string,
  text: string,
): string | null {
  const range = canonicalEmailHtmlTextRange(html, text);
  if (!range) return null;
  return html.slice(0, range.from) + html.slice(range.to);
}

function canonicalEmailHtmlTextRange(
  html: string,
  text: string,
): { from: number; to: number } | null {
  if (!text) return null;

  const fragments = Array.from(new Set([escapeEmailHtmlText(text), text]));
  const tags = html.matchAll(/<[^>]*>/g);
  let cursor = 0;
  for (const tag of tags) {
    const tagStart = tag.index ?? 0;
    const range = findFragmentRange(html, cursor, tagStart, fragments, text);
    if (range) return range;
    cursor = tagStart + tag[0].length;
  }
  return findFragmentRange(html, cursor, html.length, fragments, text);
}

function findFragmentRange(
  html: string,
  from: number,
  to: number,
  fragments: readonly string[],
  expectedText: string,
): { from: number; to: number } | null {
  const segment = html.slice(from, to);
  for (const fragment of fragments) {
    const offset = segment.indexOf(fragment);
    if (offset !== -1 && emailHtmlVisibleText(fragment) === expectedText) {
      return { from: from + offset, to: from + offset + fragment.length };
    }
  }
  return null;
}

export function countTextOccurrences(value: string, needle: string): number {
  if (!needle) return 0;

  let count = 0;
  let cursor = 0;
  while ((cursor = value.indexOf(needle, cursor)) !== -1) {
    count += 1;
    cursor += needle.length;
  }
  return count;
}

export function isSafeEmailHtml(value: string): boolean {
  const tags = value.matchAll(/<[^>]*>/g);
  let cursor = 0;

  for (const match of tags) {
    const index = match.index ?? 0;
    if (/[<>]/.test(value.slice(cursor, index))) {
      return false;
    }

    const tag = match[0];
    const isPlainFormattingTag =
      /^<\/?(?:a|em|li|ol|p|strong|ul)>$/i.test(tag) ||
      /^<br\s*\/?>$/i.test(tag);
    const anchor = tag.match(/^<a href=(["'])([^"'<>]+)\1>$/i);

    if (!isPlainFormattingTag && (!anchor || !isHttpUrl(anchor[2]))) {
      return false;
    }

    cursor = index + tag.length;
  }

  return !/[<>]/.test(value.slice(cursor));
}

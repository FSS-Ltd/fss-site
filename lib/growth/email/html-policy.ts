function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
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

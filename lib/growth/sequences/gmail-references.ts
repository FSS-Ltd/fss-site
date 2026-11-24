export type GmailReferences =
  | { kind: "missing" | "malformed" | "over_limit" }
  | { kind: "valid"; ids: readonly string[] };

// This deliberately accepts only the common unquoted RFC message-ID form.
// Other valid but unsupported forms are uncertain, never partial matches.
const MESSAGE_ID =
  /^<[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~.]+@[A-Za-z0-9!#$%&'*+\-/=?^_`{|}~.]+>$/;

export function parseGmailReferences(
  inReplyTo: string | null,
  references: string | null,
): GmailReferences {
  const headers = [inReplyTo, references].filter(
    (value): value is string => value !== null,
  );
  if (headers.length === 0) return { kind: "missing" };
  if (headers.reduce((size, value) => size + value.length, 0) > 16 * 1024)
    return { kind: "over_limit" };
  if (
    headers.reduce(
      (size, value) => size + new TextEncoder().encode(value).length,
      0,
    ) >
    16 * 1024
  )
    return { kind: "over_limit" };
  const ids: string[] = [];
  let count = 0;
  for (const header of headers) {
    const unfolded = header.replace(/\r\n(?=[ \t])/g, "");
    if (!unfolded.trim() || /[^\x20-\x7e\t]/.test(unfolded))
      return { kind: "malformed" };
    for (const token of unfolded.trim().split(/[ \t]+/)) {
      if (++count > 100) return { kind: "over_limit" };
      if (
        !MESSAGE_ID.test(token) ||
        token.startsWith("<.") ||
        token.includes("..") ||
        token.includes(".@") ||
        token.includes("@.") ||
        token.includes(".>")
      )
        return { kind: "malformed" };
      if (!ids.includes(token)) ids.push(token);
    }
  }
  return { kind: "valid", ids };
}

// PDFKit's bundled Helvetica uses WinAnsi. Reject unsupported characters before
// an approval or consent exists; never silently replace a person's name or terms.
export const SIGNING_TEXT_PATTERN =
  /^[\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff\u0152\u0153\u0160\u0161\u0178\u017d\u017e\u0192\u02c6\u02dc\u2013\u2014\u2018-\u201a\u201c-\u201e\u2020-\u2022\u2026\u2030\u2039\u203a\u20ac]*$/;
export const SIGNING_TEXT_ERROR =
  "This signing PDF supports Western European characters. Use the manual signing workflow for names or terms in another script.";
export function supportsSigningText(value: unknown): boolean {
  if (typeof value === "string") return SIGNING_TEXT_PATTERN.test(value);
  if (Array.isArray(value)) return value.every(supportsSigningText);
  if (value && typeof value === "object")
    return Object.values(value).every(supportsSigningText);
  return true;
}

const NAMED_ENTITIES: Record<string, string> = {
  colon: ":",
  tab: "\t",
  newline: "\n",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  sol: "/",
  bsol: "\\",
};

/** Returns null for an entity we do not understand, so callers refuse it. */
function decodeEntities(value: string): string | null {
  let unknown = false;
  const decoded = value.replace(
    /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|([A-Za-z][A-Za-z0-9]*));/g,
    (_match, dec?: string, hex?: string, name?: string) => {
      if (dec || hex) {
        const code = dec ? Number(dec) : parseInt(hex as string, 16);
        return code <= 0x10ffff ? String.fromCodePoint(code) : "";
      }
      const known = NAMED_ENTITIES[(name as string).toLowerCase()];
      if (known === undefined) unknown = true;
      return known ?? "";
    },
  );
  return unknown ? null : decoded;
}

/**
 * Allows http, https, mailto and site-relative paths (one leading slash, no
 * backslash). `allowFragment` additionally permits "#anchor" for rendering
 * trusted MDX files; API writes do not allow it.
 */
export function isSafeLinkDestination(
  raw: string,
  { allowFragment = false }: { allowFragment?: boolean } = {},
): boolean {
  const decoded = decodeEntities(raw.replace(/\\(?=[!-/:-@[-`{-~])/g, ""));
  if (decoded === null) return false;
  // Browsers ignore whitespace and control characters inside a scheme.
  const value = decoded.replace(/[\u0000- \u007f-\u009f]/g, "");
  if (!value) return false;
  if (/^(https?:|mailto:)/i.test(value)) return true;
  if (allowFragment && value.startsWith("#")) return true;
  return /^\/(?![/\\])/.test(value) && !value.includes("\\");
}

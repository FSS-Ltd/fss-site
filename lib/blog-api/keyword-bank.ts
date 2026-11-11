import fs from "node:fs";
import path from "node:path";

export type KeywordBankEntry = { phrase: string; status: string };

export const KEYWORD_BANK_PATH = path.join(
  process.cwd(),
  "docs",
  "seo",
  "keyword-bank.md",
);

const HEADING = /^#{1,6}\s+high-intent keywords\s*$/i;
const ANY_HEADING = /^#{1,6}\s+/;

function cells(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((cell) => cell.trim());
}

export function normalisePhrase(value: string): string {
  return value.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Reads the "High-intent keywords" table: first column phrase, last column status. */
export function parseKeywordBank(markdown: string): KeywordBankEntry[] {
  const entries: KeywordBankEntry[] = [];
  let inSection = false;

  for (const line of markdown.split(/\r?\n/)) {
    if (HEADING.test(line)) {
      inSection = true;
      continue;
    }
    if (inSection && ANY_HEADING.test(line)) break;
    if (!inSection || !line.trim().startsWith("|")) continue;

    const row = cells(line);
    const phrase = row[0] ?? "";
    // Skip the header row and the |---|---| separator.
    if (!phrase || /^-+$/.test(phrase.replace(/[:\s]/g, ""))) continue;
    if (normalisePhrase(phrase) === "phrase") continue;
    entries.push({
      phrase,
      status: normalisePhrase(row[row.length - 1] ?? ""),
    });
  }

  return entries;
}

/** Returns null when the bank is not present, so callers can skip the check. */
export function readKeywordBank(
  filePath: string = KEYWORD_BANK_PATH,
): KeywordBankEntry[] | null {
  let text: string;
  try {
    text = fs.readFileSync(filePath, "utf8");
  } catch {
    return null;
  }
  const entries = parseKeywordBank(text);
  return entries.length > 0 ? entries : null;
}

/** Without a bank only a non-empty keyword is required. */
export function isKnownKeyword(
  bank: readonly KeywordBankEntry[] | null,
  keyword: string,
): boolean {
  const wanted = normalisePhrase(keyword);
  if (!wanted) return false;
  if (!bank) return true;
  return bank.some((entry) => normalisePhrase(entry.phrase) === wanted);
}

import type { GmailMessageMetadata } from "./types";

const MAILBOX =
  /^[A-Za-z0-9.!#$%&'*+\/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?$/;

function splitMailboxes(header: string): string[] | null {
  const parts: string[] = [];
  let start = 0;
  let quoted = false;
  let escaped = false;
  let angled = false;
  for (let i = 0; i < header.length; i++) {
    const char = header[i];
    if (!char || /[\x00-\x1f\x7f]/.test(char)) return null;
    if (escaped) {
      escaped = false;
      continue;
    }
    if (quoted && char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      if (angled) return null;
      quoted = !quoted;
      continue;
    }
    if (quoted) continue;
    if (char === "<") {
      if (angled) return null;
      angled = true;
      continue;
    }
    if (char === ">") {
      if (!angled) return null;
      angled = false;
      continue;
    }
    if (char === ":" || char === ";" || char === "(" || char === ")")
      return null;
    if (char === "," && !angled) {
      parts.push(header.slice(start, i));
      start = i + 1;
    }
  }
  if (quoted || escaped || angled) return null;
  parts.push(header.slice(start));
  return parts;
}

export function countGmailRecipients(
  message: Pick<GmailMessageMetadata, "to" | "cc" | "bcc">,
): number | null {
  let count = 0;
  for (const header of [message.to, message.cc, message.bcc]) {
    if (header === null) continue;
    const parts = splitMailboxes(header);
    if (!parts) return null;
    for (const part of parts) {
      const value = part.trim();
      const left = value.indexOf("<");
      const right = value.indexOf(">");
      let address = value;
      if (left !== -1 || right !== -1) {
        if (
          left <= 0 ||
          right !== value.length - 1 ||
          value.indexOf("<", left + 1) !== -1 ||
          value.indexOf(">", right + 1) !== -1 ||
          value.slice(0, left).includes("@")
        )
          return null;
        address = value.slice(left + 1, right);
      }
      const [local, domain] = address.split("@");
      if (
        address.length > 254 ||
        !MAILBOX.test(address) ||
        !local ||
        !domain ||
        local.startsWith(".") ||
        local.endsWith(".") ||
        address.includes("..")
      )
        return null;
      count++;
    }
  }
  return count > 0 ? count : null;
}

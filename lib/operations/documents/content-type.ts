import type { DocumentMimeType } from "./types";

export function matchesDocumentContentType(
  bytes: Uint8Array,
  mimeType: DocumentMimeType,
): boolean {
  const startsWith = (signature: number[]) =>
    signature.every((value, index) => bytes[index] === value);
  if (mimeType === "image/png")
    return (
      bytes.length >= 20 &&
      startsWith([137, 80, 78, 71, 13, 10, 26, 10]) &&
      [73, 69, 78, 68, 174, 66, 96, 130].every(
        (value, index) => bytes[bytes.length - 8 + index] === value,
      )
    );
  if (mimeType === "image/jpeg")
    return (
      bytes.length >= 5 &&
      startsWith([255, 216, 255]) &&
      bytes.at(-2) === 255 &&
      bytes.at(-1) === 217
    );
  if (mimeType === "application/pdf") {
    const head = new TextDecoder().decode(bytes.subarray(0, 12));
    const tail = new TextDecoder().decode(
      bytes.subarray(Math.max(0, bytes.length - 32)),
    );
    return /^%PDF-[12]\.\d/.test(head) && /%%EOF\s*$/.test(tail);
  }
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    return (
      !/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(text) &&
      !/^\s*(?:<!doctype\s+html\b|<html\b|<svg\b|<script\b|<\?xml\b|MZ|#!)/i.test(
        text,
      )
    );
  } catch {
    return false;
  }
}

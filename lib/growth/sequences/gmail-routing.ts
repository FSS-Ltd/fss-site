import type { GmailReferences } from "./gmail-references";
import type { ThreadMatch } from "./gmail-thread-association";

export type ReferenceCandidate = {
  sequenceId: string;
  connectionId: string | null;
  channel: string;
  identityConflict: boolean;
};
export type GmailRouting = ThreadMatch | { kind: "uncertain" };

export function gmailFromAddress(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/<([^>]+)>/);
  const candidate = (match ? match[1] : header).trim().toLowerCase();
  return candidate || null;
}

// Reference evidence can censor or contradict a thread match, never authorize it.
export function assessGmailRouting(input: {
  thread: ThreadMatch;
  references: GmailReferences;
  candidates: readonly ReferenceCandidate[];
  candidatesOverflow: boolean;
  possibleExposure: boolean;
  contactSignal: boolean;
  connectionId: string;
}): GmailRouting {
  if (input.thread.kind === "ambiguous" || input.candidatesOverflow)
    return { kind: "ambiguous" };
  if (
    input.references.kind === "malformed" ||
    input.references.kind === "over_limit"
  )
    return { kind: "uncertain" };
  const sequences = new Set(
    input.candidates.map((candidate) => candidate.sequenceId),
  );
  if (
    sequences.size > 1 ||
    input.candidates.some(
      (candidate) =>
        candidate.identityConflict ||
        candidate.channel !== "gmail" ||
        (candidate.connectionId !== null &&
          candidate.connectionId !== input.connectionId),
    )
  )
    return { kind: "ambiguous" };
  if (input.thread.kind === "unique" || input.thread.kind === "unknown") {
    if (sequences.size && !sequences.has(input.thread.enrollment.id))
      return { kind: "ambiguous" };
    if (
      input.thread.kind === "unknown" &&
      (sequences.size || input.possibleExposure || input.contactSignal)
    )
      return { ...input.thread, safeToPause: false };
    return input.thread;
  }
  return sequences.size || input.possibleExposure || input.contactSignal
    ? { kind: "uncertain" }
    : { kind: "none" };
}

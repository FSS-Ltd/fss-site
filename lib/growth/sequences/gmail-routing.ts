import type { GmailReferences } from "./gmail-references";
import type {
  ExactReplyAttribution,
  ThreadEnrollment,
  ThreadMatch,
} from "./gmail-thread-association";

export type ReferenceCandidate = {
  sequenceId: string;
  connectionId: string | null;
  channel: string;
  identityConflict: boolean;
  reservationId?: string | null;
};
export type ProvenReference = {
  enrollment: ThreadEnrollment;
  attribution: ExactReplyAttribution;
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
  proven?: readonly ProvenReference[];
}): GmailRouting {
  if (input.thread.kind === "ambiguous" || input.candidatesOverflow)
    return { kind: "ambiguous" };
  if (
    input.references.kind === "malformed" ||
    input.references.kind === "over_limit"
  )
    return { kind: "uncertain" };
  const proven = input.proven ?? [];
  if (input.thread.kind === "unique") {
    const threadSequenceId = input.thread.enrollment.id;
    if (
      proven.some((candidate) => candidate.enrollment.id !== threadSequenceId)
    )
      return { kind: "ambiguous" };
  } else if (proven.length > 1) return { kind: "ambiguous" };
  const exact = proven[0];
  if (
    exact &&
    input.references.kind === "valid" &&
    input.thread.kind !== "unique"
  ) {
    if (
      input.thread.kind === "unknown" &&
      input.thread.enrollment.id !== exact.enrollment.id
    )
      return { kind: "ambiguous" };
    if (
      input.candidates.some(
        (candidate) =>
          candidate.identityConflict ||
          candidate.sequenceId !== exact.enrollment.id ||
          candidate.reservationId !== exact.attribution.reservationId,
      )
    )
      return { kind: "ambiguous" };
    return {
      kind: "unique",
      enrollment: exact.enrollment,
      attribution: exact.attribution,
    };
  }
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

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
  inReplyTo?: GmailReferences;
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
  } else if (proven.length > 1) {
    const reply = input.inReplyTo;
    if (
      input.references.kind !== "valid" ||
      reply?.kind !== "valid" ||
      reply.ids.length !== 1
    )
      return { kind: "ambiguous" };
    const referenceIds = input.references.ids;
    const direct = proven.filter(
      (item) => item.attribution.rfcMessageId === reply.ids[0],
    );
    const selected = direct[0];
    if (
      direct.length !== 1 ||
      !selected ||
      selected.attribution.outboundProvider !== "resend" ||
      (input.thread.kind === "unknown" &&
        input.thread.enrollment.id !== selected.enrollment.id)
    )
      return { kind: "ambiguous" };
    const reservationIds = new Set(
      proven.map((item) => item.attribution.reservationId),
    );
    const rfcs = new Set(proven.map((item) => item.attribution.rfcMessageId));
    const connectionIds = new Set(
      input.candidates.map((candidate) => candidate.connectionId),
    );
    if (
      reservationIds.size !== proven.length ||
      rfcs.size !== proven.length ||
      connectionIds.size !== 1 ||
      connectionIds.has(null) ||
      proven.some(
        (item) =>
          item.enrollment.id !== selected.enrollment.id ||
          item.enrollment.contactId !== selected.enrollment.contactId ||
          item.enrollment.prospectId !== selected.enrollment.prospectId ||
          item.attribution.outboundProvider !==
            selected.attribution.outboundProvider ||
          item.attribution.connectionId !== selected.attribution.connectionId ||
          item.attribution.googleSubject !==
            selected.attribution.googleSubject ||
          item.attribution.grantEpoch !== selected.attribution.grantEpoch ||
          item.attribution.recipient !== selected.attribution.recipient ||
          !referenceIds.includes(item.attribution.rfcMessageId) ||
          !input.candidates.some(
            (candidate) =>
              candidate.reservationId === item.attribution.reservationId,
          ),
      ) ||
      input.candidates.some(
        (candidate) =>
          candidate.identityConflict ||
          candidate.sequenceId !== selected.enrollment.id ||
          candidate.channel !== "resend" ||
          !candidate.reservationId ||
          !reservationIds.has(candidate.reservationId),
      )
    )
      return { kind: "ambiguous" };
    return {
      kind: "unique",
      enrollment: selected.enrollment,
      attribution: selected.attribution,
    };
  }
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

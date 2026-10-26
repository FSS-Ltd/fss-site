import { escapeEmailHtmlText } from "../email/html-policy";
import { findEmailOptOut } from "../email/copy-policy";
import { globalFirstEmailSchema } from "../research/global-schema";
import { InvalidFirstEmailRevisionContentError } from "./edit-first-email";
import { researchEmailSnapshotSchema } from "./research-email-snapshot";
import type { StoredFirstEmailDraft } from "./first-email-draft-snapshot";
import {
  type FirstEmailRevisionTransaction,
  type FounderFirstEmailRevision,
  type ReviseFirstEmailDraftInput,
} from "./first-email-revisions";
import { FirstEmailRevisionError } from "./first-email-revision-errors";

export async function reviseResearchEmailDraft(
  tx: FirstEmailRevisionTransaction,
  draft: StoredFirstEmailDraft,
  input: ReviseFirstEmailDraftInput,
  now: Date,
): Promise<FounderFirstEmailRevision> {
  const parsed = researchEmailSnapshotSchema.safeParse(draft.outputSnapshot);
  if (!parsed.success)
    throw new FirstEmailRevisionError("invalid_stored_draft");
  const stored = parsed.data;
  if (
    draft.status !== "completed" ||
    draft.hasEnrollment ||
    stored.reviewState !== "research_only"
  )
    throw new FirstEmailRevisionError("not_editable");
  if (stored.draftVersion !== input.expectedVersion)
    throw new FirstEmailRevisionError("version_conflict");
  if (stored.draftVersion >= 100)
    throw new FirstEmailRevisionError("revision_limit_reached");
  const paragraphs = input.paragraphs.map((part) => part.trim());
  if (
    !paragraphs.length ||
    paragraphs.length > 20 ||
    paragraphs.some(
      (part) =>
        !part ||
        part.length > 2000 ||
        /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(part),
    )
  )
    throw new InvalidFirstEmailRevisionContentError(
      "Draft paragraphs are invalid.",
    );
  const text = paragraphs.join("\n\n");
  const optOutSentence = findEmailOptOut(text);
  const email = globalFirstEmailSchema.safeParse({
    subject: input.subject,
    text,
    wordCount: text.split(/\s+/).length,
    html: paragraphs
      .map(
        (part) =>
          `<p>${escapeEmailHtmlText(part).replaceAll("\n", "<br>")}</p>`,
      )
      .join(""),
    optOutSentence,
  });
  if (!email.success)
    throw new InvalidFirstEmailRevisionContentError(
      "Use a subject, safe copy and a clear opt-out.",
    );
  const version = stored.draftVersion + 1;
  const editedAt = now.toISOString();
  await tx.saveDraftRevision({
    draftTaskId: draft.id,
    outputSnapshot: {
      ...stored,
      email: email.data,
      draftVersion: version,
      emailRevisions: [
        ...stored.emailRevisions,
        {
          version,
          editorActorId: input.founder.actorId,
          editedAt,
          email: email.data,
        },
      ],
    },
  });
  await tx.appendRevisionAudit({
    draftTaskId: draft.id,
    actorId: input.founder.actorId,
    correlationId: input.correlationId,
  });
  return { draftTaskId: draft.id, version, editedAt, email: email.data };
}

"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { useState } from "react";

const TERMINAL_PROSPECT_STATUSES = new Set([
  "won",
  "lost",
  "rejected",
  "suppressed",
]);

export type PreviewApprovalState = {
  compositionDigest: string | null;
  generationPrNumber: number | null;
  generationStatus: string | null;
  status: string;
  version: number;
};

type PreviewApprovalFrameProps = {
  onSuccess: () => void;
  preview: PreviewApprovalState | null;
  prospectId: string;
  prospectStatus: string;
  prospectVersion: number;
};

function describeSourcePackageStatus(preview: PreviewApprovalState): string {
  switch (preview.generationStatus) {
    case "merged_draft":
      return "Source package is merged and ready for approval.";
    case "pr_open":
      return preview.generationPrNumber === null
        ? "Source package is awaiting PR merge. You can still request changes."
        : `Source package is awaiting PR #${preview.generationPrNumber} merge. You can still request changes.`;
    case "pending_pr":
      return "Source package is waiting to be generated.";
    case "composition_unavailable":
      return "This prospect needs a bespoke source package before it can be approved.";
    default:
      return "This concept is not yet backed by a reviewable source package.";
  }
}

export function PreviewApprovalFrame({
  onSuccess,
  preview,
  prospectId,
  prospectStatus,
  prospectVersion,
}: PreviewApprovalFrameProps) {
  const [pending, setPending] = useState(false);
  const [feedback, setFeedback] = useState<{
    tone: "conflict" | "error";
    message: string;
  } | null>(null);
  const [changeNotes, setChangeNotes] = useState("");
  const [changeRequestPending, setChangeRequestPending] = useState(false);
  const [changeRequestFeedback, setChangeRequestFeedback] = useState<string | null>(
    null,
  );

  if (!preview) {
    return (
      <p className="text-sm text-slate-500">
        No private concept is ready for founder approval yet.
      </p>
    );
  }

  if (preview.status === "published") {
    return (
      <p className="text-sm leading-6 text-slate-700">
        <span className="mr-2 inline-block rounded-full bg-teal-50 px-2.5 py-1 text-xs font-semibold text-teal-700">
          Preview published
        </span>
        The first-email
        draft now includes the private concept link for review.
      </p>
    );
  }

  if (preview.status !== "draft") {
    return (
      <p className="text-sm text-slate-500">
        This private concept is no longer available for approval.
      </p>
    );
  }

  const terminal = TERMINAL_PROSPECT_STATUSES.has(prospectStatus);
  const draftPreview = preview;
  const sourcePackageReady =
    draftPreview.generationStatus === "merged_draft" &&
    draftPreview.compositionDigest !== null;
  const canRequestChanges =
    draftPreview.compositionDigest !== null &&
    (draftPreview.generationStatus === "pr_open" ||
      draftPreview.generationStatus === "merged_draft");

  const sourcePackageStatus = describeSourcePackageStatus(draftPreview);

  async function approve(): Promise<void> {
    setPending(true);
    setFeedback(null);
    try {
      const response = await fetch(
        `/api/growth/prospects/${prospectId}/preview/approve`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            expectedProspectVersion: prospectVersion,
            expectedPreviewVersion: draftPreview.version,
          }),
        },
      );
      if (response.ok) {
        onSuccess();
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      setFeedback({
        tone: response.status === 409 ? "conflict" : "error",
        message:
          body?.message ??
          "The private concept could not be approved. Refresh and try again.",
      });
    } catch {
      setFeedback({
        tone: "error",
        message:
          "The private concept could not be approved. Check your connection and try again.",
      });
    } finally {
      setPending(false);
    }
  }

  async function requestChanges(): Promise<void> {
    if (!draftPreview.compositionDigest || !changeNotes.trim()) return;

    setChangeRequestPending(true);
    setChangeRequestFeedback(null);
    try {
      const response = await fetch(
        `/api/growth/prospects/${prospectId}/preview/change-request`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            compositionDigest: draftPreview.compositionDigest,
            notes: changeNotes.trim(),
          }),
        },
      );
      if (response.ok) {
        setChangeNotes("");
        setChangeRequestFeedback(
          "Change request saved against this source package.",
        );
        onSuccess();
        return;
      }

      const body = (await response.json().catch(() => null)) as
        | { message?: string }
        | null;
      setChangeRequestFeedback(
        body?.message ?? "The change request could not be saved. Try again.",
      );
    } catch {
      setChangeRequestFeedback(
        "The change request could not be saved. Check your connection and try again.",
      );
    } finally {
      setChangeRequestPending(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="basis-full text-sm leading-6 text-slate-600">
        Approval publishes this private concept and refreshes the stored
        first-email draft. It does not create a provider draft or send email.
      </p>
      <p className="basis-full text-sm leading-6 text-slate-600">
        {sourcePackageStatus}
      </p>
      {feedback && (
        <p
          className={
            feedback.tone === "conflict"
              ? "basis-full text-sm text-amber-700"
              : "basis-full text-sm text-red-700"
          }
          role="alert"
        >
          {feedback.message}
        </p>
      )}
      <button
        className="rounded-md bg-teal-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
        disabled={terminal || pending || !sourcePackageReady}
        onClick={approve}
        type="button"
      >
        {pending ? "Approving preview…" : "Approve preview"}
      </button>
      <Link
        href={`/growth/prospects/${prospectId}/preview`}
        style={{
          alignItems: "center",
          border: "1px solid #087f88",
          borderRadius: 7,
          color: "#087f88",
          display: "inline-flex",
          fontSize: "0.8rem",
          fontWeight: 700,
          padding: "7px 12px",
          whiteSpace: "nowrap",
        }}
      >
        View concept preview
      </Link>
      {terminal && (
        <p className="basis-full text-sm text-slate-500">
          This prospect is in a final state and cannot publish a concept.
        </p>
      )}
      {canRequestChanges && (
        <div className="basis-full space-y-2 border-t border-slate-200 pt-4">
          <label
            className="block text-sm font-semibold text-slate-700"
            htmlFor={`preview-change-notes-${prospectId}`}
          >
            Suggest changes
          </label>
          <textarea
            className="min-h-24 w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-900"
            id={`preview-change-notes-${prospectId}`}
            maxLength={2000}
            name="preview-change-notes"
            onChange={(event) => setChangeNotes(event.target.value)}
            placeholder="Describe what you would change in this concept."
            value={changeNotes}
          />
          {changeRequestFeedback && (
            <p className="text-sm text-slate-600" role="status">
              {changeRequestFeedback}
            </p>
          )}
          <button
            className="rounded-md border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-50 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={changeRequestPending || !changeNotes.trim()}
            onClick={requestChanges}
            type="button"
          >
            {changeRequestPending ? "Saving changes…" : "Request changes"}
          </button>
        </div>
      )}
    </div>
  );
}

export function PreviewApproval(
  props: Omit<PreviewApprovalFrameProps, "onSuccess">,
) {
  const router = useRouter();
  return <PreviewApprovalFrame {...props} onSuccess={() => router.refresh()} />;
}

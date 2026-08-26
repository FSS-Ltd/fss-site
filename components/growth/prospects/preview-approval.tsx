"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const TERMINAL_PROSPECT_STATUSES = new Set([
  "won",
  "lost",
  "rejected",
  "suppressed",
]);

export type PreviewApprovalState = {
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

  return (
    <div className="flex flex-wrap items-center gap-3">
      <p className="basis-full text-sm leading-6 text-slate-600">
        Approval publishes this private concept and refreshes the stored
        first-email draft. It does not create a provider draft or send email.
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
        disabled={terminal || pending}
        onClick={approve}
        type="button"
      >
        {pending ? "Approving preview…" : "Approve preview"}
      </button>
      {terminal && (
        <p className="basis-full text-sm text-slate-500">
          This prospect is in a final state and cannot publish a concept.
        </p>
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

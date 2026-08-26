import Link from "next/link";

import type {
  FounderDraftProspectPreviewSummary,
} from "@/lib/growth/prospect-previews/founder-review";
import type { ViewState } from "@/lib/growth/dashboard/view-models";

import { PreviewApproval } from "./preview-approval";

export function FounderPreviewList({
  state,
}: {
  state: ViewState<readonly FounderDraftProspectPreviewSummary[]>;
}) {
  if (state.status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900" role="alert">
        <p>{state.message}</p>
        <p className="mt-2 text-sm text-red-700">Reference: {state.correlationId}</p>
      </div>
    );
  }

  if (state.status === "empty") {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-slate-700">
        {state.reason}
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">Founder review</p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
            Concept previews
          </h1>
          <p className="mt-2 max-w-2xl text-slate-600">
            Review each private site concept before it is published for a prospect.
          </p>
        </div>
        <Link className="text-sm font-semibold text-teal-800 underline underline-offset-4" href="/growth/prospects">
          Back to prospects
        </Link>
      </div>

      <p className="text-sm text-slate-600">
        {state.data.length} {state.data.length === 1 ? "preview is" : "previews are"} awaiting review.
      </p>

      <ul className="grid gap-4" aria-label="Private concept previews">
        {state.data.map((preview) => (
          <li className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm" key={preview.prospectId}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-950">{preview.businessName}</h2>
                <p className="mt-1 text-sm text-slate-600">Draft website concept, ready for founder review.</p>
              </div>
              <Link
                className="rounded-md border border-teal-700 px-3 py-2 text-sm font-semibold text-teal-800 transition hover:bg-teal-50"
                href={`/growth/prospects/${preview.prospectId}/preview`}
              >
                View concept preview
              </Link>
            </div>
            <div className="mt-5 border-t border-slate-100 pt-5">
              <PreviewApproval
                preview={{ status: "draft", version: preview.previewVersion }}
                prospectId={preview.prospectId}
                prospectStatus={preview.prospectStatus}
                prospectVersion={preview.prospectVersion}
              />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

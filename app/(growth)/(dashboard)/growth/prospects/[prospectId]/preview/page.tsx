import { notFound } from "next/navigation";

import { FounderDraftProspectPreview } from "@/components/prospect-previews/production-prospect-preview";
import { getFounderDraftProspectPreview } from "@/lib/growth/prospect-previews/founder-review";

type FounderDraftPreviewPageProps = {
  params: Promise<{ prospectId: string }>;
};

export default async function FounderDraftPreviewPage({
  params,
}: FounderDraftPreviewPageProps) {
  const { prospectId } = await params;
  const result = await getFounderDraftProspectPreview(prospectId);

  if (result.status === "not_found") notFound();

  if (result.status === "error") {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-900" role="alert">
        <p>{result.message}</p>
        <p className="mt-2 text-sm text-red-700">Reference: {result.correlationId}</p>
      </div>
    );
  }

  return <FounderDraftProspectPreview content={result.data.content} />;
}

import { FounderPreviewList } from "@/components/growth/prospects/founder-preview-list";
import { getFounderDraftProspectPreviewSummaries } from "@/lib/growth/prospect-previews/founder-review";

export default async function FounderPreviewListPage() {
  const state = await getFounderDraftProspectPreviewSummaries();
  return <FounderPreviewList state={state} />;
}

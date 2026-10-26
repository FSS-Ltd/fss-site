import { requireFounder } from "@/lib/growth/auth/require-founder";
import { getGrowthDb } from "@/lib/growth/db/client";
import { getSavedCrmViews } from "@/lib/growth/crm/workspace-query";
import { PipelineBoard } from "@/components/growth/pipeline/pipeline-board";
import {
  getPipelineBoardResult,
  parsePipelineBoardQuery,
} from "@/lib/growth/dashboard/pipeline";

type PipelinePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PipelinePage({
  searchParams,
}: PipelinePageProps) {
  const query = parsePipelineBoardQuery(await searchParams);
  const founder = await requireFounder();
  const [state, savedViews] = await Promise.all([
    getPipelineBoardResult(query),
    getSavedCrmViews(getGrowthDb(), founder.actorId),
  ]);

  return (
    <PipelineBoard
      savedViews={savedViews}
      now={new Date().toISOString()}
      query={query}
      state={state}
    />
  );
}

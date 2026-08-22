import { PipelineBoard } from "@/components/growth/pipeline/pipeline-board";
import {
  getPipelineBoardResult,
  parsePipelineBoardQuery,
} from "@/lib/growth/dashboard/pipeline";

type PipelinePageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function PipelinePage({ searchParams }: PipelinePageProps) {
  const query = parsePipelineBoardQuery(await searchParams);
  const state = await getPipelineBoardResult(query);

  return (
    <PipelineBoard now={new Date().toISOString()} query={query} state={state} />
  );
}

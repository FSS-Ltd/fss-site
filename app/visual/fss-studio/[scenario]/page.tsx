import { notFound } from "next/navigation";
import { resolveVisualScenario } from "./visual-scenarios";

export const dynamic = "force-dynamic";

export default async function FssStudioVisualScenarioPage({
  params,
}: Readonly<{
  params: Promise<{ scenario: string }>;
}>): Promise<React.JSX.Element> {
  const visual = resolveVisualScenario(
    (await params).scenario,
    process.env.FSS_VISUAL_TESTS_ENABLED === "true",
    process.env.NODE_ENV,
  );
  if (!visual) notFound();
  return visual.content;
}

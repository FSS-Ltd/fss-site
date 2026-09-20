import { notFound } from "next/navigation";
import { portalFont } from "@/components/portal/portal-font";
import styles from "@/components/portal/portal-theme.module.css";
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
  return (
    <div className={`${portalFont.variable} ${styles.theme}`}>
      {visual.content}
    </div>
  );
}

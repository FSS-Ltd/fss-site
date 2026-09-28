import { ClerkProvider } from "@clerk/nextjs";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { portalFont } from "@/components/portal/portal-font";
import styles from "@/components/portal/portal-theme.module.css";
import {
  isPortalAppearance,
  PORTAL_APPEARANCE_COOKIE,
} from "@/lib/operations/design/portal-appearance";
import { resolveVisualScenario } from "./visual-scenarios";

export const dynamic = "force-dynamic";

// Visual fixtures render portal shells outside the portal route group's provider.
// This is a valid, non-secret development publishable key for the test-only route.
const VISUAL_CLERK_PUBLISHABLE_KEY =
  "pk_test_Zm9vLWJhci0xLmNsZXJrLmFjY291bnRzLmRldiQ";

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
  const appearanceCookie = (await cookies()).get(
    PORTAL_APPEARANCE_COOKIE,
  )?.value;
  const appearance = isPortalAppearance(appearanceCookie)
    ? appearanceCookie
    : "system";
  return (
    <ClerkProvider publishableKey={VISUAL_CLERK_PUBLISHABLE_KEY}>
      <div
        className={`${portalFont.variable} ${styles.theme} portal-theme`}
        data-appearance={appearance}
      >
        {visual.content}
      </div>
    </ClerkProvider>
  );
}

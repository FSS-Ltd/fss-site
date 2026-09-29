import { StudioShell } from "@/components/portal/shell/studio-shell";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import { fssStudioEnabled } from "@/lib/operations/auth/release-flags";
import {
  isPortalAppearance,
  PORTAL_APPEARANCE_COOKIE,
} from "@/lib/operations/design/portal-appearance";

async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  if (!fssStudioEnabled()) notFound();
  const appearanceCookie = (await cookies()).get(
    PORTAL_APPEARANCE_COOKIE,
  )?.value;
  const initialAppearance = isPortalAppearance(appearanceCookie)
    ? appearanceCookie
    : "system";
  return (
    <StudioShell initialAppearance={initialAppearance}>{children}</StudioShell>
  );
}

export default AdminLayout;

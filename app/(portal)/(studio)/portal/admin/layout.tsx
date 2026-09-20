import { StudioShell } from "@/components/portal/shell/studio-shell";
import { notFound } from "next/navigation";
import { fssStudioEnabled } from "@/lib/operations/auth/release-flags";

function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}): React.JSX.Element {
  if (!fssStudioEnabled()) notFound();
  return <StudioShell>{children}</StudioShell>;
}

export default AdminLayout;

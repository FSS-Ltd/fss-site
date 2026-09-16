import { StudioShell } from "@/components/portal/studio-shell";

export default function AdminLayout({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <StudioShell>{children}</StudioShell>;
}

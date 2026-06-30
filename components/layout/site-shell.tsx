import type { ReactNode } from "react";

import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { FssInteractions } from "@/components/redesign/fss-interactions";

type SiteShellProps = {
  children: ReactNode;
};

export function SiteShell({ children }: SiteShellProps) {
  return (
    <div
      id="fssroot"
      className="relative min-h-screen overflow-x-hidden bg-[#f2f3f5] text-[#0a1a2e]"
    >
      <FssInteractions />
      <SiteHeader />
      <main>{children}</main>
      <SiteFooter />
    </div>
  );
}

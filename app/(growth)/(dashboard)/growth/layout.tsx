import { redirect } from "next/navigation";

import { enforceFounderDashboardAccess } from "@/lib/growth/auth/dashboard-access";
import { requireFounder } from "@/lib/growth/auth/require-founder";

export default async function GrowthDashboardLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await enforceFounderDashboardAccess(requireFounder, redirect);

  return children;
}

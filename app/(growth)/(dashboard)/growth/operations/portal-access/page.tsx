import { redirect } from "next/navigation";
import { requireFounder } from "@/lib/growth/auth/require-founder";

export default async function PortalAccessPage(): Promise<never> {
  await requireFounder();
  redirect("/growth/operations");
}

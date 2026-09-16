import { notFound, redirect } from "next/navigation";
import { z } from "zod";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import type { VerifiedPortalIdentity } from "@/lib/operations/auth/types";
import { portalPath } from "./portal-url";

export async function getPortalPageContext(organisation: unknown): Promise<{
  identity: VerifiedPortalIdentity;
  organisationId: string;
} | null> {
  if (!portalAuthConfigured()) return null;
  const parsed = z.uuid().safeParse(organisation);
  if (!parsed.success) notFound();
  let identity: VerifiedPortalIdentity | null;
  try {
    identity = await getPortalIdentity();
  } catch {
    return null;
  }
  if (!identity) redirect(portalPath("/portal/login"));
  return { identity, organisationId: parsed.data };
}

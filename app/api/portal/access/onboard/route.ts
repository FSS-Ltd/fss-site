import { createPortalOnboardingHandler } from "./handler";
import { portalAuthConfigured } from "@/lib/operations/auth/configuration";
import { completePortalOnboarding } from "@/lib/operations/auth/pending-invitations";
import { getPortalIdentity } from "@/lib/operations/auth/server";
import { getPortalDb } from "@/lib/operations/db/portal-client";
import { resolvePortalOrigin } from "@/lib/operations/auth/configuration";

export const runtime = "nodejs";

const defaultDependencies = {
  configured: portalAuthConfigured,
  origin: resolvePortalOrigin,
  identity: getPortalIdentity,
  db: getPortalDb,
  complete: completePortalOnboarding,
};

export const POST = createPortalOnboardingHandler(defaultDependencies);

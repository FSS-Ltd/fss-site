import { portalPath } from "@/lib/operations/auth/portal-url";

export function resolvePortalClaimDestination(result: unknown): string {
  if (!result || typeof result !== "object" || !("active" in result)) {
    throw new Error(
      "Your account was created, but portal access is not active yet.",
    );
  }
  if (result.active === true) return portalPath("/portal");
  if (
    result.active === false &&
    "onboardingRequired" in result &&
    result.onboardingRequired === true
  ) {
    return portalPath("/portal/onboarding");
  }
  throw new Error(
    "Your account was created, but portal access is not active yet.",
  );
}

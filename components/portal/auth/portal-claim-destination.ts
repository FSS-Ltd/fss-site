import type { PortalClaimDestinations } from "@/lib/operations/auth/portal-claim-destinations";

export type { PortalClaimDestinations } from "@/lib/operations/auth/portal-claim-destinations";

export const defaultPortalClaimDestinations: PortalClaimDestinations = {
  admin: "/admin",
  home: "/",
  onboarding: "/onboarding",
};

export function resolvePortalClaimDestination(
  result: unknown,
  destinations: PortalClaimDestinations = defaultPortalClaimDestinations,
): string {
  if (!result || typeof result !== "object" || !("active" in result)) {
    throw new Error(
      "Your account was created, but portal access is not active yet.",
    );
  }
  if (result.active === true) {
    if ("destination" in result && result.destination === "admin")
      return destinations.admin;
    return destinations.home;
  }
  if (
    result.active === false &&
    "onboardingRequired" in result &&
    result.onboardingRequired === true
  ) {
    return destinations.onboarding;
  }
  throw new Error(
    "Your account was created, but portal access is not active yet.",
  );
}

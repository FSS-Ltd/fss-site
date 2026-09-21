import { portalPath } from "./portal-url";
import {
  fssStudioEnabled,
  prefixFreePortalEnabled,
} from "./release-flags";

export type PortalClaimDestinations = Readonly<{
  admin: string;
  home: string;
  onboarding: string;
}>;

/** Resolve post-claim destinations without bypassing the Studio release gate. */
export function getPortalClaimDestinations(
  studioEnabled: boolean = fssStudioEnabled(),
  prefixFreeEnabled: boolean = prefixFreePortalEnabled(),
): PortalClaimDestinations {
  const home = portalPath("/portal", prefixFreeEnabled);

  return {
    admin: studioEnabled ? portalPath("/admin", prefixFreeEnabled) : home,
    home,
    onboarding: portalPath("/portal/onboarding", prefixFreeEnabled),
  };
}

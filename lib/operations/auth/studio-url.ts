import { resolvePortalOrigin } from "./configuration";
import { portalUrl } from "./portal-url";
import { prefixFreePortalEnabled } from "./release-flags";

/** Resolve a Studio destination on the isolated portal hostname. */
export function fssStudioUrl(
  path: string,
  origin: string = resolvePortalOrigin(),
  prefixFreeEnabled: boolean = prefixFreePortalEnabled(),
): string {
  return portalUrl(path, origin, prefixFreeEnabled).href;
}

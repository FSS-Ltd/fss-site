export const PORTAL_APPEARANCE_COOKIE = "fss-portal-appearance";

export type PortalAppearance = "system" | "light" | "dark";

export function isPortalAppearance(
  value: string | undefined,
): value is PortalAppearance {
  return value === "system" || value === "light" || value === "dark";
}

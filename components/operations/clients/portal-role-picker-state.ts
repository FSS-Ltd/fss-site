import type { PortalRole } from "@/lib/operations/auth/types";

type PortalRoleHelpEvent =
  | "focus"
  | "activate"
  | "hover"
  | "blur"
  | "mouse_leave"
  | "escape";

export function getPortalRoleHelpExpandedRole(
  role: PortalRole,
  event: PortalRoleHelpEvent,
  hasFocus = false,
  expandedRole: PortalRole | null = role,
): PortalRole | null {
  if (event === "blur" || event === "escape") return null;
  if (event === "mouse_leave") {
    if (expandedRole !== role) return expandedRole;
    return hasFocus ? role : null;
  }

  return role;
}

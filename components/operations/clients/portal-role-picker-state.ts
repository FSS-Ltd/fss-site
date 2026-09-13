import type { PortalRole } from "@/lib/operations/auth/types";

type PortalRoleHelpEvent =
  | "focus"
  | "activate"
  | "hover"
  | "blur"
  | "mouse_leave";

export function getPortalRoleHelpExpandedRole(
  role: PortalRole,
  event: PortalRoleHelpEvent,
): PortalRole | null {
  if (event === "blur" || event === "mouse_leave") return null;

  return role;
}

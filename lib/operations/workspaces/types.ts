import { z } from "zod";
import type { PortalRole } from "../auth/types";
import type { ClientDocument } from "../documents/types";

export type PortalWorkspaceDocument = ClientDocument & {
  projectTitle: string;
};

export type PortalTeamMember = {
  name: string;
  role: PortalRole;
  joinedAt: string;
};

export type PortalNotification = {
  id: string;
  kind: string;
  title: string;
  body: string;
  requestId: string;
  requestVersion: number;
  createdAt: string;
  readAt: string | null;
};

export const portalNotificationFilterSchema = z.enum([
  "all",
  "unread",
  "action_needed",
]);

export type PortalNotificationFilter = z.infer<
  typeof portalNotificationFilterSchema
>;

export function parsePortalNotificationFilter(
  value: unknown,
): PortalNotificationFilter {
  if (Array.isArray(value))
    throw new Error("Only one notification filter is allowed.");
  return portalNotificationFilterSchema.parse(value ?? "all");
}

export type PortalNotificationPreferences = {
  requestEmailEnabled: boolean;
};

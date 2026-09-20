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

export type PortalNotificationFilter = "all" | "unread";

export type PortalNotificationPreferences = {
  requestEmailEnabled: boolean;
};

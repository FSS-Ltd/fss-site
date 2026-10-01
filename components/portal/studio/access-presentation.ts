import type {
  StudioPortalAccessEntry,
  StudioPortalAccessOverview,
} from "@/lib/operations/studio/portal-access";
import { getPortalRolePresentation } from "@/lib/operations/auth/permissions";
import { portalPath } from "@/lib/operations/auth/portal-url";

export const accessStateLabels: Record<
  StudioPortalAccessEntry["state"],
  string
> = {
  active: "Active",
  pending: "Invitation pending",
  expired: "Expired",
  provider_failed: "Delivery failed",
  revoked: "Revoked",
  inactive: "Client inactive",
};

export function accessStateTone(
  state: StudioPortalAccessEntry["state"],
): "success" | "info" | "error" | "neutral" | "warning" {
  if (state === "active") return "success";
  if (state === "pending") return "info";
  if (state === "expired" || state === "provider_failed") return "error";
  return state === "revoked" ? "neutral" : "warning";
}

export function accessRole(role: StudioPortalAccessEntry["role"]): {
  label: string;
  detail: string;
} {
  return role === "admin"
    ? {
        label: "FSS admin",
        detail:
          "FSS operations across client organisations. Staff access is managed by the founder.",
      }
    : getPortalRolePresentation(role);
}

export function accessDate(
  value: string | null,
  timezone = "Europe/London",
): string {
  if (!value) return "Not recorded";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime())
    ? "Date unavailable"
    : new Intl.DateTimeFormat("en-GB", {
        dateStyle: "medium",
        timeZone: timezone,
      }).format(parsed);
}

export function accessPageHref(
  data: Pick<StudioPortalAccessOverview, "query" | "state" | "view">,
  page = 1,
): string {
  const search = new URLSearchParams({ page: String(page), view: data.view });
  if (data.query) search.set("query", data.query);
  if (data.state) search.set("state", data.state);
  return portalPath(`/portal/admin/portal-access?${search.toString()}`);
}

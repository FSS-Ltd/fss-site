import type {
  RequestScope,
  RequestStatus,
} from "@/lib/operations/requests/types";

export const statusLabels: Record<RequestStatus, string> = {
  new: "New",
  acknowledged: "Acknowledged",
  planned: "Planned",
  in_progress: "In progress",
  ready_for_review: "Ready for review",
  changes_requested: "Changes requested",
  done: "Done",
  cancelled: "Cancelled",
};
export const scopeLabels: Record<RequestScope, string> = {
  included: "Included",
  assessment_pending: "Scope being assessed",
  quote_required: "Quote required",
  declined_with_reason: "Declined",
};

export function requestHref(id: string, organisationId: string): string {
  return `/portal/requests/${encodeURIComponent(id)}?organisationId=${encodeURIComponent(organisationId)}`;
}

export function requestDate(value: string | null): string {
  if (!value) return "To be agreed";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "To be agreed"
    : new Intl.DateTimeFormat("en-GB", {
        day: "numeric",
        month: "short",
        year: "numeric",
        timeZone: "Europe/London",
      }).format(date);
}

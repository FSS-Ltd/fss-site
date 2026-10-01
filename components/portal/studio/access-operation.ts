import type {
  StaffPortalAccessOperation,
  StaffPortalAccessOutcome,
} from "@/lib/operations/studio/portal-access";

export async function sendAccessOperation(
  operation: StaffPortalAccessOperation,
): Promise<StaffPortalAccessOutcome> {
  const response = await fetch("/api/portal/admin/portal-access", {
    body: JSON.stringify(operation),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body &&
      typeof body === "object" &&
      "error" in body &&
      typeof body.error === "string"
        ? body.error
        : "The access outcome could not be confirmed. Refresh before trying again.";
    throw new Error(message);
  }
  const expected = operation.action.startsWith("revoke_") ? "revoked" : "sent";
  if (
    !body ||
    typeof body !== "object" ||
    !("status" in body) ||
    body.status !== expected
  )
    throw new Error(
      "The access outcome could not be confirmed. Refresh before trying again.",
    );
  return { status: expected };
}

export type ResearchDraftResponse = {
  status?: "sent" | "pending" | "failed" | "cancelled";
  sequenceEnrollmentId?: string;
};

export async function postResearchDraftAction(
  path: string,
  body: object,
): Promise<ResearchDraftResponse> {
  const response = await fetch(path, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      payload &&
      typeof payload === "object" &&
      "message" in payload &&
      typeof payload.message === "string"
        ? payload.message
        : "The action failed. Reload to check the latest state before retrying.";
    throw new Error(message);
  }
  if (!payload || typeof payload !== "object") return {};
  return {
    status:
      "status" in payload &&
      (payload.status === "sent" ||
        payload.status === "pending" ||
        payload.status === "failed" ||
        payload.status === "cancelled")
        ? payload.status
        : undefined,
    sequenceEnrollmentId:
      "sequenceEnrollmentId" in payload &&
      typeof payload.sequenceEnrollmentId === "string"
        ? payload.sequenceEnrollmentId
        : undefined,
  };
}

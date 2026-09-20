import { resolvePortalClaimDestination } from "./portal-claim-destination";

const claimRetryDelayMs = 250;
const claimAttempts = 3;

type ClaimRequest = () => Promise<Response>;
type Wait = (milliseconds: number) => Promise<void>;
type ClaimFailureOutcome = "session_pending" | "access_denied" | "unavailable";

const wait: Wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function inactiveAccessError(): Error {
  return new Error("Portal access is not active yet.");
}

function readFailureOutcome(result: unknown): ClaimFailureOutcome | null {
  if (!result || typeof result !== "object" || !("outcome" in result))
    return null;
  const { outcome } = result;
  return outcome === "session_pending" ||
    outcome === "access_denied" ||
    outcome === "unavailable"
    ? outcome
    : null;
}

function claimFailureError(outcome: ClaimFailureOutcome | null): Error {
  if (outcome === "access_denied")
    return new Error(
      "Your invitation has expired or portal access is unavailable. Ask FSS for a new invitation.",
    );
  if (outcome === "unavailable")
    return new Error(
      "Portal access is temporarily unavailable. Try again in a moment.",
    );
  if (outcome === "session_pending")
    return new Error(
      "Your secure session is still starting. Please try again in a moment.",
    );
  return inactiveAccessError();
}

export async function claimPortalAccess(
  displayNameOrRequest: string | undefined | ClaimRequest,
  requestOrPause?: ClaimRequest | Wait,
  suppliedPause?: Wait,
): Promise<string> {
  const displayName =
    typeof displayNameOrRequest === "string" ? displayNameOrRequest : undefined;
  const request: ClaimRequest =
    typeof displayNameOrRequest === "function"
      ? displayNameOrRequest
      : typeof requestOrPause === "function"
        ? (requestOrPause as ClaimRequest)
        : () =>
    fetch("/api/portal/access/claim", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
  const pause: Wait =
    typeof displayNameOrRequest === "function"
      ? (requestOrPause as Wait | undefined) ?? wait
      : suppliedPause ?? wait;
  for (let attempt = 1; attempt <= claimAttempts; attempt += 1) {
    const response = await request();
    const result: unknown = await response.json().catch(() => null);
    if (response.ok) return resolvePortalClaimDestination(result);
    const outcome = readFailureOutcome(result);
    if (
      response.status !== 401 ||
      outcome !== "session_pending" ||
      attempt === claimAttempts
    )
      throw claimFailureError(outcome);
    await pause(claimRetryDelayMs);
  }
  throw inactiveAccessError();
}

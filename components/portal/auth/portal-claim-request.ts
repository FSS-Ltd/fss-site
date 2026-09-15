import { resolvePortalClaimDestination } from "./portal-claim-destination";

const claimRetryDelayMs = 250;
const claimAttempts = 3;

type ClaimRequest = () => Promise<Response>;
type Wait = (milliseconds: number) => Promise<void>;

const wait: Wait = (milliseconds) =>
  new Promise((resolve) => setTimeout(resolve, milliseconds));

function inactiveAccessError(): Error {
  return new Error("Portal access is not active yet.");
}

export async function claimPortalAccess(
  request: ClaimRequest = () =>
    fetch("/api/portal/access/claim", { method: "POST" }),
  pause: Wait = wait,
): Promise<string> {
  for (let attempt = 1; attempt <= claimAttempts; attempt += 1) {
    const response = await request();
    const result: unknown = await response.json().catch(() => null);
    if (response.ok) return resolvePortalClaimDestination(result);
    if (response.status !== 401 || attempt === claimAttempts)
      throw inactiveAccessError();
    await pause(claimRetryDelayMs);
  }
  throw inactiveAccessError();
}

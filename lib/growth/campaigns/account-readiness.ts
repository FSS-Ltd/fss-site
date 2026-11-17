type AuthenticationCheck = {
  status: "pass" | "fail" | "unknown";
  source: string;
};
export type AccountReadinessSnapshot = {
  identity: {
    connected: boolean;
    subjectMatches: boolean;
    grantMatches: boolean;
    scopesValid: boolean;
  };
  limits: {
    observedAt: Date;
    expiresAt: Date;
    messages: number;
    recipients: [number, number, number, number];
    perMessage: number;
    messageReserve: number;
    recipientReserve: number;
  } | null;
  health: {
    observedFrom: Date;
    observedUntil: Date;
    expiresAt: Date;
    complete: boolean;
    verdict: "healthy" | "unhealthy" | "unknown";
    sends: number | null;
    attempts: number | null;
    hardBounces: number | null;
    complaints: number | null;
    rateIncidents: number | null;
    authIncidents: number | null;
    authentication: {
      spf: AuthenticationCheck;
      dkim: AuthenticationCheck;
      dmarc: AuthenticationCheck;
    };
  } | null;
  usage: {
    capturedAt: Date;
    expiresAt: Date;
    complete: boolean;
    grantMatches: boolean;
    messages: number | null;
    recipients: number | null;
  } | null;
};
type Decision = { status: "ready" } | { status: "held"; reason: string };
const day = 24 * 60 * 60 * 1000;
const validTime = (date: Date) => Number.isFinite(date.getTime());
const count = (value: number | null): value is number =>
  value !== null && Number.isSafeInteger(value) && value >= 0;
export function assessAccountReadiness(
  snapshot: AccountReadinessSnapshot,
  now: Date,
): Decision {
  const held = (reason: string): Decision => ({ status: "held", reason });
  if (!validTime(now)) return held("invalid_time");
  const { identity, limits, health, usage } = snapshot;
  if (
    !identity.connected ||
    !identity.subjectMatches ||
    !identity.grantMatches ||
    !identity.scopesValid
  )
    return held("identity_or_grant_unknown");
  if (
    !limits ||
    !validTime(limits.observedAt) ||
    !validTime(limits.expiresAt) ||
    limits.observedAt > now ||
    limits.expiresAt <= now ||
    limits.expiresAt.getTime() > limits.observedAt.getTime() + 30 * day ||
    !Number.isSafeInteger(limits.messages) ||
    limits.messages <= 0 ||
    limits.recipients.length !== 4 ||
    limits.recipients.some((n) => !Number.isSafeInteger(n) || n <= 0) ||
    !Number.isSafeInteger(limits.perMessage) ||
    limits.perMessage <= 0 ||
    !Number.isSafeInteger(limits.messageReserve) ||
    limits.messageReserve < 50 ||
    !count(limits.recipientReserve)
  )
    return held("limits_unknown");
  if (
    !health ||
    !validTime(health.observedFrom) ||
    !validTime(health.observedUntil) ||
    !validTime(health.expiresAt) ||
    health.observedFrom >= health.observedUntil ||
    health.observedUntil > now ||
    health.observedUntil.getTime() < now.getTime() - day ||
    health.expiresAt <= now ||
    health.expiresAt.getTime() > health.observedUntil.getTime() + day ||
    !health.complete ||
    health.verdict !== "healthy" ||
    !count(health.sends) ||
    !count(health.attempts) ||
    health.sends <= 0 ||
    health.attempts < health.sends ||
    !count(health.hardBounces) ||
    !count(health.complaints) ||
    !count(health.rateIncidents) ||
    !count(health.authIncidents) ||
    !health.authentication ||
    [
      health.authentication.spf,
      health.authentication.dkim,
      health.authentication.dmarc,
    ].some(
      (check) => !check || check.status !== "pass" || !check.source.trim(),
    ) ||
    health.hardBounces +
      health.complaints +
      health.rateIncidents +
      health.authIncidents !==
      0
  )
    return held("health_unknown");
  if (
    !usage ||
    !validTime(usage.capturedAt) ||
    !validTime(usage.expiresAt) ||
    usage.capturedAt > now ||
    usage.capturedAt.getTime() < now.getTime() - 5 * 60 * 1000 ||
    usage.expiresAt <= now ||
    !usage.complete ||
    !usage.grantMatches ||
    !count(usage.messages) ||
    !count(usage.recipients)
  )
    return held("usage_unknown");
  if (
    usage.messages + limits.messageReserve >= limits.messages ||
    usage.recipients + limits.recipientReserve >= Math.min(...limits.recipients)
  )
    return held("quota_exhausted");
  return { status: "ready" };
}

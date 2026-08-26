export const ANALYTICS_CONSENT_STORAGE_KEY = "fss.analytics-consent";
export const ANALYTICS_CONSENT_COOKIE_NAME = "fss_analytics_consent";
export const ANALYTICS_CONSENT_VERSION = "1";
export const ANALYTICS_CONSENT_DURATION_MS = 365 * 24 * 60 * 60 * 1_000;
export const ANALYTICS_SETTINGS_EVENT = "fss:open-cookie-settings";
export const ANALYTICS_CONSENT_CHANGED_EVENT = "fss:analytics-consent-changed";

export type AnalyticsConsentChoice = "accepted" | "rejected";

export type AnalyticsConsent = {
  version: typeof ANALYTICS_CONSENT_VERSION;
  choice: AnalyticsConsentChoice;
  decidedAt: number;
  expiresAt: number;
};

export function createAnalyticsConsent(
  choice: AnalyticsConsentChoice,
  now = Date.now(),
): AnalyticsConsent {
  return {
    version: ANALYTICS_CONSENT_VERSION,
    choice,
    decidedAt: now,
    expiresAt: now + ANALYTICS_CONSENT_DURATION_MS,
  };
}

export function parseAnalyticsConsent(
  value: string | null,
  now = Date.now(),
): AnalyticsConsent | null {
  if (!value) return null;

  try {
    const candidate: unknown = JSON.parse(value);

    if (
      typeof candidate !== "object" ||
      candidate === null ||
      !("version" in candidate) ||
      candidate.version !== ANALYTICS_CONSENT_VERSION ||
      !("choice" in candidate) ||
      (candidate.choice !== "accepted" && candidate.choice !== "rejected") ||
      !("decidedAt" in candidate) ||
      typeof candidate.decidedAt !== "number" ||
      !Number.isFinite(candidate.decidedAt) ||
      !("expiresAt" in candidate) ||
      typeof candidate.expiresAt !== "number" ||
      !Number.isFinite(candidate.expiresAt) ||
      candidate.expiresAt <= candidate.decidedAt ||
      candidate.expiresAt <= now
    ) {
      return null;
    }

    return candidate as AnalyticsConsent;
  } catch {
    return null;
  }
}

export function shouldLoadAnalytics(consent: AnalyticsConsent | null): boolean {
  return consent?.choice === "accepted";
}

export function shouldDisableAnalytics(
  consent: AnalyticsConsent | null,
): boolean {
  return !shouldLoadAnalytics(consent);
}

export function resolveSessionAnalyticsConsent(
  consent: AnalyticsConsent,
  persisted: boolean,
): AnalyticsConsent | null {
  return persisted ? null : consent;
}

export function getAnalyticsCookieNames(cookieHeader: string): string[] {
  return cookieHeader
    .split(";")
    .map((cookie) => cookie.split("=", 1)[0]?.trim() ?? "")
    .filter((name) => /^_ga(?:_|$)/.test(name));
}

export function createAnalyticsConsentCookie(
  serializedConsent: string,
  secure: boolean,
): string {
  const secureAttribute = secure ? "; Secure" : "";

  return `${ANALYTICS_CONSENT_COOKIE_NAME}=${encodeURIComponent(serializedConsent)}; Max-Age=31536000; path=/; SameSite=Lax${secureAttribute}`;
}

export function resolveAnalyticsConsentValue(
  cookieHeader: string,
  localStorageValue: string | null,
): string | null {
  const cookiePrefix = `${ANALYTICS_CONSENT_COOKIE_NAME}=`;
  const consentCookie = cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(cookiePrefix));

  if (!consentCookie) return localStorageValue;

  try {
    return decodeURIComponent(consentCookie.slice(cookiePrefix.length));
  } catch {
    return localStorageValue;
  }
}

export function getAnalyticsCookieDomains(
  hostname: string,
): readonly (string | null)[] {
  if (!hostname.includes(".")) return [null];

  const domains: (string | null)[] = [null, `.${hostname}`];
  const canonicalDomain = "faithfulsoftware.dev";

  if (
    hostname !== canonicalDomain &&
    hostname.endsWith(`.${canonicalDomain}`)
  ) {
    domains.push(`.${canonicalDomain}`);
  }

  return domains;
}

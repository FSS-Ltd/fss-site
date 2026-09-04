import {
  ANALYTICS_CONSENT_STORAGE_KEY,
  parseAnalyticsConsent,
  resolveAnalyticsConsentValue,
  shouldLoadAnalytics,
} from "./consent";

export function contactEvent(serializedConsent: string | null) {
  if (!shouldLoadAnalytics(parseAnalyticsConsent(serializedConsent)))
    return null;
  return {
    name: "generate_lead",
    parameters: { source_context: "contact-page-v2", source_path: "/contact" },
  };
}

export function trackContactSuccess(): void {
  if (typeof window === "undefined") return;
  let storedConsent: string | null = null;
  try {
    storedConsent = window.localStorage.getItem(ANALYTICS_CONSENT_STORAGE_KEY);
  } catch {
    // Use the preference cookie when browser storage is unavailable.
  }
  const event = contactEvent(
    resolveAnalyticsConsentValue(document.cookie, storedConsent),
  );
  const gtag: unknown = Reflect.get(window, "gtag");
  if (event && typeof gtag === "function") {
    try {
      Reflect.apply(gtag, window, ["event", event.name, event.parameters]);
    } catch {
      // Optional analytics must never turn an accepted enquiry into an error.
    }
  }
}

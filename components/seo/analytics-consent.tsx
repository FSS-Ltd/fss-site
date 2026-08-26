"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";

import dynamic from "next/dynamic";

import { GoogleAnalytics } from "@/components/seo/google-analytics";
import {
  ANALYTICS_CONSENT_CHANGED_EVENT,
  ANALYTICS_CONSENT_STORAGE_KEY,
  ANALYTICS_SETTINGS_EVENT,
  createAnalyticsConsentCookie,
  createAnalyticsConsent,
  getAnalyticsCookieDomains,
  getAnalyticsCookieNames,
  parseAnalyticsConsent,
  resolveSessionAnalyticsConsent,
  resolveAnalyticsConsentValue,
  shouldDisableAnalytics,
  shouldLoadAnalytics,
  type AnalyticsConsent,
  type AnalyticsConsentChoice,
} from "@/lib/analytics/consent";

const CookieConsentPanel = dynamic(
  () =>
    import("./cookie-consent-panel").then(
      (module) => module.CookieConsentPanel,
    ),
  { ssr: false },
);

type AnalyticsConsentControllerProps = {
  measurementId: string;
};

function subscribeToAnalyticsConsent(onChange: () => void): () => void {
  const handleStorage = (event: StorageEvent) => {
    if (event.key === ANALYTICS_CONSENT_STORAGE_KEY) onChange();
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, onChange);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(ANALYTICS_CONSENT_CHANGED_EVENT, onChange);
  };
}

function getAnalyticsConsentSnapshot(): string | null {
  let localStorageValue: string | null = null;

  try {
    localStorageValue = window.localStorage.getItem(
      ANALYTICS_CONSENT_STORAGE_KEY,
    );
  } catch {
    // The preference cookie remains available when local storage is blocked.
  }

  return resolveAnalyticsConsentValue(document.cookie, localStorageValue);
}

function getServerAnalyticsConsentSnapshot(): undefined {
  return undefined;
}

function clearAnalyticsCookies(): void {
  const cookieNames = getAnalyticsCookieNames(document.cookie);
  const domains = getAnalyticsCookieDomains(window.location.hostname);

  for (const name of cookieNames) {
    for (const domain of domains) {
      const domainAttribute = domain ? `; domain=${domain}` : "";
      document.cookie = `${name}=; Max-Age=0; path=/${domainAttribute}; SameSite=Lax`;
    }
  }
}

function persistAnalyticsConsent(consent: AnalyticsConsent): boolean {
  const serializedConsent = JSON.stringify(consent);

  try {
    window.localStorage.setItem(
      ANALYTICS_CONSENT_STORAGE_KEY,
      serializedConsent,
    );
  } catch {
    // The preference cookie provides the fallback persistence path.
  }

  document.cookie = createAnalyticsConsentCookie(
    serializedConsent,
    window.location.protocol === "https:",
  );

  return getAnalyticsConsentSnapshot() === serializedConsent;
}

export function AnalyticsConsentController({
  measurementId,
}: AnalyticsConsentControllerProps) {
  const storedValue = useSyncExternalStore(
    subscribeToAnalyticsConsent,
    getAnalyticsConsentSnapshot,
    getServerAnalyticsConsentSnapshot,
  );
  const storedConsent = useMemo(
    () =>
      storedValue === undefined
        ? undefined
        : parseAnalyticsConsent(storedValue),
    [storedValue],
  );
  const [sessionConsent, setSessionConsent] = useState<AnalyticsConsent | null>(
    null,
  );
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsReturnFocusRef = useRef<HTMLElement | null>(null);
  const consent = sessionConsent ?? storedConsent;

  useEffect(() => {
    const openSettings = (event: Event) => {
      if (event instanceof CustomEvent) {
        const returnFocusTo: unknown = event.detail?.returnFocusTo;
        settingsReturnFocusRef.current =
          returnFocusTo instanceof HTMLElement ? returnFocusTo : null;
      }

      setSettingsOpen(true);
    };
    window.addEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
    return () =>
      window.removeEventListener(ANALYTICS_SETTINGS_EVENT, openSettings);
  }, []);

  useEffect(() => {
    if (consent === undefined) return;

    const disabled = shouldDisableAnalytics(consent);
    Reflect.set(window, `ga-disable-${measurementId}`, disabled);
    if (disabled) clearAnalyticsCookies();
  }, [consent, measurementId]);

  const restoreSettingsFocus = useCallback(() => {
    const returnFocusTo = settingsReturnFocusRef.current;
    settingsReturnFocusRef.current = null;
    window.requestAnimationFrame(() => returnFocusTo?.focus());
  }, []);

  const closeSettings = useCallback(() => {
    setSettingsOpen(false);
    restoreSettingsFocus();
  }, [restoreSettingsFocus]);

  const saveChoice = useCallback(
    (choice: AnalyticsConsentChoice) => {
      const nextConsent = createAnalyticsConsent(choice);
      const analyticsWasLoaded = shouldLoadAnalytics(consent ?? null);
      const persisted = persistAnalyticsConsent(nextConsent);

      setSessionConsent(resolveSessionAnalyticsConsent(nextConsent, persisted));
      if (persisted) {
        window.dispatchEvent(new Event(ANALYTICS_CONSENT_CHANGED_EVENT));
      }

      setSettingsOpen(false);
      if (settingsOpen) restoreSettingsFocus();

      const disabled = shouldDisableAnalytics(nextConsent);
      Reflect.set(window, `ga-disable-${measurementId}`, disabled);

      if (choice === "rejected") {
        clearAnalyticsCookies();
        if (analyticsWasLoaded && persisted) window.location.reload();
      }
    },
    [consent, measurementId, restoreSettingsFocus, settingsOpen],
  );

  const panelOpen = consent === null || settingsOpen;

  return (
    <>
      {shouldLoadAnalytics(consent ?? null) && (
        <GoogleAnalytics measurementId={measurementId} strategy="lazyOnload" />
      )}
      {panelOpen && (
        <CookieConsentPanel
          focusOnMount={settingsOpen}
          onAccept={() => saveChoice("accepted")}
          onDismiss={closeSettings}
          onReject={() => saveChoice("rejected")}
        />
      )}
    </>
  );
}

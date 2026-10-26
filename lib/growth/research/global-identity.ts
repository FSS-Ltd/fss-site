import type { GlobalResearchCandidate } from "./global-schema";

// A shared hosting/social hostname does not identify the business using it.
const SHARED_HOSTS = new Set([
  "facebook.com",
  "instagram.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "google.com",
  "maps.google.com",
  "maps.app.goo.gl",
  "linktr.ee",
  "wa.me",
  "wixsite.com",
  "wordpress.com",
  "square.site",
  "business.site",
]);

export function normalizeRegistration(value: string | null): string | null {
  return value === null ? null : value.replace(/\s+/g, "").toUpperCase();
}

export function businessWebsiteHost(websiteUrl: string | null): string | null {
  if (!websiteUrl) return null;
  const host = new URL(websiteUrl).hostname.toLowerCase().replace(/^www\./, "");
  const socialHost = [
    "facebook.com",
    "instagram.com",
    "linkedin.com",
    "youtube.com",
    "tiktok.com",
    "google.com",
  ].some((domain) => host === domain || host.endsWith(`.${domain}`));
  return socialHost || SHARED_HOSTS.has(host) ? null : host;
}

export function globalCandidateIdentityKeys(
  candidate: GlobalResearchCandidate,
): string[] {
  const { business, contact } = candidate;
  const registration = normalizeRegistration(business.companyNumber);
  const host = businessWebsiteHost(
    business.websiteUrl ?? business.firstPartySourceUrl,
  );
  const keys = [`growth:contact:${contact.email.trim().toLowerCase()}`];
  if (registration) {
    // Retain the legacy lock for GB registrations so old and new intake serialize.
    keys.push(
      business.countryCode === "GB"
        ? `growth:business:${registration}`
        : `growth:business:${business.countryCode}:${registration}`,
    );
  }
  if (business.googlePlaceId)
    keys.push(`growth:place:${business.googlePlaceId}`);
  if (host) keys.push(`growth:website:${host}`);
  return keys.sort();
}

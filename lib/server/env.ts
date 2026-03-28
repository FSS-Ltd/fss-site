import "server-only";

function readRequiredEnv(name: string): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readOptionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function getLeadServerEnv() {
  const hubspotAccessToken =
    readOptionalEnv("HUBSPOT_ACCESS_TOKEN") || readOptionalEnv("HUBSPOT_API_KEY") || "";

  if (!hubspotAccessToken) {
    throw new Error("Missing required environment variable: HUBSPOT_ACCESS_TOKEN");
  }

  return {
    hubspotAccessToken,
    resendApiKey: readRequiredEnv("RESEND_API_KEY"),
    resendFromEmail: readRequiredEnv("RESEND_FROM_EMAIL"),
    resendReplyToEmail: readRequiredEnv("RESEND_REPLY_TO_EMAIL"),
    leadNotificationEmail: readRequiredEnv("LEAD_NOTIFICATION_EMAIL"),
    siteUrl: readRequiredEnv("NEXT_PUBLIC_SITE_URL"),
    hubspotChallengeProperty: readOptionalEnv("HUBSPOT_CHALLENGE_PROPERTY"),
    hubspotSourceContextProperty: readOptionalEnv("HUBSPOT_SOURCE_CONTEXT_PROPERTY"),
    hubspotSourcePathProperty: readOptionalEnv("HUBSPOT_SOURCE_PATH_PROPERTY"),
    hubspotResourceSlugProperty: readOptionalEnv("HUBSPOT_RESOURCE_SLUG_PROPERTY"),
  };
}

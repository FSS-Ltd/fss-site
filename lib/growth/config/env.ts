import { z } from "zod";

import { parseTokenEncryptionKey } from "../integrations/token-crypto";

const FOUNDER_EMAIL = "j.ntagengwa@faithfulsoftware.dev" as const;

const postgresUrlSchema = z
  .string()
  .url()
  .refine(
    (value) => {
      try {
        const protocol = new URL(value).protocol;
        return protocol === "postgres:" || protocol === "postgresql:";
      } catch {
        return false;
      }
    },
    { message: "Must use the postgres or postgresql protocol" },
  );

const securitySecretSchema = z
  .string()
  .refine((value) => value.replace(/\s/g, "").length >= 32, {
    message: "Must contain at least 32 non-whitespace characters",
  });

const gmailRedirectUriSchema = z
  .string()
  .trim()
  .url()
  .refine(
    (value) => {
      const url = new URL(value);
      const isSecure = url.protocol === "https:";
      const isLoopbackHttp =
        url.protocol === "http:" &&
        ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);

      return (
        (isSecure || isLoopbackHttp) &&
        url.username === "" &&
        url.password === "" &&
        url.pathname === "/api/integrations/gmail/callback" &&
        url.search === "" &&
        url.hash === ""
      );
    },
    {
      message:
        "Must be an exact HTTPS or loopback Gmail callback URI without credentials, query, or fragment",
    },
  );

const growthServerEnvSchema = z
  .object({
    DATABASE_URL: postgresUrlSchema,
    DIRECT_DATABASE_URL: z.undefined().optional(),
    AUTH_SECRET: securitySecretSchema,
    GOOGLE_AUTH_CLIENT_ID: z.string().trim().min(1),
    GOOGLE_AUTH_CLIENT_SECRET: z.string().trim().min(1),
    GOOGLE_GMAIL_CLIENT_ID: z.string().trim().min(1).optional(),
    GOOGLE_GMAIL_CLIENT_SECRET: z.string().trim().min(1).optional(),
    GOOGLE_GMAIL_REDIRECT_URI: gmailRedirectUriSchema.optional(),
    GROWTH_OS_OWNER_EMAIL: z
      .string()
      .trim()
      .transform((value) => value.toLowerCase())
      .pipe(z.literal(FOUNDER_EMAIL)),
    GROWTH_OS_AGENT_HMAC_SECRET: securitySecretSchema.optional(),
    TOKEN_ENCRYPTION_KEY: securitySecretSchema,
    CRON_SECRET: securitySecretSchema.optional(),
    NEWSLETTER_UNSUBSCRIBE_TOKEN_SECRET: securitySecretSchema.optional(),
    RESEND_API_KEY: z.string().trim().min(1).optional(),
    RESEND_FROM_EMAIL: z.string().trim().min(1).optional(),
    RESEND_REPLY_TO_EMAIL: z.string().trim().min(1).optional(),
    RESEND_WEBHOOK_SECRET: securitySecretSchema.optional(),
    GROWTH_OS_AUTOMATIONS_ENABLED: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    NEXT_PUBLIC_DATABASE_URL: z.undefined().optional(),
    NEXT_PUBLIC_DIRECT_DATABASE_URL: z.undefined().optional(),
    NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY: z.undefined().optional(),
    NEXT_PUBLIC_GOOGLE_GMAIL_CLIENT_ID: z.undefined().optional(),
    NEXT_PUBLIC_GOOGLE_GMAIL_CLIENT_SECRET: z.undefined().optional(),
    NEXT_PUBLIC_GOOGLE_GMAIL_REDIRECT_URI: z.undefined().optional(),
  })
  .refine(
    (value) =>
      !(
        value.VERCEL_ENV === "production" &&
        value.GROWTH_OS_AUTOMATIONS_ENABLED === true
      ) ||
      Boolean(
        value.GOOGLE_GMAIL_CLIENT_ID &&
          value.GOOGLE_GMAIL_CLIENT_SECRET &&
          value.GOOGLE_GMAIL_REDIRECT_URI &&
          value.RESEND_API_KEY &&
          value.RESEND_FROM_EMAIL &&
          value.RESEND_REPLY_TO_EMAIL &&
          value.CRON_SECRET,
      ),
    {
      message:
        "GROWTH_OS_AUTOMATIONS_ENABLED cannot be true in production without complete Gmail, Resend, and cron provider configuration",
      path: ["GROWTH_OS_AUTOMATIONS_ENABLED"],
    },
  )
  .transform((value) => ({
    databaseUrl: value.DATABASE_URL,
    authSecret: value.AUTH_SECRET,
    googleAuthClientId: value.GOOGLE_AUTH_CLIENT_ID,
    googleAuthClientSecret: value.GOOGLE_AUTH_CLIENT_SECRET,
    googleGmailClientId: value.GOOGLE_GMAIL_CLIENT_ID,
    googleGmailClientSecret: value.GOOGLE_GMAIL_CLIENT_SECRET,
    googleGmailRedirectUri: value.GOOGLE_GMAIL_REDIRECT_URI,
    ownerEmail: value.GROWTH_OS_OWNER_EMAIL,
    agentHmacSecret: value.GROWTH_OS_AGENT_HMAC_SECRET,
    tokenEncryptionKey: value.TOKEN_ENCRYPTION_KEY,
    cronSecret: value.CRON_SECRET,
    newsletterUnsubscribeTokenSecret: value.NEWSLETTER_UNSUBSCRIBE_TOKEN_SECRET,
    resendApiKey: value.RESEND_API_KEY,
    resendFromEmail: value.RESEND_FROM_EMAIL,
    resendReplyToEmail: value.RESEND_REPLY_TO_EMAIL,
    resendWebhookSecret: value.RESEND_WEBHOOK_SECRET,
    automationsEnabled: value.GROWTH_OS_AUTOMATIONS_ENABLED,
  }));

export type GrowthServerEnv = {
  databaseUrl: string;
  authSecret: string;
  googleAuthClientId: string;
  googleAuthClientSecret: string;
  googleGmailClientId?: string;
  googleGmailClientSecret?: string;
  googleGmailRedirectUri?: string;
  ownerEmail: typeof FOUNDER_EMAIL;
  agentHmacSecret?: string;
  tokenEncryptionKey: string;
  cronSecret?: string;
  newsletterUnsubscribeTokenSecret?: string;
  resendApiKey?: string;
  resendFromEmail?: string;
  resendReplyToEmail?: string;
  resendWebhookSecret?: string;
  automationsEnabled: boolean;
};

export function parseGrowthServerEnv(
  source: Record<string, string | undefined>,
): GrowthServerEnv {
  return growthServerEnvSchema.parse(source);
}

export type GmailOAuthEnv = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
};

export function requireGmailOAuthEnv(env: GrowthServerEnv): GmailOAuthEnv {
  if (
    !env.googleGmailClientId ||
    !env.googleGmailClientSecret ||
    !env.googleGmailRedirectUri
  ) {
    throw new Error("Gmail OAuth server configuration is incomplete.");
  }

  try {
    parseTokenEncryptionKey(env.tokenEncryptionKey);
  } catch {
    throw new Error("Gmail OAuth token encryption key is invalid.");
  }

  return {
    clientId: env.googleGmailClientId,
    clientSecret: env.googleGmailClientSecret,
    redirectUri: env.googleGmailRedirectUri,
    tokenEncryptionKey: env.tokenEncryptionKey.trim(),
  };
}

export function readGrowthServerEnv(): GrowthServerEnv {
  return parseGrowthServerEnv(process.env);
}

export type ResendEnv = {
  apiKey: string;
  from: string;
  replyTo: string;
};

export function requireResendEnv(env: GrowthServerEnv): ResendEnv {
  if (!env.resendApiKey || !env.resendFromEmail || !env.resendReplyToEmail) {
    throw new Error("Resend server configuration is incomplete.");
  }

  return {
    apiKey: env.resendApiKey,
    from: env.resendFromEmail,
    replyTo: env.resendReplyToEmail,
  };
}

export function requireNewsletterUnsubscribeTokenSecret(
  env: GrowthServerEnv,
): string {
  if (!env.newsletterUnsubscribeTokenSecret) {
    throw new Error("Newsletter unsubscribe token secret is not configured.");
  }
  return env.newsletterUnsubscribeTokenSecret;
}

import { z } from "zod";

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

const growthServerEnvSchema = z
  .object({
    DATABASE_URL: postgresUrlSchema,
    DIRECT_DATABASE_URL: postgresUrlSchema,
    AUTH_SECRET: securitySecretSchema,
    GOOGLE_AUTH_CLIENT_ID: z.string().trim().min(1),
    GOOGLE_AUTH_CLIENT_SECRET: z.string().trim().min(1),
    GROWTH_OS_OWNER_EMAIL: z
      .string()
      .trim()
      .transform((value) => value.toLowerCase())
      .pipe(z.literal(FOUNDER_EMAIL)),
    TOKEN_ENCRYPTION_KEY: securitySecretSchema,
    GROWTH_OS_AUTOMATIONS_ENABLED: z
      .enum(["true", "false"])
      .transform((value) => value === "true"),
    NEXT_PUBLIC_DATABASE_URL: z.undefined().optional(),
    NEXT_PUBLIC_DIRECT_DATABASE_URL: z.undefined().optional(),
    NEXT_PUBLIC_TOKEN_ENCRYPTION_KEY: z.undefined().optional(),
  })
  .transform((value) => ({
    databaseUrl: value.DATABASE_URL,
    directDatabaseUrl: value.DIRECT_DATABASE_URL,
    authSecret: value.AUTH_SECRET,
    googleAuthClientId: value.GOOGLE_AUTH_CLIENT_ID,
    googleAuthClientSecret: value.GOOGLE_AUTH_CLIENT_SECRET,
    ownerEmail: value.GROWTH_OS_OWNER_EMAIL,
    tokenEncryptionKey: value.TOKEN_ENCRYPTION_KEY,
    automationsEnabled: value.GROWTH_OS_AUTOMATIONS_ENABLED,
  }));

export type GrowthServerEnv = {
  databaseUrl: string;
  directDatabaseUrl: string;
  authSecret: string;
  googleAuthClientId: string;
  googleAuthClientSecret: string;
  ownerEmail: typeof FOUNDER_EMAIL;
  tokenEncryptionKey: string;
  automationsEnabled: boolean;
};

export function parseGrowthServerEnv(
  source: Record<string, string | undefined>,
): GrowthServerEnv {
  return growthServerEnvSchema.parse(source);
}

export function readGrowthServerEnv(): GrowthServerEnv {
  return parseGrowthServerEnv(process.env);
}

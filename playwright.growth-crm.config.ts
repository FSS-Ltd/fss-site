import { randomBytes } from "node:crypto";
import { defineConfig } from "@playwright/test";

const databaseUrl = process.env.FSS_CRM_TEST_DATABASE_URL;
if (!databaseUrl)
  throw new Error(
    "Set FSS_CRM_TEST_DATABASE_URL to a disposable loopback fss_crm_* PostgreSQL database.",
  );
const parsed = new URL(databaseUrl);
if (
  !["127.0.0.1", "localhost"].includes(parsed.hostname) ||
  !parsed.pathname.startsWith("/fss_crm_")
)
  throw new Error(
    "CRM browser tests require a disposable loopback fss_crm_* database.",
  );
const runtimeUrl = new URL(databaseUrl);
runtimeUrl.searchParams.set("options", "-c role=growth_app");
const secret =
  process.env.FSS_CRM_TEST_AUTH_SECRET ?? randomBytes(48).toString("base64url");
process.env.FSS_CRM_TEST_AUTH_SECRET = secret;
const port = 3229;
const origin = `http://localhost:${port}`;
export default defineConfig({
  testDir: "tests/e2e",
  testMatch: "growth-crm.spec.ts",
  outputDir: "output/playwright-growth-crm",
  workers: 1,
  timeout: 60000,
  expect: { timeout: 10000 },
  use: { baseURL: origin, trace: "retain-on-failure" },
  projects: [
    { name: "crm-desktop", use: { viewport: { width: 1440, height: 1100 } } },
    { name: "crm-mobile", use: { viewport: { width: 390, height: 844 } } },
  ],
  webServer: {
    stdout: "pipe",
    command: `env -u DIRECT_DATABASE_URL node_modules/.bin/next dev --webpack --hostname localhost --port ${port}`,
    url: `${origin}/growth/login`,
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      DATABASE_URL: runtimeUrl.toString(),
      AUTH_SECRET: secret,
      AUTH_TRUST_HOST: "true",
      AUTH_URL: origin,
      NEXT_PUBLIC_SITE_URL: origin,
      GOOGLE_AUTH_CLIENT_ID: "crm-local-test",
      GOOGLE_AUTH_CLIENT_SECRET: "crm-local-test",
      GROWTH_OS_OWNER_EMAIL: "j.ntagengwa@faithfulsoftware.dev",
      TOKEN_ENCRYPTION_KEY: randomBytes(32).toString("base64"),
      GROWTH_OS_AUTOMATIONS_ENABLED: "false",
    },
  },
});

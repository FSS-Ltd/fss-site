import { defineConfig } from "@playwright/test";

const visualServerPort = 3210;
const visualBaseUrl = `http://127.0.0.1:${visualServerPort}`;

export default defineConfig({
  expect: {
    toHaveScreenshot: {
      animations: "disabled",
      caret: "hide",
    },
  },
  outputDir: "output/playwright",
  projects: [
    {
      name: "fss-studio-desktop",
      use: { viewport: { width: 1440, height: 1200 } },
    },
    {
      name: "fss-studio-mobile",
      use: { viewport: { width: 390, height: 844 } },
    },
  ],
  snapshotPathTemplate:
    "{testDir}/{testFilePath}-snapshots/{arg}-{projectName}-{platform}{ext}",
  testDir: "tests/e2e",
  testMatch: [
    "agreement-builder.spec.ts",
    "client-portal-recovery.spec.ts",
    "fss-studio.visual.spec.ts",
    "portal-access-workspace.spec.ts",
    "welcome-composer.spec.ts",
    "welcome-rendered-review.spec.ts",
    "studio-settings.spec.ts",
  ],
  timeout: 30_000,
  use: {
    baseURL: visualBaseUrl,
    trace: "retain-on-failure",
  },
  webServer: {
    command: `FSS_VISUAL_TESTS_ENABLED=true npm run dev -- --port ${visualServerPort}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    // Wait for the shared fixture route to compile before interaction timers begin.
    url: `${visualBaseUrl}/visual/fss-studio/studio-portal-access`,
  },
});

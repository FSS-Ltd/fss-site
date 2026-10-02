import { defineConfig } from "@playwright/test";
import base from "./playwright.config";

const baseURL = "http://127.0.0.1:3219";

export default defineConfig({
  ...base,
  testMatch: ["agreement-builder.spec.ts", "fss-studio.visual.spec.ts"],
  use: { ...base.use, baseURL },
  webServer: {
    command:
      "FSS_VISUAL_TESTS_ENABLED=true FSS_AGREEMENT_TESTS_ENABLED=true node node_modules/next/dist/bin/next dev --webpack --port 3219",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: baseURL,
  },
});

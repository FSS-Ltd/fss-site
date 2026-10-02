import base from "./playwright.config";
import { defineConfig } from "@playwright/test";
export default defineConfig({
  ...base,
  testMatch: "commercial-offers.spec.ts",
});

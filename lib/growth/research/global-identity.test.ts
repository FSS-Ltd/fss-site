import assert from "node:assert/strict";
import test from "node:test";
import {
  businessWebsiteHost,
  globalCandidateIdentityKeys,
} from "./global-identity";
import { globalResearchRunSchema } from "./global-schema";
import { createGlobalResearchFixture } from "./global-test-fixture";

test("identity keys canonicalize registration, website and mailbox while preserving country", () => {
  const candidate = globalResearchRunSchema.parse(createGlobalResearchFixture())
    .prospects[0]!;
  candidate.business.companyNumber = " ab 123 ";
  candidate.business.websiteUrl = "https://www.example.test/services";
  const keys = globalCandidateIdentityKeys(candidate);
  assert.ok(keys.includes("growth:business:CA:AB123"));
  assert.ok(keys.includes("growth:website:example.test"));
  candidate.business.countryCode = "US";
  assert.ok(
    globalCandidateIdentityKeys(candidate).includes("growth:business:US:AB123"),
  );
  candidate.business.countryCode = "GB";
  assert.ok(
    globalCandidateIdentityKeys(candidate).includes("growth:business:AB123"),
  );
});

test("shared social sites do not deduplicate unrelated businesses", () => {
  assert.equal(
    businessWebsiteHost("https://www.facebook.com/a-business"),
    null,
  );
  assert.equal(
    businessWebsiteHost("https://www.facebook.com/another-business"),
    null,
  );
  assert.equal(businessWebsiteHost(null), null);
  assert.equal(
    businessWebsiteHost("https://a-business.wixsite.com/home"),
    "a-business.wixsite.com",
  );
});

test("missing website uses official source identity and social subdomains stay unshared", () => {
  const candidate = globalResearchRunSchema.parse(createGlobalResearchFixture())
    .prospects[0]!;
  candidate.business.websiteUrl = null;
  assert.ok(
    globalCandidateIdentityKeys(candidate).includes(
      "growth:website:example.test",
    ),
  );
  assert.equal(businessWebsiteHost("https://m.facebook.com/business"), null);
});

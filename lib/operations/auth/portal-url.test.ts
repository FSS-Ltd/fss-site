import assert from "node:assert/strict";
import test from "node:test";
import { portalUrl } from "./portal-url";

test("prefix-free portal URLs remove an internal namespace and retain search and fragment", () => {
  assert.equal(
    portalUrl(
      "/portal/activate?name=Alex#start",
      "https://portal.example.test",
      true,
    ).href,
    "https://portal.example.test/activate?name=Alex#start",
  );
  assert.equal(
    portalUrl("/activate", "https://portal.example.test", true).href,
    "https://portal.example.test/activate",
  );
  assert.equal(
    portalUrl("/portal", "http://localhost:3000", true).href,
    "http://localhost:3000/",
  );
  assert.throws(() =>
    portalUrl("//attacker.test", "https://portal.example.test", true),
  );
  assert.throws(() =>
    portalUrl("https://attacker.test", "https://portal.example.test", true),
  );
});

test("legacy portal URLs retain the internal namespace when routing is disabled", () => {
  assert.equal(
    portalUrl("/", "https://portal.example.test", false).href,
    "https://portal.example.test/portal",
  );
  assert.equal(
    portalUrl(
      "/portal/activate?name=Alex#start",
      "https://portal.example.test",
      false,
    ).href,
    "https://portal.example.test/portal/activate?name=Alex#start",
  );
  assert.equal(
    portalUrl("/activate", "https://portal.example.test", false).href,
    "https://portal.example.test/portal/activate",
  );
});

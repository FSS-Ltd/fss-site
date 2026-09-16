import assert from "node:assert/strict";
import test from "node:test";
import { portalUrl } from "./portal-url";

test("portal URLs remove an internal namespace and retain search and fragment", () => {
  assert.equal(
    portalUrl("/portal/activate?name=Alex#start", "https://portal.example.test")
      .href,
    "https://portal.example.test/activate?name=Alex#start",
  );
  assert.equal(
    portalUrl("/activate", "https://portal.example.test").href,
    "https://portal.example.test/activate",
  );
  assert.equal(
    portalUrl("/portal", "http://localhost:3000").href,
    "http://localhost:3000/",
  );
  assert.throws(() =>
    portalUrl("//attacker.test", "https://portal.example.test"),
  );
  assert.throws(() =>
    portalUrl("https://attacker.test", "https://portal.example.test"),
  );
});

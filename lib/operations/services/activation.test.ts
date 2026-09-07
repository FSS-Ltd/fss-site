import assert from "node:assert/strict";
import test from "node:test";
import { validateActivation } from "./activation";
import { agreementDraft } from "../agreements/fixtures";

test("activation requires signing, cleared deposit, assets and contractual dates", () => {
  const draft = agreementDraft();
  const evidence = {
    effectiveDate: "2026-10-01",
    assetsReady: true,
    deposit: {
      amountPence: "6000",
      verifiedDate: "2026-09-06",
      reference: "bank:review-123",
    },
  };
  assert.doesNotThrow(() =>
    validateActivation(draft, true, evidence, "2026-10-01"),
  );
  assert.throws(
    () => validateActivation(draft, false, evidence, "2026-10-01"),
    /signed/,
  );
  assert.throws(
    () =>
      validateActivation(
        draft,
        true,
        { ...evidence, deposit: null },
        "2026-10-01",
      ),
    /deposit/,
  );
  assert.throws(
    () =>
      validateActivation(
        draft,
        true,
        { ...evidence, assetsReady: false },
        "2026-10-01",
      ),
    /assets/,
  );
  assert.throws(
    () =>
      validateActivation(
        draft,
        true,
        { ...evidence, effectiveDate: "2026-09-01" },
        "2026-10-01",
      ),
    /start/,
  );
});

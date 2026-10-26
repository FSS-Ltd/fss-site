import assert from "node:assert/strict";
import test from "node:test";
import { offersEmailOptOut, findEmailOptOut } from "./copy-policy";

test("accepts varied recipient opt-outs without requiring a fixed sentence", () => {
  for (const sentence of [
    "Reply unsubscribe if this is not useful.",
    "If you would rather I did not contact you again, reply and I will leave it there.",
    "Let me know if you prefer not to receive future messages.",
    "Reply if you want me to stop emailing you.",
    "Reply opt out and I will send no further emails.",
  ]) {
    assert.equal(offersEmailOptOut(sentence), true, sentence);
    assert.equal(findEmailOptOut(`A short idea.\n\n${sentence}`), sentence);
  }
});

test("sender preferences and unrelated contact wording are not opt-outs", () => {
  for (const sentence of [
    "I prefer email for discussing your website.",
    "I would rather contact you by email.",
    "Please reply to discuss this idea.",
    "We do not email prospects automatically.",
    "Stop wasting time and email our team.",
    "Contact us about removing your old website.",
  ])
    assert.equal(offersEmailOptOut(sentence), false, sentence);
});

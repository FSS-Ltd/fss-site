import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import {
  getCopyOpacity,
  shouldEnableScrollLinkedHero,
} from "./kemsing-motor-company-hero";
import { KemsingMotorCompanyPage } from "./kemsing-motor-company";

test("renders Kemsing's scroll-linked vehicle assembly with a complete-car fallback", () => {
  const html = renderToStaticMarkup(<KemsingMotorCompanyPage />);

  assert.match(html, /data-bespoke-prospect="kemsing-motor-company"/);
  assert.doesNotMatch(
    html,
    /<div[^>]*class="[^"]*overflow-hidden[^"]*"[^>]*data-bespoke-prospect="kemsing-motor-company"/,
  );
  assert.match(html, /data-kemsing-vehicle-journey="true"/);
  assert.match(html, /vehicle-reassembly-scroll-scrub-v1\.mp4/);
  assert.match(html, /vehicle-assembled-v1\.png/);
  assert.match(html, /preload="auto"/);
  assert.doesNotMatch(html, /<video[^>]*autoPlay/);
  assert.match(html, /Vehicle registration/);
  assert.match(html, /ADAS calibration/i);
  assert.match(html, /Demonstration only/i);
  assert.match(html, /London Road Service Station Limited/);
  assert.match(html, /Established in Kemsing in 1998/);
  assert.match(html, /ATA Master Tech/);
  assert.match(html, /9 West End, Kemsing, Kent TN15 6PX/);
  assert.match(html, /Mon to Fri: 08:00am - 5:30pm/);
  assert.match(html, /01732 761372/);
  assert.match(html, /info@kemsingmotorco\.co\.uk/);
});

test("enables the scroll-linked hero only for desktop users without reduced motion", () => {
  assert.equal(shouldEnableScrollLinkedHero(false, 767), false);
  assert.equal(shouldEnableScrollLinkedHero(true, 1440), false);
  assert.equal(shouldEnableScrollLinkedHero(false, 1440), true);
});

test("keeps endpoint and handover copy visible throughout the scroll journey", () => {
  assert.equal(getCopyOpacity(0, 0, 0.36), 1);
  assert.equal(getCopyOpacity(1, 0.64, 1), 1);
  assert.ok(getCopyOpacity(0.33, 0, 0.36) > 0);
  assert.ok(getCopyOpacity(0.33, 0.3, 0.7) > 0);
});

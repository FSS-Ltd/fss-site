import assert from "node:assert/strict";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { HazelMotorsPage } from "./hazel-motors";
import { HildenParkAccountantsPage } from "./hilden-park-accountants";
import { HillWoodPage } from "./hill-wood";
import { MdAccountancyPage } from "./md-accountancy";
import { BestRoofingPage } from "./best-roofing";
import { TunbridgeWellsRoofingPage } from "./tunbridge-wells-roofing";

test("renders selectable route journeys for the service concepts", () => {
  for (const Page of [
    HazelMotorsPage,
    HillWoodPage,
    HildenParkAccountantsPage,
  ]) {
    const html = renderToStaticMarkup(<Page />);

    assert.match(html, /data-interactive-journey="true"/);
    assert.match(html, /aria-pressed="true"/);
    assert.match(html, /data-interactive-journey-panel="true"/);
    assert.match(html, /aria-live="polite"/);
  }
});

test("renders MD Accountancy's financial-planning workspace", () => {
  const html = renderToStaticMarkup(<MdAccountancyPage />);

  assert.match(html, /data-md-finance-workspace="true"/);
  assert.match(html, /data-md-finance-signal-rail="true"/);
  assert.match(html, /data-md-finance-workflow="true"/);
  assert.match(html, /aria-pressed="true"/);
  assert.match(html, /data-md-finance-workspace-panel="true"/);
  assert.match(html, /Concept workspace · no live records connected/);
});

test("leads MD Accountancy with a light, conversation-first hero", () => {
  const html = renderToStaticMarkup(<MdAccountancyPage />);

  assert.match(html, /data-md-conversation-hero="true"/);
  assert.match(html, /Accountancy should begin with your question/);
  assert.match(html, /data-md-conversation-image="true"/);
  assert.match(html, /data-md-light-workspace="true"/);
});

test("uses a distinct supporting image below MD Accountancy's hero", () => {
  const html = renderToStaticMarkup(<MdAccountancyPage />);

  assert.match(html, /data-md-supporting-image="true"/);
  assert.match(html, /supporting-conversation-v1\.png/);
});

test("renders visibly staged roof journeys for both roofing concepts", () => {
  for (const [Page, expectedRevealCount] of [
    [BestRoofingPage, 4],
    [TunbridgeWellsRoofingPage, 3],
  ] as const) {
    const html = renderToStaticMarkup(<Page />);
    const routeRevealCount = (html.match(/data-roofing-route-reveal="true"/g) ?? [])
      .length;

    assert.match(html, /data-roof-build-scroll-progress="true"/);
    assert.match(html, /data-roof-build-scroll-beat="0"/);
    assert.match(html, /data-roof-build-scroll-beat="1"/);
    assert.match(html, /data-roof-build-scroll-beat="2"/);
    assert.equal(routeRevealCount, expectedRevealCount);
  }
});

test("gives every requested concept an immediate hero entrance", () => {
  for (const Page of [
    HazelMotorsPage,
    BestRoofingPage,
    MdAccountancyPage,
    HillWoodPage,
    HildenParkAccountantsPage,
    TunbridgeWellsRoofingPage,
  ]) {
    const html = renderToStaticMarkup(<Page />);

    assert.match(html, /data-prospect-hero-copy="true"/);
  }
});

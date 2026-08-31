import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import test from "node:test";

import { renderToStaticMarkup } from "react-dom/server";

import { HollisMotorsPage } from "./hollis-motors";

test("renders Hollis Motors as a proof-led dealership gallery", () => {
  const html = renderToStaticMarkup(<HollisMotorsPage />);

  assert.match(html, /data-bespoke-prospect="hollis-motors"/);
  assert.match(html, /data-hollis-showroom-gallery="true"/);
  assert.match(html, /Find the right car\./);
  assert.match(html, /Move on with a plan\./);
  assert.match(html, /Keep your car in shape\./);
  assert.match(html, /Hollis Motors\. There’s nowhere better\./);
  assert.match(html, /Used cars/i);
  assert.match(html, /Part exchange/i);
  assert.match(html, /Finance/i);
  assert.match(html, /Onsite workshop/i);
  assert.match(html, /Browse the collection/i);
  assert.match(html, /Vehicle registration/i);
  assert.match(html, /Mileage/i);

  for (const frame of ["01", "02", "03", "04"]) {
    assert.match(html, new RegExp(`dealership-gallery-${frame}\\.webp`));
  }
});

test("ships a scroll-driven car crossfade with a reduced-motion fallback", () => {
  const assetDirectory = new URL(
    "../../../../public/prospect-previews/bespoke/hollis-motors/",
    import.meta.url,
  );

  for (const frame of ["01", "02", "03", "04"]) {
    assert.equal(
      existsSync(new URL(`dealership-gallery-${frame}.webp`, assetDirectory)),
      true,
    );
  }

  const styles = readFileSync(
    new URL("../../../../app/preview/preview.css", import.meta.url),
    "utf8",
  );

  assert.match(styles, /\[data-hollis-showroom-gallery\]/);
  const heroSource = readFileSync(
    new URL("./hollis-motors-hero.tsx", import.meta.url),
    "utf8",
  );

  assert.match(heroSource, /data-hollis-scroll-gallery="true"/);
  assert.match(heroSource, /data-hollis-copy-beat="true"/);
  assert.match(heroSource, /const activeCopyBeat/);
  assert.match(heroSource, /window\.addEventListener\("scroll"/);
  assert.match(styles, /--hollis-gallery-opacity/);
  assert.match(styles, /--hollis-copy-opacity/);
  assert.match(styles, /rgb\(7 9 12 \/ 78%\)/);
  assert.match(
    styles,
    /@media \(min-width: 768px\) and \(prefers-reduced-motion: no-preference\)[\s\S]*data-hollis-scroll-gallery/,
  );
  assert.match(
    styles,
    /@media \(prefers-reduced-motion: reduce\)[\s\S]*data-hollis-showroom-gallery/,
  );
});

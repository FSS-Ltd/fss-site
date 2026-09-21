import assert from "node:assert/strict";
import { createRequire } from "node:module";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

const require = createRequire(import.meta.url);
require.extensions[".css"] = (module) => {
  module.exports = {
    __esModule: true,
    default: new Proxy({}, { get: (_target, key) => String(key) }),
  };
};

const { AgreementBuilder } =
  require("./agreement-builder") as typeof import("./agreement-builder");

const choices = [
  {
    id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
    name: "Website & booking experience · Discovery complete",
  },
];

test("guides a linked agreement through the named builder steps", () => {
  const html = renderToStaticMarkup(
    <AgreementBuilder
      engagementChoices={choices}
      engagementHref="/admin/clients/example/engagements/new"
      organisationName="Northstar Studio"
      step="link"
    >
      <p>Authoritative agreement form</p>
    </AgreementBuilder>,
  );

  assert.match(html, /Link the right work/);
  assert.match(html, /Website &amp; booking experience/);
  assert.match(html, /Authoritative agreement form/);
});

test("names the scope and fee controls without fabricating pricing", () => {
  const scopeHtml = renderToStaticMarkup(
    <AgreementBuilder
      engagementChoices={choices}
      engagementHref="/admin/clients/example/engagements/new"
      organisationName="Northstar Studio"
      step="scope"
    />,
  );
  const feesHtml = renderToStaticMarkup(
    <AgreementBuilder
      engagementChoices={choices}
      engagementHref="/admin/clients/example/engagements/new"
      organisationName="Northstar Studio"
      step="fees"
    />,
  );

  assert.match(scopeHtml, /Define the work/);
  assert.match(feesHtml, /Payment amounts must reconcile/);
});

test("does not expose a UUID selector when no eligible engagement exists", () => {
  const html = renderToStaticMarkup(
    <AgreementBuilder
      engagementChoices={[]}
      engagementHref="/admin/clients/example/engagements/new"
      organisationName="Northstar Studio"
      step="link"
    />,
  );

  assert.match(html, /No engagement is linked/);
  assert.doesNotMatch(html, /<option value="[0-9a-f-]{36}/);
});

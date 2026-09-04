import assert from "node:assert/strict";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { getBlogPostBySlug } from "@/lib/blog";
import { getResourceBySlug } from "@/lib/resources";
import { ArticleSchema } from "./article-schema";
import { ContentEvidence } from "./content-evidence";
import { ContentBreadcrumbs } from "./content-breadcrumbs";
import { ResourceSchema } from "./resource-schema";
import { ResourceDelivery } from "@/emails/resource-delivery";

test("article evidence is visible and organisational authorship is represented accurately", async () => {
  const post = await getBlogPostBySlug(
    "bespoke-software-development-for-real-operational-problems",
  );
  assert.ok(post);
  const html = renderToStaticMarkup(<ContentEvidence content={post.meta} />);
  assert.match(html, /FSS Growth Team/);
  assert.match(html, /2026-09-04/);
  assert.match(html, /Charity leaders/);
  assert.match(html, /Sources and evidence/);
  assert.doesNotMatch(html, /Reviewed by/);
  const schema = renderToStaticMarkup(<ArticleSchema post={post.meta} />);
  assert.match(schema, /"author":\{"@type":"Organization"/);
  assert.match(schema, /"dateModified":"2026-09-04"/);
  assert.match(
    renderToStaticMarkup(
      <ContentBreadcrumbs parent="Blog" title={post.meta.title} />,
    ),
    /aria-current="page"/,
  );
});

test("DigitalDocument describes only the verified visible readiness PDF facts", async () => {
  const resource = await getResourceBySlug("software-project-readiness-kit");
  assert.ok(resource);
  const html = renderToStaticMarkup(
    <ResourceSchema resource={resource.meta} />,
  );
  assert.match(html, /"@type":"DigitalDocument"/);
  assert.match(html, /"encodingFormat":"application\/pdf"/);
  assert.match(html, /software-project-readiness-kit.pdf/);
  assert.doesNotMatch(
    html,
    /fileSize|numberOfPages|datePublished|dateModified/,
  );
  const unverified = {
    ...resource.meta,
    delivery: { ...resource.meta.delivery, encodingFormat: undefined },
  };
  assert.equal(
    renderToStaticMarkup(<ResourceSchema resource={unverified} />),
    "",
  );
});

test("readiness delivery email uses the buyer-focused resource summary and correct download", async () => {
  const resource = await getResourceBySlug("software-project-readiness-kit");
  assert.ok(resource?.meta.summary);
  const html = renderToStaticMarkup(
    <ResourceDelivery
      firstName="Alex"
      resourceTitle={resource.meta.title}
      resourceUrl="https://faithfulsoftware.dev/resource-downloads/software-project-readiness-kit.pdf"
      resourceSummary={resource.meta.summary}
    />,
  );
  assert.match(html, /Software Project Readiness Kit/);
  assert.match(html, /first release and ongoing owner/);
  assert.match(html, /resource-downloads\/software-project-readiness-kit.pdf/);
  assert.doesNotMatch(html, /SDK|GTM/);
});

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { renderToStaticMarkup } from "react-dom/server";

import { ResourceSchema } from "@/components/seo/resource-schema";
import { TextareaField } from "@/components/forms/textarea-field";
import {
  AI_RECEPTIONIST_GUIDE_PATH,
  AI_RECEPTIONIST_GUIDE_SLUG,
  isAiReceptionistGuidePath,
} from "@/lib/ai-receptionist-guide";
import { getResourceBySlug } from "@/lib/resources";
import { getDeliveryAction } from "@/lib/resource-delivery";

test("the published guide delivers the original supplied PDF unchanged", async () => {
  const resource = await getResourceBySlug(AI_RECEPTIONIST_GUIDE_SLUG);
  assert.ok(resource);
  const delivery = getDeliveryAction(resource.meta);
  assert.ok(delivery);
  assert.equal(delivery.external, false);
  assert.equal(delivery.download, "AI_Receptionist_Setup_Guide.pdf");
  const file = await readFile(
    path.join(process.cwd(), "public", delivery.href),
  );
  assert.equal(
    createHash("sha256").update(file).digest("hex"),
    "cd7ddabdd929d04c5f4c5d9275c4f649364fa696d3e2e97e367496d062416ff8",
  );
});

test("guide schema credits a Person while existing resource authors remain organisations", async () => {
  const resource = await getResourceBySlug(AI_RECEPTIONIST_GUIDE_SLUG);
  assert.ok(resource);
  const guide = renderToStaticMarkup(
    <ResourceSchema resource={resource.meta} authorType="Person" />,
  );
  assert.match(
    guide,
    /"author":\{"@type":"Person","name":"Jean-Fidele Ntagengwa"/,
  );
  assert.match(guide, /"encodingFormat":"application\/pdf"/);
  const standard = renderToStaticMarkup(
    <ResourceSchema resource={resource.meta} />,
  );
  assert.match(standard, /"author":\{"@type":"Organization"/);
});

test("campaign navigation applies only to the guide and its thank-you page", () => {
  assert.equal(isAiReceptionistGuidePath(AI_RECEPTIONIST_GUIDE_PATH), true);
  assert.equal(
    isAiReceptionistGuidePath(`${AI_RECEPTIONIST_GUIDE_PATH}/thank-you`),
    true,
  );
  for (const pathname of [
    null,
    "/",
    "/resources",
    `${AI_RECEPTIONIST_GUIDE_PATH}-other`,
    `${AI_RECEPTIONIST_GUIDE_PATH}/other`,
  ]) {
    assert.equal(isAiReceptionistGuidePath(pathname), false);
  }
});

test("challenge validation is associated with its textarea and cleared when valid", () => {
  const invalid = renderToStaticMarkup(
    <TextareaField
      id="challenge"
      label="Current challenge"
      error="Please keep this under 600 characters."
    />,
  );
  assert.match(invalid, /aria-invalid="true"/);
  assert.match(invalid, /aria-describedby="challenge-error"/);
  assert.match(invalid, /id="challenge-error"/);
  assert.match(invalid, /text-red-700/);
  const valid = renderToStaticMarkup(
    <TextareaField id="challenge" label="Current challenge" />,
  );
  assert.doesNotMatch(valid, /aria-invalid|aria-describedby|challenge-error/);
});

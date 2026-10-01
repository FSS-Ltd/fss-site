import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import {
  createDesignedWelcomePack,
  packetEditions,
  packetAssets,
} from "./packet-editions";
import { getEmailArtwork, welcomeEmailKinds } from "./email-artwork";
import { welcomePackContentSchema } from "./welcome-pack-contract";
import { welcomeFixtureInput } from "./fixtures";
import { prepareWelcome, validatePreparedWelcome } from "./approval";
import { proposalEmail } from "./content/proposal-email";
import { activationEmail } from "./content/activation-email";
import { thankYouEmail } from "./content/thank-you";

test("finished packet editions never reuse a photograph", () => {
  const ids = packetEditions.flatMap((edition) => [
    edition.coverImageId,
    ...createDesignedWelcomePack(edition.id).guide.flatMap((page) =>
      page.imageId ? [page.imageId] : [],
    ),
  ]);
  assert.equal(new Set(ids).size, ids.length);
});

test("packet photographs and twelve email headers have distinct paths and file contents", async () => {
  const assets = packetEditions.flatMap((edition) => {
    const pack = createDesignedWelcomePack(edition.id);
    return [
      packetAssets[edition.coverImageId],
      ...pack.guide.flatMap((page) =>
        page.imageId ? [packetAssets[page.imageId]] : [],
      ),
      ...welcomeEmailKinds.map((kind) => getEmailArtwork(edition.id, kind)),
    ];
  });
  assert.equal(assets.length, 16);
  assert.equal(new Set(assets.map((asset) => asset.src)).size, assets.length);
  const hashes = await Promise.all(
    assets.map(async (asset) =>
      createHash("sha256")
        .update(await readFile(join(process.cwd(), "public", asset.src)))
        .digest("hex"),
    ),
  );
  assert.equal(new Set(hashes).size, hashes.length);
});

test("all editions select distinct email artwork and image-free sections survive approval", async () => {
  for (const edition of packetEditions) {
    const pack = welcomePackContentSchema.parse(
      createDesignedWelcomePack(edition.id),
    );
    const input = welcomeFixtureInput();
    const prepared = await prepareWelcome({
      ...input,
      content: {
        ...input.content,
        rendererVersion: pack.rendererVersion,
        emailArtworkVersion: pack.emailArtworkVersion,
        edition: edition.id,
        pages: pack.guide,
      },
    });
    validatePreparedWelcome(prepared);
    const { snapshot } = prepared;
    const emails = [
      snapshot.welcome,
      proposalEmail(
        snapshot.recipient,
        snapshot.content,
        "the agreed scope",
        "https://example.test/agreements",
      ),
      activationEmail(snapshot.recipient, snapshot.content),
      thankYouEmail(
        snapshot,
        "https://example.test/invoice",
        "https://example.test/portal",
      ),
    ];
    emails.forEach((email, index) => {
      const asset = getEmailArtwork(edition.id, welcomeEmailKinds[index]);
      assert.ok(
        email.html.includes(`src="https://faithfulsoftware.dev${asset.src}"`),
      );
      assert.ok(email.html.includes(`alt="${asset.alt}"`));
      assert.equal((email.html.match(/<img\b/g) ?? []).length, 1);
      assert.ok(email.text.length > 100);
    });
    const packetImages = [
      ...snapshot.accessibleHtml.matchAll(/<img\b[^>]*src="([^"]+)"/g),
    ].map((match) => match[1]);
    assert.equal(packetImages.length, edition.id === "systems_portal" ? 2 : 1);
    assert.equal(new Set(packetImages).size, packetImages.length);
    assert.equal(
      (prepared.pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length,
      10,
    );
  }
});

test("image layouts still require approved images while text and diagrams may omit them", () => {
  const pack = createDesignedWelcomePack("website_build");
  assert.ok(welcomePackContentSchema.safeParse(pack).success);
  const guide = pack.guide.map((page, index) =>
    index === 0 ? { ...page, layout: "image_top" } : page,
  );
  assert.equal(
    welcomePackContentSchema.safeParse({ ...pack, guide }).success,
    false,
  );
});

test("image-free editorial overflow names the section before approval", async () => {
  const input = welcomeFixtureInput();
  const pack = createDesignedWelcomePack("website_build");
  const pages = pack.guide.map((page) =>
    page.sectionId === "communication"
      ? {
          ...page,
          paragraphs: Array<string>(8).fill("Long content. ".repeat(120)),
        }
      : page,
  );
  await assert.rejects(
    prepareWelcome({
      ...input,
      content: {
        ...input.content,
        rendererVersion: 2,
        edition: "website_build",
        pages,
      },
    }),
    /section "communication: Keeping the work clear" exceeds/,
  );
});

import assert from "node:assert/strict";
import test from "node:test";
import { welcomePackContentSchema } from "./welcome-pack-contract";
import { welcomeFixtureInput } from "./fixtures";
import { prepareWelcome, validatePreparedWelcome } from "./approval";
import { escapeHtml } from "./content/email-html";

const sections = [
  "welcome",
  "project",
  "services",
  "process",
  "timeline",
  "responsibilities",
  "deliverables",
  "communication",
  "next_steps",
];
const modernGuide = () =>
  sections.map((sectionId) => ({
    sectionId,
    title: `Your ${sectionId}`,
    paragraphs: [
      "We will confirm the agreed inputs and review dates. To be agreed.",
    ],
    layout: "image_top",
    imageId: "human_craft",
  }));
const modernInput = () => {
  const input = welcomeFixtureInput();
  return {
    ...input,
    content: {
      ...input.content,
      rendererVersion: 2,
      edition: "website_build",
      settingsRevision: 1,
      pages: modernGuide(),
    },
  };
};

test("modern approval accepts nine typed sections and generates ten pages", async () => {
  const prepared = await prepareWelcome(modernInput());
  validatePreparedWelcome(prepared);
  assert.equal(
    (prepared.pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length,
    10,
  );
  assert.ok(prepared.pdf.length < 2 * 1024 * 1024);
  assert.match(prepared.snapshot.accessibleHtml, /To be agreed/);
});

test("modern approvals reject missing metadata, duplicate sections and unapproved images", async () => {
  const input = modernInput();
  for (const pages of [
    input.content.pages.map(({ title, paragraphs }) => ({ title, paragraphs })),
    input.content.pages.map((page) => ({ ...page, sectionId: "welcome" })),
    input.content.pages.map((page) => ({ ...page, imageId: "../../secret" })),
  ]) {
    await assert.rejects(
      prepareWelcome({ ...input, content: { ...input.content, pages } }),
    );
  }
});

test("modern pack publishing accepts nine typed sections", () => {
  const input = modernInput();
  const content = {
    rendererVersion: 2,
    edition: "website_build",
    emailSubject: "Next steps",
    emailBody: "Hello {{contact_first_name}}",
    guide: input.content.pages,
    thankYou: input.thankYou,
    tasks: [
      {
        id: "10000000-0000-4000-8000-000000000001",
        title: "Confirm your contact",
        instructions: "Check your contact details.",
        kind: "profile",
        ownerRole: "owner",
        required: true,
        dependsOnTaskId: null,
        dueRule: "activation",
        evidenceRule: "profile_saved",
        bookingUrl: null,
      },
    ],
  };
  assert.equal(welcomePackContentSchema.parse(content).guide.length, 9);
});

test("every edition renders a deterministic ten-page packet with editable complete copy", async () => {
  const { createDesignedWelcomePack, getPacketEdition, packetAssets } =
    await import("./packet-editions");
  for (const edition of [
    "website_build",
    "website_seo",
    "systems_portal",
  ] as const) {
    const pack = welcomePackContentSchema.parse(
      createDesignedWelcomePack(edition),
    );
    const input = modernInput();
    const resolveCopy = (value: string) =>
      value
        .replaceAll("{{client_name}}", "Clear Harbour")
        .replaceAll("{{contact_first_name}}", "Sam")
        .replaceAll("{{agreement_goal}}", "a clear client journey")
        .replaceAll("{{agreement_scope}}", "the approved scope")
        .replaceAll("{{sender_name}}", "Jean");
    const content = {
      ...input.content,
      edition,
      pages: pack.guide.map((page) => ({
        ...page,
        title: resolveCopy(page.title),
        paragraphs: page.paragraphs.map(resolveCopy),
      })),
      emailSubject: resolveCopy(pack.emailSubject),
      emailBody: resolveCopy(pack.emailBody),
    };
    const prepared = await prepareWelcome({ ...input, content });
    const again = await prepareWelcome({ ...input, content });
    assert.deepEqual(prepared.pdf, again.pdf);
    assert.equal(
      (prepared.pdf.toString("latin1").match(/\/Type \/Page\b/g) ?? []).length,
      10,
    );
    assert.ok(prepared.pdf.length < 2 * 1024 * 1024);
    assert.ok(
      prepared.snapshot.welcome.html.includes(
        `src="https://faithfulsoftware.dev${packetAssets[getPacketEdition(edition).coverImageId].src}"`,
      ),
    );
    for (const page of content.pages)
      for (const paragraph of page.paragraphs)
        assert.ok(
          prepared.snapshot.accessibleHtml.includes(escapeHtml(paragraph)),
        );
    assert.ok(prepared.snapshot.accessibleHtml.includes("To be agreed"));
  }
});

test("modern overflow names the failing section", async () => {
  const input = modernInput();
  input.content.pages[4].paragraphs = Array(8).fill(
    "Long content. ".repeat(120),
  );
  await assert.rejects(
    prepareWelcome(input),
    /section "timeline: Your timeline" exceeds/,
  );
});

test("all four modern emails use a readable table frame and escape client facts", async () => {
  const { proposalEmail } = await import("./content/proposal-email");
  const { activationEmail } = await import("./content/activation-email");
  const { thankYouEmail } = await import("./content/thank-you");
  const input = modernInput();
  input.content.contactFirstName = "<script>Sam</script>";
  const { snapshot } = await prepareWelcome(input);
  const emails = [
    snapshot.welcome,
    proposalEmail(
      snapshot.recipient,
      snapshot.content,
      '<img src="x">',
      "https://example.test/agreements",
    ),
    activationEmail(snapshot.recipient, snapshot.content),
    thankYouEmail(
      snapshot,
      "https://example.test/billing",
      "https://example.test/portal",
    ),
  ];
  for (const email of emails) {
    assert.match(email.html, /<table[^>]*role="presentation"/);
    assert.match(email.html, /FAITHFUL SOFTWARE SOLUTIONS/);
    const headerImage = email.html.match(/<img\b[^>]+>/)?.[0] ?? "";
    assert.match(
      headerImage,
      /src="https:\/\/faithfulsoftware\.dev\/images\/editorial\/about-human-craft-v1\.webp"/,
    );
    assert.match(headerImage, /alt="Thoughtful work and human craft"/);
    assert.equal((email.html.match(/<img\b/g) ?? []).length, 1);
    assert.doesNotMatch(email.html, /<script>|<img src="x">/);
    assert.ok(email.text.length > 100);
    assert.equal(email.from, input.content.from);
    assert.equal(email.replyTo, input.content.replyTo);
  }
  assert.match(snapshot.welcome.html, /&lt;script&gt;Sam/);
});

test("modern welcome is a concise attachment note and subsequent emails have approved primary actions", async () => {
  const { proposalEmail } = await import("./content/proposal-email");
  const { activationEmail } = await import("./content/activation-email");
  const { thankYouEmail } = await import("./content/thank-you");
  const { snapshot } = await prepareWelcome(modernInput());
  assert.match(snapshot.welcome.html, /Read the attached PDF/);
  assert.doesNotMatch(snapshot.welcome.html, /<article/);
  assert.doesNotMatch(snapshot.welcome.text, /To be agreed/);
  assert.ok(snapshot.welcome.text.length < 2000);
  assert.match(snapshot.accessibleHtml, /To be agreed/);
  const emails = [
    [
      proposalEmail(
        snapshot.recipient,
        snapshot.content,
        "the agreed work",
        "https://example.test/agreements",
      ),
      "Review and sign proposal",
      "https://example.test/agreements",
    ],
    [
      activationEmail(snapshot.recipient, snapshot.content),
      "Activate portal access",
      "{{portal_access_url}}",
    ],
    [
      thankYouEmail(
        snapshot,
        "https://example.test/billing",
        "https://example.test/portal",
      ),
      "Open client workspace",
      "https://example.test/portal",
    ],
  ] as const;
  for (const [email, label, url] of emails) {
    assert.ok(email.html.includes(label));
    assert.ok(email.html.includes(`href="${url}"`));
    assert.ok(email.text.includes(`${label}: ${url}`));
  }
});

test("legacy approved welcome email stays byte-for-byte compatible", async () => {
  const { createHash } = await import("node:crypto");
  const { welcomeAccessibleHtml } = await import("./content/welcome-pdf");
  const { welcomeEmail } = await import("./content/welcome-email");
  const input = welcomeFixtureInput();
  const html = welcomeAccessibleHtml(input.content);
  // Captured from the pre-redesign renderer in Git, including the accessible guide.
  assert.equal(
    createHash("sha256")
      .update(
        JSON.stringify(welcomeEmail(input.recipient, input.content, html)),
      )
      .digest("hex"),
    "827b044093a7c3153a8cfddfe8c2584d1aae5194fcadcfcf5b23847239315741",
  );
});

test("packet artwork is clipped to its page composition so it cannot cover text", async () => {
  const { inflateSync } = await import("node:zlib");
  const { pdf } = await prepareWelcome(modernInput());
  const source = pdf.toString("latin1");
  const streams = [
    ...source.matchAll(/<<([\s\S]*?)>>\s*stream\r?\n([\s\S]*?)\r?\nendstream/g),
  ].filter((match) => match[1].includes("/FlateDecode"));
  const operators = streams
    .map((match) =>
      inflateSync(Buffer.from(match[2], "latin1")).toString("latin1"),
    )
    .join("\n");
  assert.equal((operators.match(/\bW n\b/g) ?? []).length, 10);
});

test("modern packets accept the active settings baseline revision and full display name", async () => {
  const input = modernInput();
  const prepared = await prepareWelcome({
    ...input,
    content: {
      ...input.content,
      settingsRevision: 0,
      senderName: "A".repeat(130),
    },
  });
  assert.equal(prepared.snapshot.content.settingsRevision, 0);
  assert.equal(prepared.snapshot.content.senderName.length, 130);
});

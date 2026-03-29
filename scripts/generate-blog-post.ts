/**
 * Blog post generation script.
 *
 * Picks the next uncovered BOFU keyword from seo-keyword-tracker.json,
 * calls the Claude API to generate a conformant MDX post, generates a
 * matching SVG cover, and writes both to the repository.
 *
 * Run with: pnpm generate-blog-post
 * Requires: ANTHROPIC_API_KEY in environment
 */

import Anthropic from "@anthropic-ai/sdk";
import fs from "node:fs/promises";
import path from "node:path";

import matter from "gray-matter";
import { z } from "zod";

import { generateCoverSvg } from "./generate-cover";

// ── Types ──────────────────────────────────────────────────────────────────

type KeywordEntry = {
  id: string;
  keyword: string;
  pageTitle: string;
  target: string;
  cta: string;
  pageType: string;
  category: string;
  tags: string[];
  coveredBySlug: string | null;
  coveredAt: string | null;
};

type KeywordTracker = {
  version: 1;
  keywords: KeywordEntry[];
};

// ── Schema — mirrors lib/blog.ts exactly, plus tighter SEO length guards ──

const blogFrontmatterSchema = z.object({
  title: z.string().min(1),
  excerpt: z.string().min(1),
  publishDate: z.string().min(1),
  author: z.string().min(1),
  category: z.string().min(1),
  tags: z.array(z.string().min(1)).min(1),
  coverImage: z.string().min(1),
  seoTitle: z.string().min(1).max(60),
  seoDescription: z.string().min(1).max(160),
  featured: z.boolean().default(false),
});

// ── Paths ──────────────────────────────────────────────────────────────────

const ROOT = process.cwd();
const TRACKER_PATH = path.join(ROOT, "scripts", "seo-keyword-tracker.json");
const BLOG_DIR = path.join(ROOT, "content", "blog");
const COVERS_DIR = path.join(ROOT, "public", "images", "covers");
const DEBUG_DIR = path.join(ROOT, "scripts");

// ── Tracker ────────────────────────────────────────────────────────────────

async function loadTracker(): Promise<KeywordTracker> {
  const raw = await fs.readFile(TRACKER_PATH, "utf8");
  return JSON.parse(raw) as KeywordTracker;
}

async function saveTracker(tracker: KeywordTracker): Promise<void> {
  await fs.writeFile(TRACKER_PATH, JSON.stringify(tracker, null, 2) + "\n", "utf8");
}

function pickNextKeyword(tracker: KeywordTracker): KeywordEntry | null {
  return tracker.keywords.find((k) => k.coveredBySlug === null) ?? null;
}

// ── Slug helpers ───────────────────────────────────────────────────────────

function titleToSlug(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 80);
}

async function ensureUniqueSlug(base: string): Promise<string> {
  let slug = base;
  let counter = 2;
  while (true) {
    try {
      await fs.access(path.join(BLOG_DIR, `${slug}.mdx`));
      slug = `${base}-${counter}`;
      counter++;
    } catch {
      return slug;
    }
  }
}

// ── SERP Research ──────────────────────────────────────────────────────────

/**
 * Searches the live web for the target keyword and returns a structured
 * SERP summary. This runs as a separate Claude call before generation so
 * the main prompt gets real competitive context, not just training data.
 */
async function researchSerp(keyword: string, client: Anthropic): Promise<string> {
  console.log(`  Researching SERP for: "${keyword}"...`);

  type MessageParam = { role: "user" | "assistant"; content: unknown };
  type SerpTool = { type: "web_search_20250305"; name: "web_search" };
  type SerpResponseBlock = { type: string; id?: string; text?: string };
  type SerpResponse = { stop_reason: string | null; content: SerpResponseBlock[] };
  type SerpCreateParams = {
    model: "claude-opus-4-6";
    max_tokens: number;
    betas: ["web-search-2025-03-05"];
    tools: [SerpTool];
    messages: MessageParam[];
  };
  type SerpCreateFn = (params: SerpCreateParams) => Promise<SerpResponse>;

  const createBetaMessage = (client.beta.messages as unknown as { create: SerpCreateFn }).create;
  const messages: MessageParam[] = [
    {
      role: "user",
      content: `Search Google for the keyword: "${keyword}"

After reviewing the results, return a structured SERP brief covering:

1. RESULT TYPES: What page types are ranking top 5 (service pages, blog posts, listicles, directories, comparison pages)?
2. COMPETITOR ANGLES: What main framings/headlines are competitors using? List 3–5 examples.
3. COMMON H2s: What section headings appear frequently across results?
4. CONTENT GAPS: What questions or angles are the top results NOT addressing well?
5. BOFU DIFFERENTIATION: What could a bespoke UK software consultancy say that current results are missing?
6. PAA QUESTIONS: List any People Also Ask questions visible for this keyword.

Be concise. This brief will be used to write a competing blog post.`,
    },
  ];

  let response = await createBetaMessage({
    model: "claude-opus-4-6",
    max_tokens: 1024,
    betas: ["web-search-2025-03-05"],
    tools: [{ type: "web_search_20250305", name: "web_search" }],
    messages,
  });

  // Run the agentic loop until Claude stops using tools
  while (response.stop_reason === "tool_use") {
    const toolUseBlocks = (response.content as Array<{ type: string; id?: string }>).filter(
      (b) => b.type === "tool_use",
    );

    messages.push({ role: "assistant", content: response.content });
    messages.push({
      role: "user",
      content: toolUseBlocks.map((block) => ({
        type: "tool_result",
        tool_use_id: block.id,
        content: "",
      })),
    });

    response = await createBetaMessage({
      model: "claude-opus-4-6",
      max_tokens: 1024,
      betas: ["web-search-2025-03-05"],
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages,
    });
  }

  const textBlock = (response.content as Array<{ type: string; text?: string }>).find(
    (b) => b.type === "text",
  );

  return textBlock?.text ?? "SERP research unavailable.";
}

// ── Claude API ─────────────────────────────────────────────────────────────

const SYSTEM_PROMPT = `
You are a senior content strategist writing blog posts for Faithful Software Solutions Ltd (FSS),
a UK bespoke software consultancy founded in 2025. FSS builds custom portals, dashboards,
workflow automation, MVPs, and legacy system migrations for charities, faith organisations,
schools, and SMEs.

BRAND VOICE RULES:
- Problem-first, outcome-led writing. Name the operational friction before introducing a solution.
- Sector-aware: acknowledge the audience's specific context (charity ops, school admin, SME growth, etc.)
- Never invent statistics, never fabricate case studies, never use placeholder numbers.
- No hype words: "revolutionary", "game-changing", "cutting-edge", "innovative", "seamlessly".
- Short paragraphs. Use plain language. The reader is a decision-maker, not a developer.
- UK English throughout (organisation, customise, recognise, licence, optimise, etc.)
- Be direct. Do not pad. Every sentence should earn its place.
- Do not mention FSS by name until the final CTA block.

TARGET BUYER PROFILE:
- Bottom-of-funnel: vendor selection, comparison, pricing research, or migration intent.
- They know they have a problem. They are evaluating solutions, not being educated from scratch.
- They are a CTO, ops director, charity CEO, founder, or school business manager.

OUTPUT FORMAT — MANDATORY:
Respond with a complete MDX file and nothing else.
Start immediately with the YAML frontmatter opening delimiter ---.
Do not include any explanation, preamble, commentary, or code fences outside the MDX itself.
Do not wrap the output in backtick fences. Output raw MDX directly.

FRONTMATTER SCHEMA — all fields required, exact types:
---
title: <string>
excerpt: <1–2 sentence summary, plain text, no interior quotes>
publishDate: <YYYY-MM-DD>
author: "FSS Growth Team"
category: <string>
tags:
  - <string>
  - <string>
  (minimum 3 tags; primary keyword phrase must appear as one tag)
coverImage: <string starting with /images/covers/>
seoTitle: <string, 30–60 characters, include primary keyword>
seoDescription: <string, 120–160 characters, include primary keyword and a benefit>
featured: false
---

MDX BODY RULES:
- Total body length: 800–1200 words (not counting frontmatter).
- Use ## for H2 section headings, ### for H3 subsections if needed.
- Include exactly 1–2 <Callout title="..."> blocks with a meaningful operational insight.
  Callout format: <Callout title="Tip title">Body text here.</Callout>
- Include exactly 1 <CtaBlock> block, placed after the penultimate body section.
  CtaBlock format: <CtaBlock title="..." body="..." href="/contact" ctaLabel="..." />
- Link to /contact at least once using standard markdown link syntax.
- Do not use any HTML tags other than <Callout> and <CtaBlock>.
- Do not use raw HTML elements like <div>, <span>, <br>, <strong>, <em>.
  Use markdown equivalents (**bold**, *italic*) instead.
`.trim();

function buildUserPrompt(entry: KeywordEntry, today: string, serpBrief: string): string {
  return `
Write a blog post targeting the following BOFU keyword opportunity.

PRIMARY KEYWORD: ${entry.keyword}
RECOMMENDED PAGE TITLE: ${entry.pageTitle}
TARGET AUDIENCE: ${entry.target}
RECOMMENDED CTA TEXT: ${entry.cta}
PAGE TYPE: ${entry.pageType}
PUBLISH DATE: ${today}
COVER IMAGE PATH: /images/covers/${entry.id}.svg
BLOG CATEGORY: ${entry.category}
SUGGESTED TAGS (you may add up to 2 more, keep total under 6): ${entry.tags.join(", ")}

──────────────────────────────────────────
LIVE SERP RESEARCH (use this to differentiate):
${serpBrief}
──────────────────────────────────────────

Use the SERP brief above to:
- Avoid repeating angles that competitors already cover well
- Address the content gaps competitors are missing
- Answer the PAA questions if they are relevant and BOFU
- Choose a headline angle that stands out from what is already ranking

CONTENT STRUCTURE — follow this order:
1. Opening paragraph: name the specific operational friction the target audience is experiencing.
   Make it recognisable. Avoid generic statements.
2. ## What good looks like — explain what an effective solution achieves for this audience.
   No product names. Focus on outcomes and operational clarity.
3. ## What to look for in a supplier — 3–5 practical criteria a decision-maker should use
   when evaluating vendors. Frame around the buyer's risk, not seller capabilities.
4. One <Callout> here with a practical insight the reader can act on immediately.
5. <CtaBlock> driving to /contact with a low-friction prompt matching the recommended CTA text.
6. Closing paragraph: one or two sentences reinforcing the next step and the cost of inaction.

HARD RULES:
- Do not invent statistics.
- Do not fabricate case studies or client names.
- Write in UK English.
- Do not mention FSS, the author, or the company name until the <CtaBlock>.
- The <CtaBlock> title should reference FSS and the specific service.
`.trim();
}

async function generatePostWithClaude(entry: KeywordEntry, today: string): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY environment variable is not set");
  }

  const client = new Anthropic({ apiKey });

  // Step 1: Research the live SERP for competitive context
  let serpBrief: string;
  try {
    serpBrief = await researchSerp(entry.keyword, client);
    console.log("  SERP research complete.");
  } catch (err) {
    console.warn("  SERP research failed, continuing without it:", err);
    serpBrief = "SERP research unavailable for this run.";
  }

  // Step 2: Generate the post using the SERP brief as context
  console.log("  Generating post...");
  const message = await client.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 4096,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: buildUserPrompt(entry, today, serpBrief) }],
  });

  const block = message.content[0];
  if (block.type !== "text") {
    throw new Error(`Unexpected Claude response block type: ${block.type}`);
  }

  return block.text;
}

// ── MDX parsing and validation ─────────────────────────────────────────────

function stripCodeFence(raw: string): string {
  // Handle cases where Claude wraps output in ```mdx ... ``` or ``` ... ```
  return raw
    .replace(/^```(?:mdx)?\s*\n/, "")
    .replace(/\n```\s*$/, "")
    .trim();
}

function validateMdx(
  raw: string,
  entryId: string,
): { slug: string; validatedMdx: string } {
  const cleaned = stripCodeFence(raw);
  const { data, content } = matter(cleaned);

  const parsed = blogFrontmatterSchema.parse(data);

  const slug = titleToSlug(parsed.title);
  // Force the coverImage to match the entry id regardless of what Claude generated
  parsed.coverImage = `/images/covers/${entryId}.svg`;

  const reconstructed = matter.stringify(content, parsed);
  return { slug, validatedMdx: reconstructed };
}

// ── Main ───────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log("Loading keyword tracker...");
  const tracker = await loadTracker();

  const entry = pickNextKeyword(tracker);
  if (!entry) {
    console.log("All keywords covered — nothing to generate.");
    process.exit(0);
  }

  const today = new Date().toISOString().slice(0, 10);
  console.log(`Generating post for keyword: "${entry.keyword}" (${entry.id})`);
  console.log(`Publish date: ${today}`);

  let rawMdx: string;
  try {
    rawMdx = await generatePostWithClaude(entry, today);
  } catch (err) {
    console.error("Claude API call failed:", err);
    process.exit(1);
  }

  let slug: string;
  let validatedMdx: string;
  try {
    ({ slug, validatedMdx } = validateMdx(rawMdx, entry.id));
  } catch (err) {
    const debugPath = path.join(DEBUG_DIR, `debug-output-${entry.id}.mdx`);
    await fs.writeFile(debugPath, rawMdx, "utf8");
    console.error(`Frontmatter validation failed. Raw output saved to ${debugPath}`);
    console.error(err);
    process.exit(1);
  }

  const uniqueSlug = await ensureUniqueSlug(slug);
  const mdxPath = path.join(BLOG_DIR, `${uniqueSlug}.mdx`);
  await fs.writeFile(mdxPath, validatedMdx, "utf8");
  console.log(`Wrote post: ${mdxPath}`);

  const coverSvg = generateCoverSvg({
    title: entry.pageTitle,
    category: entry.category,
    id: entry.id,
    pageType: entry.pageType,
  });
  await fs.mkdir(COVERS_DIR, { recursive: true });
  const coverPath = path.join(COVERS_DIR, `${entry.id}.svg`);
  await fs.writeFile(coverPath, coverSvg, "utf8");
  console.log(`Wrote cover: ${coverPath}`);

  const idx = tracker.keywords.findIndex((k) => k.id === entry.id);
  tracker.keywords[idx].coveredBySlug = uniqueSlug;
  tracker.keywords[idx].coveredAt = today;
  await saveTracker(tracker);
  console.log(`Tracker updated: ${entry.id} → ${uniqueSlug}`);
}

main();

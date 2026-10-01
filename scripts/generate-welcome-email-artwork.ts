import { mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import sharp from "sharp";
import {
  getEmailArtwork,
  welcomeEmailKinds,
} from "../lib/operations/onboarding/email-artwork";
import { packetEditions } from "../lib/operations/onboarding/packet-editions";
import type { WelcomePackId } from "../lib/operations/onboarding/welcome-pack-contract";
import type { WelcomeEmailKind } from "../lib/operations/onboarding/email-artwork";

const navy = "#10233f";
const teal = "#276b65";
const mint = "#c0dbd0";

function label(
  text: string,
  x: number,
  y: number,
  size = 20,
  color = navy,
): string {
  return `<text x="${x}" y="${y}" font-family="Arial,Helvetica,sans-serif" font-size="${size}" fill="${color}">${text}</text>`;
}
function card(
  x: number,
  y: number,
  width: number,
  height: number,
  fill = "#fff",
): string {
  return `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="16" fill="${fill}" stroke="#b8cbc6" stroke-width="2"/>`;
}
function line(x1: number, y1: number, x2: number, y2: number): string {
  return `<path d="M${x1} ${y1} L${x2} ${y2}" fill="none" stroke="${teal}" stroke-width="4" stroke-linecap="round"/>`;
}
function check(x: number, y: number): string {
  return `<circle cx="${x}" cy="${y}" r="18" fill="${teal}"/><path d="M${x - 7} ${y} l5 5 l9 -10" stroke="#fff" stroke-width="3" fill="none"/>`;
}
function browser(x: number, y: number, width: number, height: number): string {
  return (
    card(x, y, width, height) +
    `<path d="M${x} ${y + 42} H${x + width}" stroke="#b8cbc6" stroke-width="2"/>` +
    [14, 28, 42]
      .map(
        (offset) =>
          `<circle cx="${x + offset}" cy="${y + 21}" r="4" fill="${teal}"/>`,
      )
      .join("")
  );
}
function lock(x: number, y: number): string {
  return (
    `<path d="M${x + 12} ${y + 30} v-14 a18 18 0 0 1 36 0 v14" fill="none" stroke="${navy}" stroke-width="5"/>` +
    card(x, y + 28, 60, 50, mint) +
    `<circle cx="${x + 30}" cy="${y + 53}" r="5" fill="${navy}"/>`
  );
}

// Every composition is original vector artwork. Reusable drawing primitives do
// not reuse photographs, crops or a finished header from another material.
const compositions: Record<WelcomePackId, Record<WelcomeEmailKind, string>> = {
  website_build: {
    welcome:
      browser(640, 100, 530, 340) +
      card(664, 165, 280, 124, mint) +
      label("Your website", 685, 205, 27) +
      line(685, 230, 840, 230) +
      card(968, 165, 175, 124, navy) +
      label("Purpose", 991, 236, 22, "#fff") +
      [664, 832, 1000].map((x) => card(x, 310, 143, 92)).join(""),
    proposal:
      card(662, 123, 290, 296, mint) +
      card(691, 100, 290, 296) +
      label("Website scope", 721, 153, 27) +
      line(721, 180, 920, 180) +
      ["Pages", "Functionality", "Review points"]
        .map((text, i) => label(text, 723, 225 + i * 43))
        .join("") +
      line(980, 252, 1030, 252) +
      card(1030, 205, 170, 96, navy) +
      label("Approval", 1050, 261, 22, "#fff"),
    activation:
      browser(710, 90, 425, 340) +
      lock(892, 159) +
      card(743, 292, 357, 52, mint) +
      label("Your project workspace", 765, 326) +
      label("Reviews", 748, 387) +
      label("Files", 928, 387) +
      line(823, 381, 884, 381),
    thank_you:
      card(676, 92, 485, 125, navy) +
      label("Ready for the next step", 706, 164, 28, "#fff") +
      ["Content inputs", "Design direction", "Review arrangements"]
        .map(
          (text, i) =>
            card(700 + i * 12, 241 + i * 65, 418, 51) +
            label(text, 726 + i * 12, 274 + i * 65) +
            check(1080 + i * 12, 267 + i * 65),
        )
        .join(""),
  },
  website_seo: {
    welcome:
      card(650, 95, 535, 76) +
      label("Your customers. Their search.", 728, 142, 25) +
      `<circle cx="684" cy="129" r="12" stroke="${teal}" stroke-width="4" fill="none"/><path d="M693 139 l12 12" stroke="${teal}" stroke-width="4"/>` +
      ["Website structure", "Useful content", "Search foundations"]
        .map(
          (text, i) =>
            card(675 + i * 18, 198 + i * 78, 450, 60, i === 1 ? mint : "#fff") +
            label(text, 699 + i * 18, 236 + i * 78),
        )
        .join(""),
    proposal:
      line(695, 279, 1149, 279) +
      ["Website", "SEO baseline", "Reporting"]
        .map(
          (text, i) =>
            `<circle cx="${720 + i * 205}" cy="279" r="27" fill="${teal}"/>` +
            label(String(i + 1), 713 + i * 205, 286, 22, "#fff") +
            card(
              645 + i * 205,
              i === 1 ? 327 : 125,
              170,
              95,
              i === 1 ? mint : "#fff",
            ) +
            label(text, 660 + i * 205, i === 1 ? 379 : 179, 19) +
            line(
              720 + i * 205,
              i === 1 ? 307 : 220,
              720 + i * 205,
              i === 1 ? 327 : 252,
            ),
        )
        .join(""),
    activation:
      card(665, 133, 226, 240, mint) +
      label("Search", 721, 196, 26) +
      lock(745, 234) +
      card(941, 101, 236, 305) +
      label("Analytics", 982, 162, 26) +
      [64, 112, 86]
        .map(
          (height, i) =>
            `<rect x="${974 + i * 58}" y="${337 - height}" width="34" height="${height}" rx="5" fill="${i === 1 ? teal : mint}"/>`,
        )
        .join("") +
      line(891, 260, 941, 260),
    thank_you:
      browser(650, 94, 527, 340) +
      label("Baseline preparation", 680, 181, 27) +
      card(677, 211, 223, 182, mint) +
      label("Inputs", 702, 251, 22) +
      [281, 318, 355].map((y) => line(704, y, 867, y)).join("") +
      card(925, 211, 224, 78) +
      label("Access agreed", 947, 259) +
      card(925, 314, 224, 79, navy) +
      label("Review cadence", 947, 362, 20, "#fff"),
  },
  systems_portal: {
    welcome:
      line(698, 160, 1010, 270) +
      line(698, 381, 1010, 270) +
      card(639, 107, 195, 101) +
      label("People", 683, 167, 26) +
      card(639, 329, 195, 101, mint) +
      label("Data", 696, 389, 26) +
      card(982, 212, 213, 119, navy) +
      label("Workflows", 1016, 282, 26, "#fff"),
    proposal:
      card(674, 87, 240, 170, mint) +
      label("Roles", 705, 139, 25) +
      label("Owner", 705, 183) +
      label("Contributor", 705, 222) +
      card(942, 135, 248, 171) +
      label("Permissions", 968, 186, 25) +
      label("Approved boundaries", 964, 234, 18) +
      line(914, 220, 942, 220) +
      card(709, 334, 385, 83, navy) +
      label("Review the workflow", 750, 384, 24, "#fff") +
      line(1066, 306, 1066, 334),
    activation:
      `<circle cx="784" cy="258" r="135" fill="${mint}"/>` +
      `<circle cx="784" cy="205" r="36" fill="${teal}"/><path d="M720 307 a64 64 0 0 1 128 0" fill="${teal}"/>` +
      line(917, 258, 1000, 258) +
      lock(1050, 139) +
      card(1000, 273, 213, 65, navy) +
      label("Verified identity", 1019, 313, 20, "#fff") +
      label("Approved role", 1031, 383, 21),
    thank_you:
      card(649, 99, 530, 332) +
      label("Your operating workspace", 677, 153, 26) +
      card(675, 187, 149, 215, navy) +
      label("Plan", 708, 237, 22, "#fff") +
      label("Review", 708, 283, 22, "#fff") +
      label("Deliver", 708, 329, 22, "#fff") +
      ["Sample data", "User roles", "Workflow review"]
        .map(
          (text, i) =>
            card(846, 187 + i * 76, 305, 63, i === 1 ? mint : "#fff") +
            label(text, 868, 226 + i * 76),
        )
        .join(""),
  },
};

const headings: Record<WelcomeEmailKind, readonly [string, string]> = {
  welcome: ["Good work", "starts here."],
  proposal: ["A clear scope.", "A shared plan."],
  activation: ["Your access.", "Your workspace."],
  thank_you: ["The next step", "is together."],
};

async function main(): Promise<void> {
  for (const edition of packetEditions) {
    for (const kind of welcomeEmailKinds) {
      const [first, second] = headings[kind];
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="560" viewBox="0 0 1280 560">
        <rect width="1280" height="560" fill="#eaf1ee"/>
        <rect width="14" height="560" fill="${teal}"/>
        ${label("FSS / " + edition.title.toUpperCase().replace("&", "&amp;"), 68, 105, 19, teal)}
        ${label(first, 68, 235, 52)}${label(second, 68, 302, 52)}
        ${label("Prepared with purpose.", 70, 398, 22, teal)}
        ${compositions[edition.id][kind]}
      </svg>`;
      const destination = join(
        process.cwd(),
        "public",
        getEmailArtwork(edition.id, kind).src,
      );
      await mkdir(dirname(destination), { recursive: true });
      await sharp(Buffer.from(svg))
        .png({ compressionLevel: 9 })
        .toFile(destination);
    }
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});

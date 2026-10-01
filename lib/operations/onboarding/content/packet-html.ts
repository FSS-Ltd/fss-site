import type { WelcomeContent } from "../types";
import { getPacketEdition, packetAssets } from "../packet-editions";
import { escapeHtml } from "./email-html";

export function packetAccessibleHtml(content: WelcomeContent): string {
  if (!content.edition) throw new Error("Select a packet edition.");
  const edition = getPacketEdition(content.edition);
  const clientName = content.clientOrganisationName ?? content.organisationName;
  const cover = packetAssets[edition.coverImageId];
  return `<article aria-label="Welcome packet" style="font-family:Arial,Helvetica,sans-serif;color:#10233f;line-height:1.6;"><header><p>FAITHFUL SOFTWARE SOLUTIONS</p><h1>${escapeHtml(clientName)}: your welcome packet</h1><p>${escapeHtml(edition.title)}</p><img src="${cover.src}" alt="${escapeHtml(cover.alt)}" style="display:block;width:100%;max-width:640px;height:auto;"/><p>Prepared by ${escapeHtml(content.senderName)}<br/>${escapeHtml(content.organisationName)}</p><p>1 / 10</p></header>${content.pages
    .map((page, index) => {
      if (!page.sectionId)
        throw new Error(`Packet section ${page.title} is missing metadata.`);
      const asset = page.imageId ? packetAssets[page.imageId] : undefined;
      const image = asset
        ? `<img src="${asset.src}" alt="${escapeHtml(asset.alt)}" style="display:block;width:100%;max-width:640px;height:auto;"/>`
        : "";
      const body =
        page.layout === "process" || page.layout === "timeline"
          ? `<ol>${page.paragraphs.map((paragraph) => `<li>${escapeHtml(paragraph)}</li>`).join("")}</ol>`
          : page.paragraphs
              .map((paragraph) => `<p>${escapeHtml(paragraph)}</p>`)
              .join("");
      return `<section aria-labelledby="packet-${page.sectionId}"><p>Section ${String(index + 1).padStart(2, "0")}</p><h2 id="packet-${page.sectionId}">${escapeHtml(page.title)}</h2>${image}${body}<p>${index + 2} / 10</p></section>`;
    })
    .join("")}</article>`;
}

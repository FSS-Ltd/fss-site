import path from "node:path";
import PDFDocument from "pdfkit";
import sharp from "sharp";
import { supportsSigningText } from "../../agreements/signing-text";
import {
  getPacketEdition,
  packetAssets,
  packetSectionIds,
} from "../packet-editions";
import type { PacketImageId } from "../packet-editions";
import type { WelcomeContent, WelcomePage } from "../types";
import { packetLayoutNeedsImage } from "../packet-metadata";
import { editorialSectionBody } from "./packet-editorial-page";

const navy = "#10233F";
const teal = "#276B65";
const ink = "#24322D";
const limit = 2 * 1024 * 1024;
const fixedDate = new Date("2026-01-01T00:00:00.000Z");
const images = new Map<PacketImageId, Promise<Buffer>>();
function packetImage(id: PacketImageId): Promise<Buffer> {
  const existing = images.get(id);
  if (existing) return existing;
  const image = sharp(path.join(process.cwd(), "public", packetAssets[id].src))
    .resize({ width: 1000, withoutEnlargement: true })
    .flatten({ background: "#ffffff" })
    .jpeg({ quality: 72 })
    .toBuffer();
  images.set(id, image);
  void image.catch(() => images.delete(id));
  return image;
}
function checkHeight(
  document: PDFKit.PDFDocument,
  text: string,
  width: number,
  y: number,
  fontSize: number,
  section: string,
  bottom = 733,
): number {
  document.fontSize(fontSize);
  const height = document.heightOfString(text, { width, lineGap: 4 });
  if (y + height > bottom)
    throw new Error(
      `Packet section "${section}" exceeds the readable page limit. Shorten this section before approval.`,
    );
  return height;
}
function footer(document: PDFKit.PDFDocument, page: number): void {
  document
    .moveTo(48, 757)
    .lineTo(547, 757)
    .strokeColor("#B8CBC6")
    .lineWidth(0.5)
    .stroke();
  document
    .fillColor(page === 1 ? "#C0DBD0" : teal)
    .font("Helvetica")
    .fontSize(9)
    .text("FAITHFUL SOFTWARE SOLUTIONS", 48, 770, { width: 420 })
    .text(`${page} / 10`, 500, 770, { width: 47, align: "right" });
}
function sectionPage(
  document: PDFKit.PDFDocument,
  page: WelcomePage,
  index: number,
  image?: Buffer,
): void {
  document.addPage();
  document.rect(0, 0, document.page.width, 92).fill(navy);
  document
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(`FSS  /  SECTION ${String(index + 1).padStart(2, "0")}`, 48, 43, {
      characterSpacing: 1.5,
      width: 499,
    });
  document.font("Helvetica-Bold").fillColor(navy);
  const titleHeight = checkHeight(
    document,
    page.title,
    499,
    120,
    30,
    page.title,
    220,
  );
  document.text(page.title, 48, 120, { width: 499, lineGap: 4 });
  const top = 138 + titleHeight;
  if (!image) {
    editorialSectionBody(document, page, index + 1, top);
    footer(document, index + 2);
    return;
  }
  const side = page.layout === "image_left" || page.layout === "image_right";
  const imageLeft = page.layout === "image_left";
  const imageX = side ? (imageLeft ? 48 : 319) : 48;
  const imageWidth = side ? 228 : 499;
  const imageHeight = side ? 340 : 178;
  document.save().rect(imageX, top, imageWidth, imageHeight).clip();
  document.image(image, imageX, top, { cover: [imageWidth, imageHeight] });
  document.restore();
  const x = side ? (imageLeft ? 300 : 48) : 48;
  const width = side ? 247 : 499;
  let y = side ? top : top + 202;
  const diagram = page.layout === "process" || page.layout === "timeline";
  document.font("Helvetica").fillColor(ink);
  for (const [paragraphIndex, paragraph] of page.paragraphs.entries()) {
    const textWidth = diagram ? width - 40 : width;
    const height = checkHeight(
      document,
      paragraph,
      textWidth,
      y,
      12,
      `${page.sectionId}: ${page.title}`,
    );
    if (diagram) {
      document.roundedRect(x, y + 1, 25, 25, 5).fill(teal);
      document
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(String(paragraphIndex + 1), x, y + 8, {
          width: 25,
          align: "center",
        });
    }
    document
      .fillColor(ink)
      .font("Helvetica")
      .fontSize(12)
      .text(paragraph, diagram ? x + 40 : x, y, {
        width: textWidth,
        lineGap: 4,
      });
    y += Math.max(height, diagram ? 28 : 0) + 14;
  }
  footer(document, index + 2);
}
export async function renderPacketPdf(
  content: WelcomeContent,
): Promise<Buffer> {
  if (
    !content.edition ||
    content.pages.length !== 9 ||
    !supportsSigningText(content)
  )
    throw new Error(
      "Designed welcome packets require nine sections with supported Western European text.",
    );
  for (const [index, page] of content.pages.entries()) {
    if (
      page.sectionId !== packetSectionIds[index] ||
      !page.layout ||
      (packetLayoutNeedsImage(page.layout) && !page.imageId) ||
      (page.imageId && !Object.hasOwn(packetAssets, page.imageId))
    )
      throw new Error(`Packet section ${page.title} needs approved metadata.`);
  }
  const edition = getPacketEdition(content.edition);
  const uniqueIds = [
    ...new Set([
      edition.coverImageId,
      ...content.pages
        .map((page) => page.imageId)
        .filter((id): id is PacketImageId => Boolean(id)),
    ]),
  ];
  const loaded = new Map(
    await Promise.all(
      uniqueIds.map(async (id) => [id, await packetImage(id)] as const),
    ),
  );
  const document = new PDFDocument({
    size: "A4",
    margin: 48,
    autoFirstPage: false,
    info: {
      Title: `${edition.title}: welcome packet`,
      Author: content.organisationName,
      CreationDate: fixedDate,
      ModDate: fixedDate,
    },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    let size = 0;
    document.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit)
        document.destroy(new Error("Welcome PDF exceeds 2 MB."));
      else chunks.push(chunk);
    });
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
  });
  try {
    document.addPage();
    document.rect(0, 0, document.page.width, document.page.height).fill(navy);
    document
      .fillColor("#FFFFFF")
      .font("Helvetica-Bold")
      .fontSize(11)
      .text("FAITHFUL SOFTWARE SOLUTIONS", 48, 53, {
        characterSpacing: 1.1,
        width: 499,
      });
    const cover = loaded.get(edition.coverImageId);
    if (!cover) throw new Error("The packet cover image is unavailable.");
    document.save().rect(48, 104, 499, 290).clip();
    document.image(cover, 48, 104, { cover: [499, 290] });
    document.restore();
    document.fillColor("#FFFFFF").font("Helvetica-Bold");
    const clientName =
      content.clientOrganisationName ?? content.organisationName;
    const title = `${clientName}: your welcome packet`;
    const height = checkHeight(document, title, 499, 435, 36, "cover", 622);
    document.text(title, 48, 435, { width: 499, lineGap: 4 });
    document
      .fontSize(18)
      .fillColor("#C0DBD0")
      .text(edition.title, 48, 455 + height, { width: 499 });
    const signature = `Prepared by ${content.senderName}\n${content.organisationName}`;
    document.font("Helvetica").fillColor("#FFFFFF");
    const signatureY = Math.max(650, 485 + height);
    checkHeight(document, signature, 499, signatureY, 11, "cover");
    document.text(signature, 48, signatureY, { width: 499, lineGap: 4 });
    footer(document, 1);
    content.pages.forEach((page, index) => {
      const image = page.imageId ? loaded.get(page.imageId) : undefined;
      if (page.imageId && !image)
        throw new Error(`Packet section ${page.title} image is unavailable.`);
      sectionPage(document, page, index, image);
    });
    document.end();
  } catch (error) {
    document.destroy(
      error instanceof Error
        ? error
        : new Error("Welcome packet rendering failed."),
    );
  }
  return result;
}

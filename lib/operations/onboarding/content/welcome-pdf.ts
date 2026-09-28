import PDFDocument from "pdfkit";
import { supportsSigningText } from "../../agreements/signing-text";
import type { WelcomeContent } from "../types";
import { escapeHtml } from "./welcome-email";
export const welcomePdfLimit = 2 * 1024 * 1024;
export function welcomeAccessibleHtml(content: WelcomeContent): string {
  const clientName = content.clientOrganisationName ?? content.organisationName;
  return `<section aria-label="Welcome guide"><h1>${escapeHtml(clientName)}: your welcome guide</h1>${content.pages.map((page) => `<section><h2>${escapeHtml(page.title)}</h2>${page.paragraphs.map((p) => `<p>${escapeHtml(p)}</p>`).join("")}</section>`).join("")}</section>`;
}
export async function renderWelcomePdf(
  content: WelcomeContent,
): Promise<Buffer> {
  if (
    content.pages.length < 4 ||
    content.pages.length > 6 ||
    !supportsSigningText(content)
  )
    throw new Error(
      "Welcome guide requires 4–6 pages using supported Western European text.",
    );
  const document = new PDFDocument({
    size: "A4",
    margin: 54,
    autoFirstPage: false,
    info: { Title: "Your welcome guide", Author: content.organisationName },
  });
  const chunks: Buffer[] = [];
  const result = new Promise<Buffer>((resolve, reject) => {
    let size = 0;
    document.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > welcomePdfLimit)
        document.destroy(new Error("Welcome PDF exceeds 2 MB."));
      else chunks.push(chunk);
    });
    document.on("error", reject);
    document.on("end", () => resolve(Buffer.concat(chunks)));
  });
  try {
    for (const [index, page] of content.pages.entries()) {
      document.addPage();
      const clientName =
        content.clientOrganisationName ?? content.organisationName;
      document.rect(0, 0, document.page.width, 118).fill("#10233F");
      document
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text("FAITHFUL SOFTWARE SOLUTIONS", 54, 52, { characterSpacing: 1.2 });
      document
        .fillColor("#10233F")
        .fontSize(index === 0 ? 25 : 21)
        .text(
          index === 0 ? `${clientName}: your welcome guide` : page.title,
          54,
          150,
          {
            width: 487,
            lineGap: 4,
          },
        );
      if (index === 0) {
        document
          .moveDown(0.7)
          .fontSize(17)
          .fillColor("#52665D")
          .text(page.title);
      }
      document.moveDown(1).fillColor("#24322D").font("Helvetica").fontSize(12);
      for (const paragraph of page.paragraphs) {
        const height = document.heightOfString(paragraph, {
          width: 487,
          lineGap: 5,
        });
        if (document.y + height > 740)
          throw new Error(
            "Welcome page content exceeds the readable page limit. Shorten it before approval.",
          );
        document.text(paragraph, { width: 487, lineGap: 5 }).moveDown();
      }
      document
        .fontSize(9)
        .fillColor("#52665D")
        .text(`${index + 1} / ${content.pages.length}`, 54, 770);
    }
    document.end();
  } catch (error) {
    document.destroy(
      error instanceof Error
        ? error
        : new Error("Welcome PDF rendering failed."),
    );
  }
  return result;
}

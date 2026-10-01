import type { WelcomePage } from "../types";

/** Native PDF text and shapes keep editorial pages searchable without stock imagery. */
export function editorialSectionBody(
  document: PDFKit.PDFDocument,
  page: WelcomePage,
  section: number,
  top: number,
): void {
  const diagram = page.layout === "process" || page.layout === "timeline";
  const width = 451;
  let y = top + 12;
  document.font("Helvetica");
  for (const [index, paragraph] of page.paragraphs.entries()) {
    const fontSize = diagram ? 15 : index === 0 ? 19 : 15;
    document.fontSize(fontSize);
    const height = document.heightOfString(paragraph, { width, lineGap: 6 });
    const blockHeight = Math.max(height, diagram ? 46 : 40);
    if (y + blockHeight > 725)
      throw new Error(
        `Packet section "${page.sectionId}: ${page.title}" exceeds the readable page limit. Shorten this section before approval.`,
      );
    if (diagram) {
      document.circle(61, y + 14, 13).fill("#276B65");
      if (index < page.paragraphs.length - 1)
        document
          .moveTo(61, y + 29)
          .lineTo(61, y + blockHeight + 17)
          .lineWidth(1)
          .strokeColor("#B8CBC6")
          .stroke();
      document
        .fillColor("#FFFFFF")
        .font("Helvetica-Bold")
        .fontSize(10)
        .text(String(index + 1), 48, y + 10, { width: 26, align: "center" });
    } else {
      document
        .fillColor("#276B65")
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(String(index + 1).padStart(2, "0"), 48, y + 5, { width: 30 });
    }
    document
      .fillColor("#24322D")
      .font("Helvetica")
      .fontSize(fontSize)
      .text(paragraph, 96, y, { width, lineGap: 6 });
    y += blockHeight + 25;
  }
  if (y < 615) {
    document.rect(48, 648, 499, 78).fill("#EAF1EE");
    document
      .fillColor("#276B65")
      .font("Helvetica-Bold")
      .fontSize(52)
      .text(String(section).padStart(2, "0"), 68, 658, { width: 108 });
    document
      .font("Helvetica")
      .fontSize(12)
      .text("YOUR PROJECT\nClear decisions. Shared progress.", 195, 672, {
        width: 318,
        lineGap: 6,
      });
  }
}

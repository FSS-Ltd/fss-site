import path from "node:path";

const navy = "#07182E";
const teal = "#0F7078";
const ink = "#0A1A2E";
const muted = "#46566C";
const line = "#DCE5E8";
const surface = "#F3F8F8";
const left = 48;
const width = 499;
const contentBottom = 742;

function masthead(document: PDFKit.PDFDocument): void {
  document.save();
  document.rect(0, 0, document.page.width, 76).fill(navy);
  document.image(
    path.join(
      process.cwd(),
      "public/redesign/brand/fss-monogram-white-small.png",
    ),
    left,
    25,
    { width: 59 },
  );
  document
    .fillColor("#FFFFFF")
    .font("Helvetica-Bold")
    .fontSize(9)
    .text("FAITHFUL SOFTWARE SOLUTIONS", 126, 28, {
      characterSpacing: 1.1,
      width: 330,
    })
    .fillColor("#A9D8D7")
    .font("Helvetica")
    .fontSize(8)
    .text("SERVICE AGREEMENTS", 126, 44, {
      characterSpacing: 1.3,
      width: 330,
    });
  document.restore();
  // PDFKit continues flowing text after pageAdded; restore its body style too.
  document.fillColor(ink).font("Helvetica").fontSize(10.5);
  document.y = 104;
}

export function startSigningPdf(document: PDFKit.PDFDocument): void {
  masthead(document);
  document.on("pageAdded", () => masthead(document));
}

export function finishSigningPdf(document: PDFKit.PDFDocument): void {
  const { start, count } = document.bufferedPageRange();
  for (let page = start; page < start + count; page += 1) {
    document.switchToPage(page);
    // Footers occupy the reserved bottom margin, outside the flowing text area.
    document.page.margins.bottom = 48;
    document
      .moveTo(left, 759)
      .lineTo(left + width, 759)
      .strokeColor(line)
      .lineWidth(0.7)
      .stroke();
    document
      .fillColor(muted)
      .font("Helvetica")
      .fontSize(8)
      .text("FAITHFUL SOFTWARE SOLUTIONS  /  AGREEMENT", left, 773, {
        width: 400,
      })
      .text(`${page - start + 1} / ${count}`, 490, 773, {
        width: 57,
        align: "right",
      });
  }
}

export function ensureSigningSpace(
  document: PDFKit.PDFDocument,
  height: number,
): void {
  if (document.y + height > contentBottom) document.addPage();
}

export function signingTitle(
  document: PDFKit.PDFDocument,
  eyebrow: string,
  title: string,
): void {
  document
    .fillColor(teal)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(eyebrow, left, document.y, { characterSpacing: 1.4, width });
  document.y += 10;
  document
    .fillColor(navy)
    .font("Helvetica-Bold")
    .fontSize(24)
    .text(title, left, document.y, { width, lineGap: 4 });
  document.y += 12;
}

export function signingSection(
  document: PDFKit.PDFDocument,
  number: string,
  title: string,
): void {
  ensureSigningSpace(document, 66);
  document.y += 10;
  const y = document.y;
  document
    .fillColor(teal)
    .font("Helvetica-Bold")
    .fontSize(9)
    .text(number, left, y + 3, { width: 26 });
  document
    .fillColor(navy)
    .font("Helvetica-Bold")
    .fontSize(14)
    .text(title, left + 34, y, { width: width - 34 });
  document.y = Math.max(document.y, y + 24);
  document
    .moveTo(left, document.y)
    .lineTo(left + width, document.y)
    .strokeColor(line)
    .lineWidth(0.7)
    .stroke();
  document.y += 8;
}

export function signingParagraph(
  document: PDFKit.PDFDocument,
  value: string,
): void {
  document
    .fillColor(ink)
    .font("Helvetica")
    .fontSize(10.5)
    .text(value, left, document.y, { width, lineGap: 3 });
  document.y += 6;
}

export function signingFieldRow(
  document: PDFKit.PDFDocument,
  fields: readonly [string, string][],
): void {
  const columns = fields.length;
  const columnWidth = (width - 18 * (columns - 1)) / columns;
  const valueHeights = fields.map(([, value]) =>
    document
      .font("Helvetica")
      .fontSize(10.5)
      .heightOfString(value, {
        width: columnWidth - 22,
        lineGap: 2,
      }),
  );
  const height = Math.max(42, Math.max(...valueHeights) + 28);
  ensureSigningSpace(document, height + 5);
  const y = document.y;
  for (const [index, [label, value]] of fields.entries()) {
    const x = left + index * (columnWidth + 18);
    document.rect(x, y, columnWidth, height).fill(surface);
    document
      .fillColor(teal)
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(label.toUpperCase(), x + 11, y + 7, {
        width: columnWidth - 22,
        characterSpacing: 0.5,
      });
    document
      .fillColor(ink)
      .font("Helvetica")
      .fontSize(10.5)
      .text(value, x + 11, y + 21, {
        width: columnWidth - 22,
        lineGap: 2,
      });
  }
  document.y = y + height + 5;
}

export function signingDetail(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
): void {
  ensureSigningSpace(document, 42);
  document
    .fillColor(teal)
    .font("Helvetica-Bold")
    .fontSize(8)
    .text(label.toUpperCase(), left, document.y, {
      width,
      characterSpacing: 0.5,
    });
  document.y += 5;
  signingParagraph(document, value);
}

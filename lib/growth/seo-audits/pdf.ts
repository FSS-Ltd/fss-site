import PDFDocument from "pdfkit";

import type { SeoAeoAudit } from "./schema";

const PAGE_MARGIN = 54;
const CONTENT_WIDTH = 487;
const FOOTER_Y = 724;

export type SeoAuditPdfInput = {
  businessName: string;
  websiteUrl: string;
  createdAt: Date;
  audit: SeoAeoAudit;
};

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function ensureSpace(document: PDFKit.PDFDocument, height: number): void {
  if (document.y + height > FOOTER_Y - 18) {
    document.addPage();
  }
}

function writeSectionTitle(document: PDFKit.PDFDocument, title: string): void {
  ensureSpace(document, 36);
  document
    .fillColor("#087f88")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text(title.toUpperCase(), PAGE_MARGIN, document.y, {
      characterSpacing: 1.1,
      width: CONTENT_WIDTH,
    });
  document.moveDown(0.45);
}

function writeParagraph(document: PDFKit.PDFDocument, text: string): void {
  document
    .fillColor("#26364f")
    .font("Helvetica")
    .fontSize(10.5)
    .text(text, PAGE_MARGIN, document.y, {
      width: CONTENT_WIDTH,
      lineGap: 3.5,
    });
  document.moveDown(0.8);
}

function writeFooter(document: PDFKit.PDFDocument): void {
  document.on("pageAdded", () => {
    document
      .fillColor("#72809a")
      .font("Helvetica")
      .fontSize(8)
      .text(
        "Faithful Software Solutions · SEO and AEO audit",
        PAGE_MARGIN,
        FOOTER_Y,
        {
          width: CONTENT_WIDTH,
          align: "center",
        },
      );
  });
  document
    .fillColor("#72809a")
    .font("Helvetica")
    .fontSize(8)
    .text(
      "Faithful Software Solutions · SEO and AEO audit",
      PAGE_MARGIN,
      FOOTER_Y,
      {
        width: CONTENT_WIDTH,
        align: "center",
      },
    );
}

function writeScores(document: PDFKit.PDFDocument, audit: SeoAeoAudit): void {
  const scores = [
    ["Technical SEO", audit.scores.technicalSeo],
    ["On-page SEO", audit.scores.onPageSeo],
    ["Local SEO", audit.scores.localSeo],
    ["Answer-engine readiness", audit.scores.answerEngineReadiness],
  ] as const;
  const boxWidth = (CONTENT_WIDTH - 12) / 2;

  for (const [index, [label, score]] of scores.entries()) {
    const column = index % 2;
    if (column === 0) ensureSpace(document, 73);
    const x = PAGE_MARGIN + column * (boxWidth + 12);
    const y = document.y;
    document
      .roundedRect(x, y, boxWidth, 61, 8)
      .fillAndStroke("#f3f8f9", "#dce9eb");
    document
      .fillColor("#087f88")
      .font("Helvetica-Bold")
      .fontSize(21)
      .text(`${score}/100`, x + 12, y + 10, { width: boxWidth - 24 });
    document
      .fillColor("#4c5e76")
      .font("Helvetica")
      .fontSize(8.5)
      .text(label, x + 12, y + 39, { width: boxWidth - 24 });
    if (column === 0) {
      document.x = PAGE_MARGIN + boxWidth + 12;
      document.y = y;
    } else {
      document.x = PAGE_MARGIN;
      document.y = y + 71;
    }
  }
  document.moveDown(0.25);
}

export async function renderSeoAuditPdf(
  input: SeoAuditPdfInput,
): Promise<Buffer> {
  const document = new PDFDocument({
    autoFirstPage: true,
    bufferPages: true,
    info: {
      Title: `${input.businessName} SEO and AEO audit`,
      Author: "Faithful Software Solutions",
      Subject: "Practical SEO and answer-engine optimisation actions",
    },
    margins: {
      top: PAGE_MARGIN,
      right: PAGE_MARGIN,
      bottom: PAGE_MARGIN,
      left: PAGE_MARGIN,
    },
  });
  const chunks: Buffer[] = [];
  const complete = new Promise<Buffer>((resolve, reject) => {
    document.on("data", (chunk: Buffer) => chunks.push(chunk));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", reject);
  });

  writeFooter(document);
  document
    .fillColor("#087f88")
    .font("Helvetica-Bold")
    .fontSize(10)
    .text("PRACTICAL GROWTH REVIEW", PAGE_MARGIN, document.y, {
      characterSpacing: 1.2,
    });
  document.moveDown(0.55);
  document
    .fillColor("#07182e")
    .font("Helvetica-Bold")
    .fontSize(25)
    .text("SEO and AEO audit", PAGE_MARGIN, document.y, {
      width: CONTENT_WIDTH,
    });
  document.moveDown(0.25);
  document
    .fillColor("#40516a")
    .font("Helvetica")
    .fontSize(11)
    .text(input.businessName, PAGE_MARGIN, document.y, {
      width: CONTENT_WIDTH,
    });
  document
    .fillColor("#72809a")
    .fontSize(9)
    .text(
      `${input.websiteUrl} · Reviewed ${formatDate(input.createdAt)}`,
      PAGE_MARGIN,
      document.y + 5,
      {
        width: CONTENT_WIDTH,
      },
    );
  document.moveDown(2);

  writeSectionTitle(document, "What this review covers");
  writeParagraph(
    document,
    "This is a practical review of publicly accessible pages and search-result signals. It prioritises changes your team can make without a developer. It is not a guarantee of rankings or a substitute for a technical crawl.",
  );

  writeSectionTitle(document, "Snapshot");
  writeScores(document, input.audit);
  writeParagraph(document, input.audit.executiveSummary);

  writeSectionTitle(document, "What is already working");
  for (const strength of input.audit.strengths) {
    ensureSpace(document, 38);
    document
      .fillColor("#15803d")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("✓", PAGE_MARGIN, document.y, { width: 14 });
    document
      .fillColor("#26364f")
      .font("Helvetica")
      .fontSize(10.5)
      .text(strength, PAGE_MARGIN + 18, document.y - 12, {
        width: CONTENT_WIDTH - 18,
        lineGap: 3,
      });
    document.moveDown(0.75);
  }

  writeSectionTitle(document, "Priority actions");
  for (const [index, finding] of input.audit.findings.entries()) {
    ensureSpace(document, 100);
    document
      .fillColor("#07182e")
      .font("Helvetica-Bold")
      .fontSize(12)
      .text(`${index + 1}. ${finding.title}`, PAGE_MARGIN, document.y, {
        width: CONTENT_WIDTH - 90,
      });
    document
      .fillColor("#087f88")
      .font("Helvetica-Bold")
      .fontSize(8)
      .text(
        finding.severity.toUpperCase(),
        PAGE_MARGIN + CONTENT_WIDTH - 80,
        document.y - 14,
        {
          width: 80,
          align: "right",
        },
      );
    document.moveDown(0.35);
    writeParagraph(document, `Observed: ${finding.evidence}`);
    writeParagraph(document, `Why it matters: ${finding.whyItMatters}`);
    document
      .fillColor("#07182e")
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text("Do this without a developer", PAGE_MARGIN, document.y, {
        width: CONTENT_WIDTH,
      });
    document.moveDown(0.4);
    for (const action of finding.actions) {
      ensureSpace(document, 48);
      document
        .fillColor("#087f88")
        .font("Helvetica-Bold")
        .fontSize(9.5)
        .text(`• ${action.title}`, PAGE_MARGIN, document.y, {
          width: CONTENT_WIDTH,
        });
      document.moveDown(0.25);
      writeParagraph(document, action.instructions);
    }
    document.moveDown(0.6);
  }

  writeSectionTitle(document, "Answer-engine readiness");
  writeParagraph(document, input.audit.answerEngineSummary);

  writeSectionTitle(document, "Pages and sources checked");
  for (const source of input.audit.sources) {
    ensureSpace(document, 34);
    document
      .fillColor("#26364f")
      .font("Helvetica-Bold")
      .fontSize(9.5)
      .text(source.title, PAGE_MARGIN, document.y, { width: CONTENT_WIDTH });
    document
      .fillColor("#526078")
      .font("Helvetica")
      .fontSize(8.5)
      .text(
        `${source.url} · Checked ${formatDate(new Date(source.checkedAt))}`,
        PAGE_MARGIN,
        document.y + 2,
        {
          width: CONTENT_WIDTH,
        },
      );
    document.moveDown(0.8);
  }

  document.end();
  return complete;
}

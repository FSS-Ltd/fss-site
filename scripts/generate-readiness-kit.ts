import { writeFile } from "node:fs/promises";
import path from "node:path";
import PDFDocument from "pdfkit";

// Fixed metadata and page layout make this checked-in source reproducible.
const edition = new Date("2026-09-04T00:00:00Z");
const pages = [
  {
    title: "Define the problem",
    intro: "Software Project Readiness Kit",
    guidance:
      "Start with one operational problem. Complete this workbook with the process owner, a budget holder and people doing the work. It supports a decision; it is not a quote or a recommendation to build.",
    prompts: [
      [
        "Problem and owner",
        "Which task is difficult, who experiences it, and who can make decisions about it?",
      ],
      [
        "Evidence and desired outcome",
        "Record a normal period, task volume, active work and waiting time. Label estimates. What change would be useful?",
      ],
      [
        "Current workflow and options",
        "List tools, handoffs and exceptions. What configuration or integration options have you tested?",
      ],
    ],
    note: "Illustrative charity example: referrals arrive in a shared inbox, are reviewed, then copied to an assignment register. Start with that handoff, not a replacement for every system.",
  },
  {
    title: "People, records and access",
    intro: "02 / DISCOVERY",
    guidance:
      "Describe record types and use fictional examples. Do not include real beneficiary, safeguarding, donor or payment records in an initial supplier brief.",
    prompts: [
      [
        "People and responsibilities",
        "Who submits, reviews, approves and supports the work? Include occasional volunteers and people needing assistance.",
      ],
      [
        "Records and boundaries",
        "Which role may view, change or export which records? Who grants access and removes it when someone leaves?",
      ],
      [
        "Systems and dependencies",
        "Which systems hold the source records? Who owns exports, integration access and cleanup? What is still unknown?",
      ],
    ],
    note: "Illustrative church example: test registration with fictional households. Check who may see each record, how errors are corrected and how an administrator helps someone who cannot use the portal.",
  },
  {
    title: "Agree the first release",
    intro: "03 / SCOPE",
    guidance:
      "Define tasks that users can demonstrate, including exceptions. Keep launch essentials separate from later ideas so suppliers can assess the same work.",
    prompts: [
      [
        "Essential tasks and exclusions",
        "What must work at launch? What can wait? Name the person who decides whether a new request belongs in scope.",
      ],
      [
        "Acceptance and recovery",
        "Write three tasks with an expected result. Include a failed submission, restricted access or an unavailable source.",
      ],
      [
        "Migration and adoption",
        "Who checks imported records, trains staff and supports assisted routes? How will work continue during a problem?",
      ],
    ],
    note: "Example acceptance task: an authorised coordinator can assign a request, see its next action and find its history. Record how you will test it; do not assume a screen design proves it works.",
  },
  {
    title: "Make the next decision",
    intro: "04 / OWNERSHIP",
    guidance:
      "Mark each area Ready, Needs evidence or Blocked. Do not turn this into a percentage. A serious unresolved dependency should remain visible.",
    prompts: [
      [
        "Budget and constraints",
        "Separate discovery, delivery, migration and training from hosting, licences, maintenance and support. State assumptions.",
      ],
      [
        "Ongoing owner and exit",
        "Who operates the system after launch? Who controls accounts, backups and the code? What would a handover require?",
      ],
      [
        "Open question / owner / next action",
        "Record the largest uncertainty, who will resolve it and what evidence would change the preferred option.",
      ],
    ],
    note: "Next: compare configuration, integration and bespoke work using the Software Investment Framework. Ask a supplier to scope the next decision and state assumptions before committing to a full build.",
  },
];

export async function generateReadinessKit(): Promise<Buffer> {
  const doc = new PDFDocument({
    autoFirstPage: false,
    size: "A4",
    margin: 48,
    info: {
      Title: "Software Project Readiness Kit",
      Author: "Faithful Software Solutions Ltd",
      Subject:
        "A planning workbook for charity and faith organisation software buyers",
      CreationDate: edition,
      ModDate: edition,
    },
  });
  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (chunk: Buffer) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });
  for (const [index, page] of pages.entries()) {
    doc.addPage();
    doc.rect(0, 0, 595.28, 155).fill("#0a1a2e");
    doc
      .fillColor("#69d2d0")
      .font("Helvetica-Bold")
      .fontSize(10)
      .text("FAITHFUL SOFTWARE SOLUTIONS", 48, 32);
    doc.fillColor("#ffffff").fontSize(12).text(page.intro, 48, 59);
    doc.fontSize(27).text(page.title, 48, 89, { width: 499 });
    doc
      .fillColor("#26364f")
      .font("Helvetica")
      .fontSize(11)
      .text(page.guidance, 48, 181, { width: 499, lineGap: 4 });
    for (const [promptIndex, [title, prompt]] of page.prompts.entries()) {
      const y = 265 + promptIndex * 132;
      doc
        .fillColor("#087f88")
        .font("Helvetica-Bold")
        .fontSize(12)
        .text(title, 48, y);
      doc
        .fillColor("#26364f")
        .font("Helvetica")
        .fontSize(10)
        .text(prompt, 48, y + 22, { width: 499, lineGap: 3 });
      doc.strokeColor("#b8c7cc").lineWidth(0.5);
      for (const lineY of [y + 78, y + 101])
        doc.moveTo(48, lineY).lineTo(547, lineY).stroke();
    }
    doc
      .fillColor("#26364f")
      .font("Helvetica")
      .fontSize(9)
      .text(page.note, 48, 678, { width: 499, lineGap: 3 });
    doc
      .fillColor("#087f88")
      .fontSize(8)
      .text(
        "Scope guidance: faithfulsoftware.dev/guides/custom-software-cost-uk",
        48,
        748,
        { link: "https://faithfulsoftware.dev/guides/custom-software-cost-uk" },
      );
    doc.text(
      "Next steps: faithfulsoftware.dev/resources/software-investment-framework",
      48,
      765,
      {
        link: "https://faithfulsoftware.dev/resources/software-investment-framework",
      },
    );
    doc
      .fillColor("#526477")
      .fontSize(8)
      .text(
        `Edition 4 September 2026  |  Planning aid, not a quotation  |  ${index + 1} / 4`,
        48,
        782,
        { lineBreak: false },
      );
  }
  doc.end();
  return done;
}

async function main(): Promise<void> {
  const output = path.join(
    process.cwd(),
    "public/resource-downloads/software-project-readiness-kit.pdf",
  );
  await writeFile(output, await generateReadinessKit());
  process.stdout.write(`Generated ${output}\n`);
}

if (process.argv[1]?.endsWith("generate-readiness-kit.ts")) {
  void main().catch((error: unknown) => {
    process.stderr.write(`${String(error)}\n`);
    process.exitCode = 1;
  });
}

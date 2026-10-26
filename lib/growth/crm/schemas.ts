import { z } from "zod";
import { isCrmCountryCode } from "./countries";

const id = z.uuid();
const version = z.number().int().positive();
const text = (max: number) => z.string().trim().min(1).max(max);
const pence = z.number().int().min(0).max(2_000_000_000);
export const sourceUrlSchema = z
  .url()
  .max(2000)
  .refine((value) => {
    const url = new URL(value);
    return (
      ["https:", "http:"].includes(url.protocol) &&
      !url.username &&
      !url.password
    );
  }, "Use a public http or https source URL without credentials.");
export const contactSchema = z.strictObject({
  firstName: text(100),
  lastName: text(100),
  roleTitle: text(150).nullable(),
  email: z.string().trim().toLowerCase().pipe(z.email().max(254)),
  sourceUrl: sourceUrlSchema,
  verifiedAt: z.iso.datetime({ offset: true }),
  lawfulBasis: z.enum(["legitimate_interests", "requested_service"]),
});
export const captureLeadSchema = z
  .strictObject({
    kind: z.literal("capture"),
    requestId: id,
    inboundLeadId: id.optional(),
    businessName: text(200),
    companyNumber: z
      .string()
      .trim()
      .min(1, "Enter the company’s registration number.")
      .max(80, "Use 80 characters or fewer.")
      .transform((value) => value.replace(/\s/g, "").toUpperCase()),
    countryCode: z
      .string()
      .trim()
      .toUpperCase()
      .refine(isCrmCountryCode, "Choose a country from the list.")
      .default("GB"),
    corporateType: z.enum([
      "limited_company",
      "llp",
      "scottish_partnership",
      "other_corporate",
    ]),
    sector: text(120),
    locality: text(120),
    sourceUrl: sourceUrlSchema,
    websiteUrl: sourceUrlSchema.nullable(),
    opportunitySummary: text(3000),
    recommendedOffer: text(300),
    oneOffMinPence: pence,
    oneOffMaxPence: pence,
    monthlyPence: pence,
    contact: contactSchema.optional(),
  })
  .refine(
    (value) =>
      value.countryCode !== "GB" || /^[A-Z0-9]{8}$/.test(value.companyNumber),
    {
      message:
        "Enter an 8-character UK company number, such as 01234567. For an overseas company, choose its country first.",
      path: ["companyNumber"],
    },
  )
  .refine((value) => value.oneOffMinPence <= value.oneOffMaxPence, {
    message: "Maximum value must cover the minimum.",
    path: ["oneOffMaxPence"],
  })
  .refine(
    (value) => value.oneOffMaxPence + value.monthlyPence <= 2_147_483_647,
    "Amounts exceed the supported commercial value.",
  );
export const pipelineFiltersSchema = z.strictObject({
  q: z.string().trim().max(120).default(""),
  stage: z
    .enum(["all", "new", "qualified", "proposal", "negotiation"])
    .default("all"),
  sector: z.string().trim().max(120).default(""),
  location: z.string().trim().max(120).default(""),
  nextAction: z.enum(["all", "overdue", "upcoming", "missing"]).default("all"),
  view: z.enum(["board", "list"]).default("board"),
});
export type PipelineFilters = z.infer<typeof pipelineFiltersSchema>;
const updateProspect = z
  .strictObject({
    kind: z.literal("update_prospect"),
    prospectId: id,
    expectedVersion: version,
    opportunitySummary: text(3000),
    recommendedOffer: text(300),
    oneOffMinPence: pence,
    oneOffMaxPence: pence,
    monthlyPence: pence,
  })
  .refine((value) => value.oneOffMinPence <= value.oneOffMaxPence)
  .refine(
    (value) => value.oneOffMaxPence + value.monthlyPence <= 2_147_483_647,
    "Amounts exceed the supported commercial value.",
  );
const updateBusiness = z.strictObject({
  kind: z.literal("update_business"),
  prospectId: id,
  expectedVersion: version,
  tradingName: text(200).nullable(),
  sector: text(120),
  locality: text(120),
  websiteUrl: sourceUrlSchema.nullable(),
});
const updateContact = z.strictObject({
  kind: z.literal("update_contact"),
  prospectId: id,
  expectedVersion: version,
  firstName: text(100).nullable(),
  lastName: text(100).nullable(),
  roleTitle: text(150).nullable(),
});
const updateOpportunity = z
  .strictObject({
    kind: z.literal("update_opportunity"),
    prospectId: id,
    engagementId: id,
    expectedVersion: version,
    name: text(300),
    oneOffValuePence: pence,
    monthlyValuePence: pence,
    probabilityPercent: z.number().int().min(0).max(100),
    expectedCloseDate: z.iso.date().nullable(),
  })
  .refine(
    (value) =>
      value.oneOffValuePence + value.monthlyValuePence <= 2_147_483_647,
    "Amounts exceed the supported commercial value.",
  );
const taskFields = {
  title: text(300),
  dueAt: z.iso.datetime({ offset: true }),
};
export const crmCommandSchema = z.discriminatedUnion("kind", [
  captureLeadSchema,
  z.strictObject({
    kind: z.literal("attach_contact"),
    prospectId: id,
    expectedVersion: version,
    contact: contactSchema,
  }),
  z.strictObject({
    kind: z.literal("create_opportunity"),
    prospectId: id,
    requestId: id,
    expectedVersion: version,
  }),
  updateProspect,
  updateBusiness,
  updateContact,
  updateOpportunity,
  z.strictObject({
    kind: z.literal("add_activity"),
    prospectId: id,
    requestId: id,
    activityType: z.enum(["note", "call", "meeting"]),
    body: text(10000),
  }),
  z.strictObject({
    kind: z.literal("create_task"),
    prospectId: id,
    requestId: id,
    ...taskFields,
  }),
  z.strictObject({
    kind: z.literal("update_task"),
    prospectId: id,
    taskId: id,
    expectedVersion: version,
    ...taskFields,
  }),
  z.strictObject({
    kind: z.literal("task_status"),
    prospectId: id,
    taskId: id,
    expectedVersion: version,
    completed: z.boolean(),
  }),
  z.strictObject({
    kind: z.literal("promote_task"),
    prospectId: id,
    taskId: id,
    expectedVersion: version,
    prospectVersion: version,
  }),
  z.strictObject({
    kind: z.literal("save_view"),
    requestId: id,
    name: text(80),
    filters: pipelineFiltersSchema,
  }),
  z.strictObject({
    kind: z.literal("rename_view"),
    viewId: id,
    expectedVersion: version,
    name: text(80),
  }),
  z.strictObject({
    kind: z.literal("delete_view"),
    viewId: id,
    expectedVersion: version,
  }),
]);
export type CrmCommand = z.infer<typeof crmCommandSchema>;
export type CaptureLead = z.infer<typeof captureLeadSchema>;
export type CrmCommandResult = (
  | { prospectId: string; recordId?: string }
  | { recordId: string; prospectId?: undefined }
) & { alreadyExisted?: boolean };

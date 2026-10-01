import { z } from "zod";

export const deliveryCapacitySchema = z.enum([
  "standard",
  "limited",
  "priority",
]);
const displayNameSchema = z.string().trim().min(1).max(160);
export const studioTimezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(100)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat("en", { timeZone: value });
      return true;
    } catch {
      return false;
    }
  }, "Choose a valid IANA timezone.");
const communicationSchema = z.strictObject({
  replyTo: z.email().trim().max(254).nullable(),
  responseExpectationHours: z.number().int().min(1).max(168),
});

export const activeStudioSettingsSchema = z.strictObject({
  revision: z.number().int().min(0),
  displayName: displayNameSchema,
  replyTo: communicationSchema.shape.replyTo,
  timezone: studioTimezoneSchema,
  responseExpectationHours: communicationSchema.shape.responseExpectationHours,
  deliveryCapacity: deliveryCapacitySchema,
});
export type ActiveStudioSettings = Readonly<
  z.infer<typeof activeStudioSettingsSchema>
>;
export const defaultActiveStudioSettings: ActiveStudioSettings = Object.freeze({
  revision: 0,
  displayName: "Faithful Software Solutions",
  replyTo: null,
  timezone: "Europe/London",
  responseExpectationHours: 48,
  deliveryCapacity: "standard",
});

const expectedRevision = z.number().int().min(0);
export const studioSettingsSectionUpdateSchema = z.discriminatedUnion(
  "section",
  [
    z.strictObject({
      section: z.literal("identity"),
      expectedRevision,
      values: z.strictObject({ displayName: displayNameSchema }),
    }),
    z.strictObject({
      section: z.literal("communication"),
      expectedRevision,
      values: communicationSchema,
    }),
    z.strictObject({
      section: z.literal("timezone"),
      expectedRevision,
      values: z.strictObject({ timezone: studioTimezoneSchema }),
    }),
    z.strictObject({
      section: z.literal("delivery"),
      expectedRevision,
      values: z.strictObject({ deliveryCapacity: deliveryCapacitySchema }),
    }),
  ],
);
export type StudioSettingsSectionUpdate = z.infer<
  typeof studioSettingsSectionUpdateSchema
>;
export type StudioSettingsSection = StudioSettingsSectionUpdate["section"];
export type StudioPresentationSettings = Pick<
  ActiveStudioSettings,
  "revision" | "displayName" | "timezone" | "responseExpectationHours"
>;
export const studioPresentationSettingsSchema = activeStudioSettingsSchema.pick(
  {
    revision: true,
    displayName: true,
    timezone: true,
    responseExpectationHours: true,
  },
);

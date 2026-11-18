import { z } from "zod";

export const reviewedRecipientSchema = z
  .object({
    email: z
      .email()
      .max(254)
      .refine((email) => email === email.trim().toLowerCase()),
    contactId: z.uuid(),
    contactVersion: z.number().int().positive(),
    prospectVersion: z.number().int().positive(),
  })
  .strict();

export type ReviewedRecipient = z.infer<typeof reviewedRecipientSchema>;

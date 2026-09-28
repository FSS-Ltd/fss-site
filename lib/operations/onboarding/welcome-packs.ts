import { randomUUID } from "node:crypto";
import { z } from "zod";
import { withFssAdminTransaction } from "../auth/staff-transaction";
import type { FssAdminContext } from "../auth/staff-types";
import type { OperationsDb } from "../db/client";
import { parseOnboardingTemplateDraft } from "./workspace-schema";
import {
  welcomePackContentSchema,
  welcomePackIds,
  type WelcomePack,
  type WelcomePackId,
} from "./welcome-pack-contract";

export {
  welcomePackContentSchema,
  welcomePackIds,
} from "./welcome-pack-contract";
export type {
  WelcomePack,
  WelcomePackContent,
  WelcomePackId,
  WelcomePackVersion,
} from "./welcome-pack-contract";
const welcomePackTitles: Readonly<Record<WelcomePackId, string>> = {
  website_build: "Standard website build",
  website_seo: "Website with ongoing SEO support",
  systems_portal: "Full systems portal",
};

const packCommandSchema = z.discriminatedUnion("action", [
  z.strictObject({
    action: z.literal("save_draft"),
    packId: z.enum(welcomePackIds),
    content: welcomePackContentSchema,
    expectedVersion: z.number().int().positive(),
    reviewReference: z.string().trim().min(1).max(200),
  }),
  z.strictObject({
    action: z.literal("publish"),
    packId: z.enum(welcomePackIds),
    expectedDraftVersion: z.number().int().positive(),
    reviewReference: z.string().trim().min(1).max(200),
  }),
  z.strictObject({
    action: z.literal("apply_to_client"),
    organisationId: z.uuid(),
    packVersionId: z.uuid(),
    reviewReference: z.string().trim().min(1).max(200),
  }),
]);

export type WelcomePackCommand = z.infer<typeof packCommandSchema>;

type PackRow = {
  id: WelcomePackId;
  title: string;
  draftContent: unknown;
  draftVersion: number;
  publishedVersion: number;
};
type VersionRow = {
  content: unknown;
  id: string;
  version: number;
  publishedAt: string;
};

export async function listStaffWelcomePacks(
  db: OperationsDb,
  admin: FssAdminContext,
): Promise<WelcomePack[]> {
  return withFssAdminTransaction(db, admin, async (tx) => {
    const packs = await tx<PackRow[]>`
      select id, title, draft_content as "draftContent",
        draft_version as "draftVersion", published_version as "publishedVersion"
      from operations.welcome_packs
      order by case id
        when 'website_build' then 1
        when 'website_seo' then 2
        else 3
      end
    `;
    const versions = await tx<Array<VersionRow & { packId: WelcomePackId }>>`
      select pack_id as "packId", id, version, content,
        published_at::text as "publishedAt"
      from operations.welcome_pack_versions
      order by pack_id, version desc
    `;
    return packs.map((pack) => ({
      id: pack.id,
      title: pack.title,
      draftVersion: pack.draftVersion,
      publishedVersion: pack.publishedVersion,
      content: welcomePackContentSchema.parse(pack.draftContent),
      versions: versions
        .filter((version) => version.packId === pack.id)
        .map(({ content, id, version, publishedAt }) => ({
          content: welcomePackContentSchema.parse(content),
          id,
          version,
          publishedAt,
        })),
    }));
  });
}

export async function executeStaffWelcomePackCommand(
  db: OperationsDb,
  admin: FssAdminContext,
  raw: unknown,
): Promise<
  | { kind: "welcome_pack_draft"; packId: WelcomePackId; draftVersion: number }
  | {
      kind: "welcome_pack_version";
      packId: WelcomePackId;
      id: string;
      version: number;
    }
  | {
      kind: "welcome_pack_applied";
      templateId: string;
      templateVersionId: string;
    }
> {
  const command = packCommandSchema.parse(raw);
  if (command.action === "apply_to_client") {
    const applied = await applyStaffWelcomePack(db, admin, command);
    return { kind: "welcome_pack_applied", ...applied };
  }
  return withFssAdminTransaction(db, admin, async (tx) => {
    if (command.action === "save_draft") {
      const validated = welcomePackContentSchema.parse(command.content);
      parseOnboardingTemplateDraft({
        name: welcomePackTitles[command.packId],
        tasks: validated.tasks,
      });
      const [updated] = await tx<Array<{ draftVersion: number }>>`
        update operations.welcome_packs
        set draft_content = ${tx.json(validated)},
          draft_version = draft_version + 1, updated_by = ${admin.actorId},
          updated_at = clock_timestamp()
        where id = ${command.packId} and draft_version = ${command.expectedVersion}
        returning draft_version as "draftVersion"
      `;
      if (!updated) throw new WelcomePackConflict();
      await tx`
        insert into operations.welcome_pack_audit_events(
          pack_id, actor_id, action, review_reference, correlation_id
        ) values (
          ${command.packId}, ${admin.actorId}, 'draft_saved',
          ${command.reviewReference}, ${admin.correlationId}
        )
      `;
      return {
        kind: "welcome_pack_draft",
        packId: command.packId,
        draftVersion: updated.draftVersion,
      };
    }

    const [pack] = await tx<
      Array<{
        title: string;
        content: unknown;
        publishedVersion: number;
        draftVersion: number;
      }>
    >`
      select title, draft_content as content, published_version as "publishedVersion",
        draft_version as "draftVersion"
      from operations.welcome_packs
      where id = ${command.packId}
      for update
    `;
    if (!pack || pack.draftVersion !== command.expectedDraftVersion)
      throw new WelcomePackConflict();
    const content = welcomePackContentSchema.parse(pack.content);
    parseOnboardingTemplateDraft({ name: pack.title, tasks: content.tasks });
    const version = pack.publishedVersion + 1;
    const [published] = await tx<Array<{ id: string }>>`
      insert into operations.welcome_pack_versions(
        pack_id, version, title, content, published_by, review_reference
      ) values (
        ${command.packId}, ${version}, ${pack.title}, ${tx.json(content)},
        ${admin.actorId}, ${command.reviewReference}
      ) returning id
    `;
    if (!published)
      throw new Error("The welcome pack version was not published.");
    const [publishedDraft] = await tx<Array<{ draftVersion: number }>>`
      update operations.welcome_packs
      set published_version = ${version}, draft_version = draft_version + 1,
        updated_by = ${admin.actorId},
        updated_at = clock_timestamp()
      where id = ${command.packId}
        and draft_version = ${command.expectedDraftVersion}
      returning draft_version as "draftVersion"
    `;
    if (!publishedDraft) throw new WelcomePackConflict();
    await tx`
      insert into operations.welcome_pack_audit_events(
        pack_id, version_id, actor_id, action, review_reference, correlation_id
      ) values (
        ${command.packId}, ${published.id}, ${admin.actorId}, 'version_published',
        ${command.reviewReference}, ${admin.correlationId}
      )
    `;
    return {
      kind: "welcome_pack_version",
      packId: command.packId,
      id: published.id,
      version,
    };
  });
}

export async function applyStaffWelcomePack(
  db: OperationsDb,
  admin: FssAdminContext,
  input: {
    organisationId: string;
    packVersionId: string;
    reviewReference: string;
  },
): Promise<{ templateId: string; templateVersionId: string }> {
  const organisationId = z.uuid().parse(input.organisationId);
  const packVersionId = z.uuid().parse(input.packVersionId);
  const reviewReference = z
    .string()
    .trim()
    .min(1)
    .max(200)
    .parse(input.reviewReference);
  const templateId = randomUUID();
  return withFssAdminTransaction(db, admin, async (tx) => {
    const [applied] = await tx<
      Array<{ templateId: string; templateVersionId: string }>
    >`
      select template_id as "templateId", template_version_id as "templateVersionId"
      from operations.apply_welcome_pack_to_client(
        ${organisationId}, ${packVersionId}, ${templateId}, ${reviewReference}
      )
    `;
    if (!applied) throw new Error("The welcome pack could not be applied.");
    return applied;
  });
}

export class WelcomePackConflict extends Error {
  constructor(message = "This welcome pack changed. Refresh and try again.") {
    super(message);
    this.name = "WelcomePackConflict";
  }
}

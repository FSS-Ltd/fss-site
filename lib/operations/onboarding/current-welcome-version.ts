import type { OperationsTransaction } from "../db/client";
import { JourneyConflict } from "./command-types";
import { welcomePackContentSchema } from "./welcome-pack-contract";
import type { WelcomePackId } from "./welcome-pack-contract";

export async function assertCurrentDesignedWelcomeVersion(
  tx: OperationsTransaction,
  versionId: string | undefined,
  edition: WelcomePackId | undefined,
): Promise<void> {
  if (!versionId || !edition) throw stalePacket();
  const [version] = await tx<Array<{ packId: string; content: unknown }>>`
    select v.pack_id as "packId", v.content
    from operations.welcome_pack_versions v
    join operations.welcome_packs p on p.id = v.pack_id
    where v.id = ${versionId} and p.published_version = v.version
  `;
  const parsed = welcomePackContentSchema.safeParse(version?.content);
  if (
    version?.packId !== edition ||
    !parsed.success ||
    parsed.data.rendererVersion !== 2 ||
    parsed.data.edition !== edition
  )
    throw stalePacket();
}

function stalePacket(): JourneyConflict {
  return new JourneyConflict(
    "stale_preview",
    "The selected welcome packet is not the current published ten-page edition. Select it again and prepare a new preview.",
  );
}

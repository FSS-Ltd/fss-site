import { randomUUID } from "node:crypto";

import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import {
  persistEmailAssetForRun,
  prospectBelongsToResearchRun,
} from "@/lib/growth/email/assets/repository";
import { createEmailAssetPostHandler } from "@/lib/growth/email/assets/route-handler";
import {
  normaliseEmailImage,
  storeEmailAsset,
} from "@/lib/growth/email/assets/service";
import { vercelBlobAdapter } from "@/lib/growth/email/assets/vercel-blob";

export const runtime = "nodejs";

const AGENT_KEY_ID = "weekday-agent-v1";

export async function POST(request: Request): Promise<Response> {
  const environment = readGrowthServerEnv();
  const db = getGrowthDb();
  const handler = createEmailAssetPostHandler({
    agentKeyId: AGENT_KEY_ID,
    agentHmacSecret: environment.agentHmacSecret ?? "",
    createCorrelationId: randomUUID,
    now: () => new Date(),
    prospectBelongsToRun: (input) => prospectBelongsToResearchRun(db, input),
    storeAsset: (input) =>
      storeEmailAsset(input, {
        createId: randomUUID,
        normaliseImage: normaliseEmailImage,
        putBlob: vercelBlobAdapter.putBlob,
        deleteBlob: vercelBlobAdapter.deleteBlob,
        persistAsset: (asset) => persistEmailAssetForRun(db, asset),
      }),
    reportUnexpectedError: ({ correlationId, error }) => {
      console.error("Growth OS email asset upload failed.", {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}

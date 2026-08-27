import { randomUUID } from "node:crypto";

import { readGrowthServerEnv } from "@/lib/growth/config/env";
import { getGrowthDb } from "@/lib/growth/db/client";
import {
  persistProspectPreviewAssetForRun,
  sourceEvidenceCanAcceptAsset,
} from "@/lib/growth/prospect-previews/assets/repository";
import { createProspectPreviewAssetPostHandler } from "@/lib/growth/prospect-previews/assets/route-handler";
import {
  normaliseProspectPreviewImage,
  storeProspectPreviewAsset,
} from "@/lib/growth/prospect-previews/assets/service";
import { vercelPreviewBlobAdapter } from "@/lib/growth/prospect-previews/assets/vercel-blob";

export const runtime = "nodejs";

const AGENT_KEY_ID = "weekday-agent-v1";

export async function POST(request: Request): Promise<Response> {
  const environment = readGrowthServerEnv();
  const db = getGrowthDb();
  const handler = createProspectPreviewAssetPostHandler({
    agentKeyId: AGENT_KEY_ID,
    agentHmacSecret: environment.agentHmacSecret ?? "",
    createCorrelationId: randomUUID,
    now: () => new Date(),
    validateSourceEvidence: (input) => sourceEvidenceCanAcceptAsset(db, input),
    storeAsset: (input) =>
      storeProspectPreviewAsset(input, {
        createId: randomUUID,
        normaliseImage: normaliseProspectPreviewImage,
        putPrivateBlob: vercelPreviewBlobAdapter.putPrivateBlob,
        deleteBlob: vercelPreviewBlobAdapter.deleteBlob,
        persistAsset: (asset) => persistProspectPreviewAssetForRun(db, asset),
      }),
    reportUnexpectedError: ({ correlationId, error }) => {
      console.error("Prospect preview asset upload failed.", {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(request);
}

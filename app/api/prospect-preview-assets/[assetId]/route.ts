import { randomUUID } from "node:crypto";

import { getGrowthDb } from "@/lib/growth/db/client";
import {
  findRenderableProspectPreviewAsset,
} from "@/lib/growth/prospect-previews/assets/repository";
import { createProspectPreviewAssetGetHandler } from "@/lib/growth/prospect-previews/assets/render-route-handler";
import { vercelPreviewBlobAdapter } from "@/lib/growth/prospect-previews/assets/vercel-blob";

export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{ assetId: string }>;
};

export async function GET(
  _request: Request,
  { params }: RouteContext,
): Promise<Response> {
  const { assetId } = await params;
  const db = getGrowthDb();
  const handler = createProspectPreviewAssetGetHandler({
    loadRenderableAsset: (currentAssetId) =>
      findRenderableProspectPreviewAsset(db, {
        assetId: currentAssetId,
        isProduction: process.env.VERCEL_ENV === "production",
      }),
    readPrivateBlob: vercelPreviewBlobAdapter.getPrivateBlob,
    createCorrelationId: randomUUID,
    reportUnexpectedError: ({ correlationId, error }) => {
      console.error("Prospect preview asset read failed.", {
        correlationId,
        errorName: error instanceof Error ? error.name : "UnknownError",
      });
    },
  });

  return handler(assetId);
}

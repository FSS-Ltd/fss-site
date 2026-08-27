const ASSET_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type RenderableProspectPreviewAsset = {
  blobUrl: string;
  contentType: "image/webp";
};

export type PrivatePreviewBlob = {
  stream: ReadableStream<Uint8Array>;
  contentType: string;
};

export type ProspectPreviewAssetGetRouteDependencies = {
  loadRenderableAsset: (
    assetId: string,
  ) => Promise<RenderableProspectPreviewAsset | null>;
  readPrivateBlob: (blobUrl: string) => Promise<PrivatePreviewBlob | null>;
  createCorrelationId: () => string;
  reportUnexpectedError: (input: {
    correlationId: string;
    error: unknown;
  }) => void;
};

function notFoundResponse(): Response {
  return new Response("Not found", {
    status: 404,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
      "x-robots-tag": "noindex, nofollow",
    },
  });
}

export function createProspectPreviewAssetGetHandler(
  dependencies: ProspectPreviewAssetGetRouteDependencies,
): (assetId: string) => Promise<Response> {
  return async (assetId) => {
    if (!ASSET_ID_PATTERN.test(assetId)) return notFoundResponse();

    const correlationId = dependencies.createCorrelationId();
    try {
      const asset = await dependencies.loadRenderableAsset(assetId);
      if (asset === null) return notFoundResponse();

      const blob = await dependencies.readPrivateBlob(asset.blobUrl);
      if (blob === null || blob.contentType !== asset.contentType) {
        return notFoundResponse();
      }

      return new Response(blob.stream, {
        status: 200,
        headers: {
          "cache-control": "private, no-store",
          "content-type": asset.contentType,
          "x-content-type-options": "nosniff",
          "x-robots-tag": "noindex, nofollow",
        },
      });
    } catch (error) {
      dependencies.reportUnexpectedError({ correlationId, error });
      return notFoundResponse();
    }
  };
}

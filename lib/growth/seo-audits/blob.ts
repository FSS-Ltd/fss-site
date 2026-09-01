import { del, put } from "@vercel/blob";

const IMMUTABLE_CACHE_SECONDS = 365 * 24 * 60 * 60;

export type SeoAuditBlobStorage = {
  putReport: (input: {
    pathname: string;
    bytes: Uint8Array;
  }) => Promise<{ url: string }>;
  deleteReport: (url: string) => Promise<void>;
};

export const vercelSeoAuditBlobStorage: SeoAuditBlobStorage = {
  putReport: async ({ pathname, bytes }) => {
    const result = await put(pathname, Buffer.from(bytes), {
      access: "public",
      addRandomSuffix: false,
      allowOverwrite: false,
      cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS,
      contentType: "application/pdf",
    });
    return { url: result.url };
  },
  deleteReport: del,
};

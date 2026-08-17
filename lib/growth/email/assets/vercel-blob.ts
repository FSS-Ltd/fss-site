import { del, put } from "@vercel/blob";

import type { EmailAssetDependencies } from "./service";

const IMMUTABLE_CACHE_SECONDS = 365 * 24 * 60 * 60;

type BlobPutOptions = {
  access: "public";
  addRandomSuffix: false;
  allowOverwrite: false;
  cacheControlMaxAge: number;
  contentType: "image/webp";
};

export type VercelBlobClient = {
  put: (
    pathname: string,
    body: Buffer,
    options: BlobPutOptions,
  ) => Promise<{ url: string }>;
  del: (url: string) => Promise<void>;
};

export type EmailAssetBlobAdapter = Pick<
  EmailAssetDependencies,
  "putBlob" | "deleteBlob"
>;

export function createVercelBlobAdapter(
  client: VercelBlobClient,
): EmailAssetBlobAdapter {
  return {
    putBlob: async ({ pathname, bytes, contentType }) =>
      client.put(pathname, Buffer.from(bytes), {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: false,
        cacheControlMaxAge: IMMUTABLE_CACHE_SECONDS,
        contentType,
      }),
    deleteBlob: (url) => client.del(url),
  };
}

const vercelBlobClient: VercelBlobClient = {
  put: async (pathname, body, options) => {
    const result = await put(pathname, body, options);
    return { url: result.url };
  },
  del,
};

export const vercelBlobAdapter = createVercelBlobAdapter(vercelBlobClient);

import { del, get, put } from "@vercel/blob";

import type { ProspectPreviewAssetDependencies } from "./service";

type PrivateBlobPutOptions = {
  access: "private";
  addRandomSuffix: false;
  allowOverwrite: false;
  contentType: "image/webp";
};

export type VercelPreviewBlobClient = {
  put: (
    pathname: string,
    body: Buffer,
    options: PrivateBlobPutOptions,
  ) => Promise<{ url: string }>;
  del: (url: string) => Promise<void>;
  get: (
    url: string,
    options: { access: "private" },
  ) => Promise<
    | {
        statusCode: 200;
        stream: ReadableStream<Uint8Array>;
        blob: { contentType: string };
      }
    | { statusCode: 304 }
    | null
  >;
};

export type ProspectPreviewBlobAdapter = Pick<
  ProspectPreviewAssetDependencies,
  "putPrivateBlob" | "deleteBlob"
> & {
  getPrivateBlob: (url: string) => Promise<
    | { stream: ReadableStream<Uint8Array>; contentType: string }
    | null
  >;
};

export function createVercelPreviewBlobAdapter(
  client: VercelPreviewBlobClient,
): ProspectPreviewBlobAdapter {
  return {
    putPrivateBlob: async ({ pathname, bytes, contentType }) =>
      client.put(pathname, Buffer.from(bytes), {
        access: "private",
        addRandomSuffix: false,
        allowOverwrite: false,
        contentType,
      }),
    deleteBlob: (url) => client.del(url),
    getPrivateBlob: async (url) => {
      const result = await client.get(url, { access: "private" });
      if (result === null || result.statusCode !== 200) return null;
      return {
        stream: result.stream,
        contentType: result.blob.contentType,
      };
    },
  };
}

const vercelPreviewBlobClient: VercelPreviewBlobClient = {
  put: async (pathname, body, options) => {
    const result = await put(pathname, body, options);
    return { url: result.url };
  },
  del,
  get,
};

export const vercelPreviewBlobAdapter = createVercelPreviewBlobAdapter(
  vercelPreviewBlobClient,
);

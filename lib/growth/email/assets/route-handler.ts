import { verifyAgentRequest } from "../../integrations/agent-signature";
import {
  EmailAssetValidationError,
  type EmailAssetKind,
  type StoreEmailAssetInput,
  type StoredEmailAsset,
} from "./service";

const MAX_MULTIPART_BYTES = 512 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSET_KINDS = new Set<EmailAssetKind>([
  "cold_first_email",
  "newsletter",
  "site_email",
]);
const MULTIPART_FIELDS = [
  "runId",
  "prospectId",
  "altText",
  "promptSummary",
  "assetKind",
  "file",
] as const;
const MULTIPART_FIELD_SET = new Set<string>(MULTIPART_FIELDS);

const AGENT_KEY_ID_HEADER = "x-fss-key-id";
const AGENT_TIMESTAMP_HEADER = "x-fss-timestamp";
const AGENT_SIGNATURE_HEADER = "x-fss-signature";

type ProspectRunReference = {
  runId: string;
  prospectId: string;
};

export type EmailAssetRouteDependencies = {
  agentKeyId: string;
  agentHmacSecret: string;
  createCorrelationId: () => string;
  now: () => Date;
  prospectBelongsToRun: (input: ProspectRunReference) => Promise<boolean>;
  storeAsset: (input: StoreEmailAssetInput) => Promise<StoredEmailAsset>;
  reportUnexpectedError: (input: {
    correlationId: string;
    error: unknown;
  }) => void;
};

class PayloadTooLargeError extends Error {}

function jsonResponse(body: unknown, status: number): Response {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

function errorResponse(
  status: number,
  code: string,
  message: string,
  correlationId: string,
): Response {
  return jsonResponse({ ok: false, code, message, correlationId }, status);
}

async function readRawBody(request: Request): Promise<Uint8Array<ArrayBuffer>> {
  const declaredLength = request.headers.get("content-length");
  if (
    declaredLength !== null &&
    /^\d+$/.test(declaredLength) &&
    Number(declaredLength) > MAX_MULTIPART_BYTES
  ) {
    throw new PayloadTooLargeError();
  }

  if (request.body === null) {
    return new Uint8Array();
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let totalBytes = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) {
        break;
      }

      const chunk = new Uint8Array(value);
      totalBytes += chunk.byteLength;
      if (totalBytes > MAX_MULTIPART_BYTES) {
        await reader.cancel();
        throw new PayloadTooLargeError();
      }
      chunks.push(chunk);
    }
  } finally {
    reader.releaseLock();
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

async function parseMultipart(
  rawBody: Uint8Array<ArrayBuffer>,
  contentType: string | null,
): Promise<FormData | null> {
  if (!contentType?.toLowerCase().startsWith("multipart/form-data;")) {
    return null;
  }

  try {
    const multipartRequest = new Request("http://growth.local", {
      method: "POST",
      headers: { "content-type": contentType },
      body: rawBody,
    });
    return await multipartRequest.formData();
  } catch {
    return null;
  }
}

function requiredString(form: FormData, name: string): string | null {
  const value = form.get(name);
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

type ParsedAssetInput = Omit<StoreEmailAssetInput, "bytes"> & { file: File };

function parseAssetInput(form: FormData): ParsedAssetInput | null {
  if (
    [...form.keys()].some((name) => !MULTIPART_FIELD_SET.has(name)) ||
    MULTIPART_FIELDS.some((name) => form.getAll(name).length !== 1)
  ) {
    return null;
  }

  const runId = requiredString(form, "runId");
  const prospectId = requiredString(form, "prospectId");
  const altText = requiredString(form, "altText");
  const promptSummary = requiredString(form, "promptSummary");
  const assetKind = requiredString(form, "assetKind");
  const file = form.get("file");

  if (
    runId === null ||
    prospectId === null ||
    altText === null ||
    promptSummary === null ||
    assetKind === null ||
    !(file instanceof File) ||
    file.size === 0 ||
    !UUID_PATTERN.test(runId) ||
    !UUID_PATTERN.test(prospectId) ||
    !ASSET_KINDS.has(assetKind as EmailAssetKind)
  ) {
    return null;
  }

  return {
    runId,
    prospectId,
    altText,
    promptSummary,
    assetKind: assetKind as EmailAssetKind,
    file,
    declaredContentType: file.type,
  };
}

export function createEmailAssetPostHandler(
  dependencies: EmailAssetRouteDependencies,
): (request: Request) => Promise<Response> {
  return async (request) => {
    const correlationId = dependencies.createCorrelationId();
    const fail = (status: number, code: string, message: string) =>
      errorResponse(status, code, message, correlationId);
    let rawBody: Uint8Array<ArrayBuffer>;
    try {
      rawBody = await readRawBody(request);
    } catch (error) {
      if (error instanceof PayloadTooLargeError) {
        return fail(413, "payload_too_large", "Upload exceeds 512 KB.");
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to read the upload.");
    }

    const signature = verifyAgentRequest({
      rawBody,
      keyId: request.headers.get(AGENT_KEY_ID_HEADER),
      timestamp: request.headers.get(AGENT_TIMESTAMP_HEADER),
      signature: request.headers.get(AGENT_SIGNATURE_HEADER),
      now: dependencies.now(),
      configuredKeyId: dependencies.agentKeyId,
      secret: dependencies.agentHmacSecret,
    });
    if (!signature.ok) {
      return fail(401, "unauthorized", "Request authentication failed.");
    }

    const form = await parseMultipart(
      rawBody,
      request.headers.get("content-type"),
    );
    if (form === null) {
      return fail(400, "invalid_multipart", "Invalid upload data.");
    }

    const input = parseAssetInput(form);
    if (input === null) {
      return fail(400, "invalid_fields", "Invalid upload fields.");
    }

    const { file, ...assetFields } = input;
    const assetInput: StoreEmailAssetInput = {
      ...assetFields,
      bytes: new Uint8Array(await file.arrayBuffer()),
    };

    try {
      const belongs = await dependencies.prospectBelongsToRun({
        runId: assetInput.runId,
        prospectId: assetInput.prospectId,
      });
      if (!belongs) {
        return fail(
          422,
          "invalid_asset_reference",
          "The prospect does not belong to the referenced research run.",
        );
      }

      const asset = await dependencies.storeAsset(assetInput);
      return jsonResponse(
        {
          asset: {
            id: asset.id,
            blobUrl: asset.blobUrl,
            contentType: asset.contentType,
            byteSize: asset.byteSize,
            width: asset.width,
            height: asset.height,
            sha256: asset.sha256,
            reviewStatus: asset.reviewStatus,
          },
        },
        201,
      );
    } catch (error) {
      if (error instanceof EmailAssetValidationError) {
        return fail(422, error.code, "The uploaded asset is invalid.");
      }

      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to store the asset.");
    }
  };
}

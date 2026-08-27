import { verifyAgentRequest } from "../../integrations/agent-signature";
import {
  ProspectPreviewAssetValidationError,
  type ProspectPreviewSourceAssetKind,
  type StoreProspectPreviewAssetInput,
  type StoredProspectPreviewAsset,
} from "./service";

const MAX_MULTIPART_BYTES = 2 * 1024 * 1024;
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const ASSET_KINDS = new Set<ProspectPreviewSourceAssetKind>([
  "logo",
  "on-site-image",
]);
const MULTIPART_FIELDS = [
  "runId",
  "prospectId",
  "evidenceId",
  "sourceUrl",
  "assetKind",
  "altText",
  "file",
] as const;
const MULTIPART_FIELD_SET = new Set<string>(MULTIPART_FIELDS);
const AGENT_KEY_ID_HEADER = "x-fss-key-id";
const AGENT_TIMESTAMP_HEADER = "x-fss-timestamp";
const AGENT_SIGNATURE_HEADER = "x-fss-signature";

type PreviewEvidenceReference = {
  runId: string;
  prospectId: string;
  evidenceId: string;
  sourceUrl: string;
  assetKind: ProspectPreviewSourceAssetKind;
};

export type ProspectPreviewAssetRouteDependencies = {
  agentKeyId: string;
  agentHmacSecret: string;
  createCorrelationId: () => string;
  now: () => Date;
  validateSourceEvidence: (
    input: PreviewEvidenceReference,
  ) => Promise<boolean>;
  storeAsset: (
    input: StoreProspectPreviewAssetInput,
  ) => Promise<StoredProspectPreviewAsset>;
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

  if (request.body === null) return new Uint8Array();

  const reader = request.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
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
    return await new Request("http://growth.local", {
      method: "POST",
      headers: { "content-type": contentType },
      body: rawBody,
    }).formData();
  } catch {
    return null;
  }
}

function requiredString(form: FormData, name: string): string | null {
  const value = form.get(name);
  return typeof value === "string" && value.trim().length > 0
    ? value.trim()
    : null;
}

function isHttpUrl(value: string): boolean {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

type ParsedAssetInput = StoreProspectPreviewAssetInput & {
  sourceUrl: string;
  file: File;
};

function parseAssetInput(form: FormData): ParsedAssetInput | null {
  if (
    [...form.keys()].some((name) => !MULTIPART_FIELD_SET.has(name)) ||
    MULTIPART_FIELDS.some((name) => form.getAll(name).length !== 1)
  ) {
    return null;
  }

  const runId = requiredString(form, "runId");
  const prospectId = requiredString(form, "prospectId");
  const evidenceId = requiredString(form, "evidenceId");
  const sourceUrl = requiredString(form, "sourceUrl");
  const assetKind = requiredString(form, "assetKind");
  const altText = requiredString(form, "altText");
  const file = form.get("file");
  if (
    runId === null ||
    prospectId === null ||
    evidenceId === null ||
    sourceUrl === null ||
    assetKind === null ||
    altText === null ||
    !(file instanceof File) ||
    file.size === 0 ||
    !UUID_PATTERN.test(runId) ||
    !UUID_PATTERN.test(prospectId) ||
    !UUID_PATTERN.test(evidenceId) ||
    !isHttpUrl(sourceUrl) ||
    !ASSET_KINDS.has(assetKind as ProspectPreviewSourceAssetKind)
  ) {
    return null;
  }

  return {
    runId,
    prospectId,
    evidenceId,
    sourceUrl,
    assetKind: assetKind as ProspectPreviewSourceAssetKind,
    altText,
    file,
    bytes: new Uint8Array(),
    declaredContentType: file.type,
  };
}

export function createProspectPreviewAssetPostHandler(
  dependencies: ProspectPreviewAssetRouteDependencies,
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
        return fail(413, "payload_too_large", "Upload exceeds 2 MB.");
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

    const form = await parseMultipart(rawBody, request.headers.get("content-type"));
    if (form === null) {
      return fail(400, "invalid_multipart", "Invalid upload data.");
    }
    const input = parseAssetInput(form);
    if (input === null) {
      return fail(400, "invalid_fields", "Invalid upload fields.");
    }

    try {
      const evidenceMatches = await dependencies.validateSourceEvidence({
        runId: input.runId,
        prospectId: input.prospectId,
        evidenceId: input.evidenceId,
        sourceUrl: input.sourceUrl,
        assetKind: input.assetKind,
      });
      if (!evidenceMatches) {
        return fail(
          422,
          "invalid_asset_reference",
          "The asset source is not recorded first-party evidence.",
        );
      }

      const asset = await dependencies.storeAsset({
        runId: input.runId,
        prospectId: input.prospectId,
        evidenceId: input.evidenceId,
        assetKind: input.assetKind,
        altText: input.altText,
        declaredContentType: input.declaredContentType,
        bytes: new Uint8Array(await input.file.arrayBuffer()),
      });
      return jsonResponse(
        { asset: { id: asset.id, reviewStatus: asset.reviewStatus } },
        201,
      );
    } catch (error) {
      if (error instanceof ProspectPreviewAssetValidationError) {
        return fail(422, error.code, "The uploaded asset is invalid.");
      }
      dependencies.reportUnexpectedError({ correlationId, error });
      return fail(500, "internal_error", "Unable to store the asset.");
    }
  };
}

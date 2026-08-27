import { serializeGeneratedPreviewManifest } from "./generated-files";
import { getCompositionExportName } from "../compositions/serialize";

const GITHUB_API_ORIGIN = "https://api.github.com";
const GITHUB_REPOSITORY = "FSS-Ltd/fss-site";
const BASE_BRANCH = "main";
const GENERATED_MANIFEST_PATH =
  "lib/growth/prospect-previews/compositions/manifest.ts";
const GENERATED_BRANCH_PATTERN =
  /^generated\/prospect-previews\/\d{4}-\d{2}-\d{2}(?:-[a-z0-9]+)*$/;
const REFRESH_GENERATED_BRANCH_PATTERN =
  /^generated\/prospect-previews\/\d{4}-\d{2}-\d{2}-evidence-refresh$/;
const GENERATED_FILE_PATTERN =
  /^lib\/growth\/prospect-previews\/compositions\/(?:manifest\.ts|generated\/[a-z0-9]+(?:-[a-z0-9]+)*\.ts)$/;
const GENERATED_SOURCE_PATH_PATTERN =
  /^lib\/growth\/prospect-previews\/compositions\/generated\/([a-z0-9]+(?:-[a-z0-9]+)*)\.ts$/;
const GENERATED_MANIFEST_IMPORT_PATTERN =
  /^import \{ ([a-zA-Z][a-zA-Z0-9]*) \} from "\.\/generated\/([a-z0-9]+(?:-[a-z0-9]+)*)";$/gm;

export type GitHubPreviewSourceFile = {
  path: string;
  content: string;
};

export type GitHubPreviewApiRequest = (
  url: URL,
  init: RequestInit,
) => Promise<Response>;

export type CreateGitHubPreviewPullRequestInput = {
  token: string;
  branch: string;
  title: string;
  body: string;
  files: readonly GitHubPreviewSourceFile[];
  replaceExistingSlugs?: boolean;
  request?: GitHubPreviewApiRequest;
};

export type GitHubPreviewPullRequest = {
  number: number;
  url: string;
  alreadyOpen: boolean;
};

export type GitHubPreviewPullRequestState = {
  number: number;
  state: "open" | "closed";
  mergedAt: Date | null;
};

type GitHubPullRequestResponse = {
  number?: unknown;
  html_url?: unknown;
};

type GitHubPullRequestStateResponse = {
  number?: unknown;
  state?: unknown;
  merged_at?: unknown;
};

type GitHubContentResponse = {
  sha?: unknown;
  content?: unknown;
  encoding?: unknown;
};

function createApiUrl(path: string): URL {
  return new URL(`/repos/${GITHUB_REPOSITORY}${path}`, GITHUB_API_ORIGIN);
}

function validateInput(input: CreateGitHubPreviewPullRequestInput): void {
  if (!input.token.trim()) {
    throw new TypeError("GitHub preview token is required.");
  }
  if (!GENERATED_BRANCH_PATTERN.test(input.branch)) {
    throw new TypeError("GitHub preview branch is invalid.");
  }
  if (
    input.replaceExistingSlugs !== undefined &&
    typeof input.replaceExistingSlugs !== "boolean"
  ) {
    throw new TypeError("GitHub preview replacement mode is invalid.");
  }
  if (
    input.replaceExistingSlugs === true &&
    !REFRESH_GENERATED_BRANCH_PATTERN.test(input.branch)
  ) {
    throw new TypeError(
      "GitHub preview replacements require the dedicated evidence refresh branch.",
    );
  }
  if (
    input.title.trim().length === 0 ||
    input.title !== input.title.trim() ||
    input.title.length > 256 ||
    input.body !== input.body.trim() ||
    input.body.length > 12_000
  ) {
    throw new TypeError("GitHub pull request metadata is invalid.");
  }

  const paths = new Set<string>();
  for (const file of input.files) {
    if (
      !GENERATED_FILE_PATTERN.test(file.path) ||
      !file.content.trim() ||
      paths.has(file.path)
    ) {
      throw new TypeError("GitHub preview source file path is invalid.");
    }
    paths.add(file.path);
  }
}

function createHeaders(token: string): Headers {
  return new Headers({
    accept: "application/vnd.github+json",
    authorization: `Bearer ${token}`,
    "x-github-api-version": "2022-11-28",
  });
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return (await response.json()) as unknown;
  } catch {
    return null;
  }
}

function parseSha(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const object = (value as { object?: unknown }).object;
  if (typeof object !== "object" || object === null) return null;
  const sha = (object as { sha?: unknown }).sha;
  return typeof sha === "string" && sha.length > 0 ? sha : null;
}

function parseContentSha(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const sha = (value as { sha?: unknown }).sha;
  return typeof sha === "string" && sha.length > 0 ? sha : null;
}

function parseManifestContent(value: unknown): string | null {
  if (typeof value !== "object" || value === null) return null;
  const response = value as GitHubContentResponse;
  if (typeof response.content !== "string" || response.encoding !== "base64") {
    return null;
  }

  const encoded = response.content.replace(/\s/g, "");
  if (
    encoded.length === 0 ||
    encoded.length > 250_000 ||
    encoded.length % 4 !== 0 ||
    !/^[a-z0-9+/]*={0,2}$/i.test(encoded)
  ) {
    return null;
  }

  return Buffer.from(encoded, "base64").toString("utf8");
}

function parsePullRequest(value: unknown): GitHubPreviewPullRequest | null {
  if (
    typeof value !== "object" ||
    value === null ||
    !Number.isInteger((value as GitHubPullRequestResponse).number) ||
    (value as GitHubPullRequestResponse).number === 0 ||
    typeof (value as GitHubPullRequestResponse).html_url !== "string"
  ) {
    return null;
  }

  const number = (value as GitHubPullRequestResponse).number as number;
  const url = (value as GitHubPullRequestResponse).html_url as string;
  try {
    const parsedUrl = new URL(url);
    if (
      parsedUrl.protocol !== "https:" ||
      parsedUrl.hostname !== "github.com" ||
      parsedUrl.username ||
      parsedUrl.password
    ) {
      return null;
    }
  } catch {
    return null;
  }

  return { number, url, alreadyOpen: false };
}

function requestFailure(operation: string, status: number): Error {
  return new Error(`GitHub preview ${operation} failed with status ${status}.`);
}

function getPathSegments(path: string): string {
  return path.split("/").map(encodeURIComponent).join("/");
}

async function getContentSha(
  request: GitHubPreviewApiRequest,
  headers: Headers,
  path: string,
  branch: string,
): Promise<string | null> {
  const url = createApiUrl(`/contents/${getPathSegments(path)}`);
  url.searchParams.set("ref", branch);
  const response = await request(url, { method: "GET", headers });
  if (response.status === 404) return null;
  if (!response.ok) throw requestFailure("content lookup", response.status);

  const sha = parseContentSha(await readJson(response));
  if (sha === null) {
    throw new Error(
      "GitHub preview content lookup returned an invalid response.",
    );
  }
  return sha;
}

function extractGeneratedManifestSlugs(source: string): readonly string[] {
  const slugs = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = GENERATED_MANIFEST_IMPORT_PATTERN.exec(source)) !== null) {
    const [, exportName, slug] = match;
    if (
      !slug ||
      exportName !== getCompositionExportName(slug) ||
      slugs.has(slug)
    ) {
      throw new Error(
        "GitHub preview manifest contains invalid generated imports.",
      );
    }
    slugs.add(slug);
  }

  const remaining = source.replace(GENERATED_MANIFEST_IMPORT_PATTERN, "");
  if (remaining.includes("./generated/")) {
    throw new Error(
      "GitHub preview manifest contains invalid generated imports.",
    );
  }

  return [...slugs];
}

async function readExistingGeneratedManifestSlugs(
  request: GitHubPreviewApiRequest,
  headers: Headers,
  branch: string,
): Promise<readonly string[]> {
  const url = createApiUrl(
    `/contents/${getPathSegments(GENERATED_MANIFEST_PATH)}`,
  );
  url.searchParams.set("ref", branch);
  const response = await request(url, { method: "GET", headers });
  if (response.status === 404) return [];
  if (!response.ok) throw requestFailure("manifest lookup", response.status);

  const source = parseManifestContent(await readJson(response));
  if (source === null) {
    throw new Error(
      "GitHub preview manifest lookup returned an invalid response.",
    );
  }
  return extractGeneratedManifestSlugs(source);
}

function mergeGeneratedManifest(
  files: readonly GitHubPreviewSourceFile[],
  existingSlugs: readonly string[],
  replaceExistingSlugs: boolean,
): readonly GitHubPreviewSourceFile[] {
  const manifest = files.find((file) => file.path === GENERATED_MANIFEST_PATH);
  if (manifest === undefined) return files;

  const newSlugs = files.flatMap((file) => {
    const match = GENERATED_SOURCE_PATH_PATTERN.exec(file.path);
    return match?.[1] ? [match[1]] : [];
  });
  const existing = new Set(existingSlugs);
  if (new Set(newSlugs).size !== newSlugs.length) {
    throw new Error("GitHub preview source files contain duplicate prospect slugs.");
  }
  if (
    !replaceExistingSlugs &&
    newSlugs.some((slug) => existing.has(slug))
  ) {
    throw new Error(
      "GitHub preview branch already contains a generated prospect slug.",
    );
  }

  return files.map((file) =>
    file.path === GENERATED_MANIFEST_PATH
      ? {
          ...file,
          content: serializeGeneratedPreviewManifest([
            ...existingSlugs,
            ...newSlugs.filter((slug) => !existing.has(slug)),
          ]),
        }
      : file,
  );
}

async function writeSourceFile(
  request: GitHubPreviewApiRequest,
  headers: Headers,
  branch: string,
  file: GitHubPreviewSourceFile,
): Promise<void> {
  const sha = await getContentSha(request, headers, file.path, branch);
  const body: {
    message: string;
    content: string;
    branch: string;
    sha?: string;
  } = {
    message: "feat: add generated prospect preview compositions",
    content: Buffer.from(file.content, "utf8").toString("base64"),
    branch,
  };
  if (sha !== null) body.sha = sha;

  const response = await request(
    createApiUrl(`/contents/${getPathSegments(file.path)}`),
    {
      method: "PUT",
      headers,
      body: JSON.stringify(body),
    },
  );
  if (!response.ok) throw requestFailure("source write", response.status);
}

async function findOpenPullRequest(
  request: GitHubPreviewApiRequest,
  headers: Headers,
  branch: string,
): Promise<GitHubPreviewPullRequest | null> {
  const url = createApiUrl("/pulls");
  url.searchParams.set("state", "open");
  url.searchParams.set("head", `FSS-Ltd:${branch}`);
  url.searchParams.set("base", BASE_BRANCH);
  const response = await request(url, { method: "GET", headers });
  if (!response.ok)
    throw requestFailure("pull request lookup", response.status);

  const result = await readJson(response);
  if (!Array.isArray(result)) {
    throw new Error(
      "GitHub preview pull request lookup returned an invalid response.",
    );
  }
  const pullRequest = parsePullRequest(result[0]);
  return pullRequest === null ? null : { ...pullRequest, alreadyOpen: true };
}

async function createBranch(
  request: GitHubPreviewApiRequest,
  headers: Headers,
  branch: string,
): Promise<void> {
  const baseResponse = await request(
    createApiUrl(`/git/ref/heads/${BASE_BRANCH}`),
    { method: "GET", headers },
  );
  if (!baseResponse.ok) {
    throw requestFailure("base branch lookup", baseResponse.status);
  }

  const sha = parseSha(await readJson(baseResponse));
  if (sha === null) {
    throw new Error(
      "GitHub preview base branch lookup returned an invalid response.",
    );
  }

  const response = await request(createApiUrl("/git/refs"), {
    method: "POST",
    headers,
    body: JSON.stringify({ ref: `refs/heads/${branch}`, sha }),
  });
  if (!response.ok && response.status !== 422) {
    throw requestFailure("branch creation", response.status);
  }
}

async function createPullRequest(
  request: GitHubPreviewApiRequest,
  headers: Headers,
  input: Pick<CreateGitHubPreviewPullRequestInput, "branch" | "title" | "body">,
): Promise<GitHubPreviewPullRequest> {
  const response = await request(createApiUrl("/pulls"), {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: input.title,
      body: input.body,
      head: input.branch,
      base: BASE_BRANCH,
    }),
  });
  if (!response.ok)
    throw requestFailure("pull request creation", response.status);

  const pullRequest = parsePullRequest(await readJson(response));
  if (pullRequest === null) {
    throw new Error(
      "GitHub preview pull request creation returned an invalid response.",
    );
  }
  return pullRequest;
}

export async function createGitHubPreviewPullRequest(
  input: CreateGitHubPreviewPullRequestInput,
): Promise<GitHubPreviewPullRequest> {
  validateInput(input);
  const request = input.request ?? ((url, init) => fetch(url, init));
  const headers = createHeaders(input.token);
  const sourceFiles = [...input.files].sort((left, right) =>
    left.path.localeCompare(right.path),
  );

  await createBranch(request, headers, input.branch);
  const existingSlugs = sourceFiles.some(
    (file) => file.path === GENERATED_MANIFEST_PATH,
  )
    ? await readExistingGeneratedManifestSlugs(request, headers, input.branch)
    : [];
  const files = mergeGeneratedManifest(
    sourceFiles,
    existingSlugs,
    input.replaceExistingSlugs === true,
  );
  for (const file of files) {
    await writeSourceFile(request, headers, input.branch, file);
  }

  const existing = await findOpenPullRequest(request, headers, input.branch);
  if (existing !== null) return existing;

  return createPullRequest(request, headers, input);
}

function parsePullRequestState(
  value: unknown,
  number: number,
): GitHubPreviewPullRequestState | null {
  if (typeof value !== "object" || value === null) return null;
  const response = value as GitHubPullRequestStateResponse;
  if (
    response.number !== number ||
    (response.state !== "open" && response.state !== "closed")
  ) {
    return null;
  }
  if (response.merged_at === null) {
    return { number, state: response.state, mergedAt: null };
  }
  if (typeof response.merged_at !== "string") return null;
  const mergedAt = new Date(response.merged_at);
  if (Number.isNaN(mergedAt.getTime())) return null;
  return { number, state: response.state, mergedAt };
}

export async function getGitHubPreviewPullRequestState(input: {
  token: string;
  number: number;
  request?: GitHubPreviewApiRequest;
}): Promise<GitHubPreviewPullRequestState> {
  if (
    !input.token.trim() ||
    !Number.isInteger(input.number) ||
    input.number < 1
  ) {
    throw new TypeError("GitHub preview pull request lookup is invalid.");
  }
  const request = input.request ?? ((url, init) => fetch(url, init));
  const response = await request(createApiUrl(`/pulls/${input.number}`), {
    method: "GET",
    headers: createHeaders(input.token),
  });
  if (!response.ok) {
    throw requestFailure("pull request state lookup", response.status);
  }

  const result = parsePullRequestState(await readJson(response), input.number);
  if (result === null) {
    throw new Error(
      "GitHub preview pull request state lookup returned an invalid response.",
    );
  }
  return result;
}

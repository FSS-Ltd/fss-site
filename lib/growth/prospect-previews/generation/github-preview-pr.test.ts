import assert from "node:assert/strict";
import test from "node:test";

import {
  createGitHubPreviewPullRequest,
  getGitHubPreviewPullRequestState,
} from "./github-preview-pr";

const token = "github-token";
const branch = "generated/prospect-previews/2026-08-27";
const files = [
  {
    path: "lib/growth/prospect-previews/compositions/generated/marden-garage.ts",
    content: "export const mardenGarage = true;\n",
  },
  {
    path: "lib/growth/prospect-previews/compositions/manifest.ts",
    content: "export const manifest = [];\n",
  },
] as const;

type RequestCall = {
  url: URL;
  init: RequestInit;
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

test("creates one dated pull request containing only approved preview source files", async () => {
  const calls: RequestCall[] = [];
  const request = async (url: URL, init: RequestInit): Promise<Response> => {
    calls.push({ url, init });
    const method = init.method ?? "GET";

    if (method === "GET" && url.pathname.endsWith("/git/ref/heads/main")) {
      return jsonResponse({ object: { sha: "base-sha" } });
    }
    if (method === "POST" && url.pathname.endsWith("/git/refs")) {
      return jsonResponse({ ref: `refs/heads/${branch}` }, 201);
    }
    if (method === "GET" && url.pathname.includes("/contents/")) {
      return jsonResponse({ message: "Not Found" }, 404);
    }
    if (method === "PUT" && url.pathname.includes("/contents/")) {
      return jsonResponse({ content: { sha: "written" } }, 201);
    }
    if (method === "GET" && url.pathname.endsWith("/pulls")) {
      return jsonResponse([]);
    }
    if (method === "POST" && url.pathname.endsWith("/pulls")) {
      return jsonResponse(
        {
          number: 412,
          html_url: "https://github.com/FSS-Ltd/fss-site/pull/412",
        },
        201,
      );
    }
    throw new Error(`Unexpected GitHub request: ${method} ${url}`);
  };

  const result = await createGitHubPreviewPullRequest({
    token,
    branch,
    title: "feat: add prospect previews for 2026-08-27",
    body: "Review generated prospect preview compositions.",
    files,
    request,
  });

  assert.deepEqual(result, {
    number: 412,
    url: "https://github.com/FSS-Ltd/fss-site/pull/412",
    alreadyOpen: false,
  });
  assert.equal(calls.length, 8);
  assert.ok(calls.every((call) => call.url.origin === "https://api.github.com"));
  assert.ok(
    calls.every((call) =>
      call.url.pathname.startsWith("/repos/FSS-Ltd/fss-site/"),
    ),
  );
  assert.equal(calls[1]?.init.method, "POST");
  assert.deepEqual(JSON.parse(String(calls[1]?.init.body)), {
    ref: `refs/heads/${branch}`,
    sha: "base-sha",
  });
  assert.equal(calls[3]?.init.method, "PUT");
  assert.deepEqual(JSON.parse(String(calls[3]?.init.body)), {
    message: "feat: add generated prospect preview compositions",
    content: Buffer.from(files[0].content).toString("base64"),
    branch,
  });
  assert.equal(calls[3]?.init.headers instanceof Headers, true);
  assert.equal(
    (calls[3]?.init.headers as Headers).get("authorization"),
    `Bearer ${token}`,
  );
  assert.equal(calls[6]?.url.searchParams.get("head"), `FSS-Ltd:${branch}`);
  assert.equal(calls[6]?.url.searchParams.get("base"), "main");
});

test("reuses a matching open dated pull request without a duplicate", async () => {
  const methods: string[] = [];
  const request = async (url: URL, init: RequestInit): Promise<Response> => {
    methods.push(init.method ?? "GET");
    if (url.pathname.endsWith("/git/ref/heads/main")) {
      return jsonResponse({ object: { sha: "base-sha" } });
    }
    if (url.pathname.endsWith("/git/refs")) {
      return jsonResponse({ ref: `refs/heads/${branch}` }, 422);
    }
    if (url.pathname.includes("/contents/")) {
      return jsonResponse({ message: "Not Found" }, 404);
    }
    if (url.pathname.endsWith("/pulls")) {
      return jsonResponse([
        {
          number: 412,
          html_url: "https://github.com/FSS-Ltd/fss-site/pull/412",
        },
      ]);
    }
    throw new Error(`Unexpected request: ${url}`);
  };

  const result = await createGitHubPreviewPullRequest({
    token,
    branch,
    title: "feat: add prospect previews for 2026-08-27",
    body: "Review generated prospect preview compositions.",
    files: [],
    request,
  });

  assert.deepEqual(result, {
    number: 412,
    url: "https://github.com/FSS-Ltd/fss-site/pull/412",
    alreadyOpen: true,
  });
  assert.deepEqual(methods, ["GET", "POST", "GET"]);
});

test("rejects unsafe paths and branches before GitHub is contacted", async () => {
  let contacted = false;
  const request = async (): Promise<Response> => {
    contacted = true;
    return jsonResponse({});
  };

  await assert.rejects(
    createGitHubPreviewPullRequest({
      token,
      branch: "feature/unsafe",
      title: "feat: add prospect previews",
      body: "Review generated prospect preview compositions.",
      files,
      request,
    }),
    /branch/i,
  );
  await assert.rejects(
    createGitHubPreviewPullRequest({
      token,
      branch,
      title: "feat: add prospect previews",
      body: "Review generated prospect preview compositions.",
      files: [{ path: ".env", content: "GITHUB_TOKEN=unsafe" }],
      request,
    }),
    /path/i,
  );
  assert.equal(contacted, false);
});

test("reads only the safe merged state needed for founder publication reconciliation", async () => {
  const calls: RequestCall[] = [];
  const result = await getGitHubPreviewPullRequestState({
    token,
    number: 412,
    request: async (url, init) => {
      calls.push({ url, init });
      return jsonResponse({
        number: 412,
        state: "closed",
        merged_at: "2026-08-27T07:00:00.000Z",
      });
    },
  });

  assert.deepEqual(result, {
    number: 412,
    state: "closed",
    mergedAt: new Date("2026-08-27T07:00:00.000Z"),
  });
  assert.equal(calls.length, 1);
  assert.equal(calls[0]?.init.method, "GET");
  assert.equal(
    calls[0]?.url.toString(),
    "https://api.github.com/repos/FSS-Ltd/fss-site/pulls/412",
  );
});

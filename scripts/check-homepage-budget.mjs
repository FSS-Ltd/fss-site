import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const projectRoot = process.cwd();
const manifestPath = path.join(
  projectRoot,
  ".next/server/app/(site)/page_client-reference-manifest.js",
);

const budgets = {
  maxJsRawBytes: 180 * 1024,
  maxJsGzipBytes: 65 * 1024,
  // The homepage owns its FSS visual system. Keep it bounded without forcing
  // that server-rendered brand expression into a client-side dependency.
  maxCssRawBytes: 66 * 1024,
  maxCssGzipBytes: 15 * 1024,
};

function formatBytes(bytes) {
  return `${(bytes / 1024).toFixed(1)}KB`;
}

function readHomepageManifest() {
  if (!fs.existsSync(manifestPath)) {
    throw new Error(
      `Missing homepage client manifest at ${manifestPath}. Run "pnpm build" before running this check.`,
    );
  }

  const source = fs.readFileSync(manifestPath, "utf8");
  const markerRegex = /globalThis\.__RSC_MANIFEST\["\/\(site\)\/page"\]\s*=\s*/;
  const markerMatch = source.match(markerRegex);

  if (!markerMatch || markerMatch.index === undefined) {
    throw new Error(`Unable to parse homepage manifest in ${manifestPath}.`);
  }

  const markerEnd = markerMatch.index + markerMatch[0].length;
  const jsonText = source.slice(markerEnd).replace(/;\s*$/, "");
  return JSON.parse(jsonText);
}

function collectChunkFiles(manifest) {
  const files = new Set();

  for (const moduleMeta of Object.values(manifest.clientModules ?? {})) {
    const chunks = moduleMeta.chunks ?? [];
    if (chunks.length === 0) {
      continue;
    }

    // Webpack format can alternate [id, path, id, path].
    const looksLikeAlternatingFormat =
      typeof chunks[0] !== "string" &&
      chunks.length > 1 &&
      typeof chunks[1] === "string";

    if (looksLikeAlternatingFormat) {
      for (let index = 1; index < chunks.length; index += 2) {
        files.add(chunks[index]);
      }
      continue;
    }

    for (const chunk of chunks) {
      if (typeof chunk === "string") {
        files.add(chunk);
      }
    }
  }

  for (const entry of Object.values(manifest.entryCSSFiles ?? {})) {
    for (const cssMeta of entry) {
      files.add(cssMeta.path);
    }
  }

  return [...files]
    .filter((file) => file.endsWith(".js") || file.endsWith(".css"))
    .map((file) => {
      if (file.startsWith("/_next/")) {
        return path.join(projectRoot, ".next", file.replace("/_next/", ""));
      }

      return path.join(projectRoot, ".next", file);
    })
    .filter((file) => fs.existsSync(file));
}

function sizeForFile(filePath) {
  const buffer = fs.readFileSync(filePath);
  return {
    file: path.relative(path.join(projectRoot, ".next"), filePath),
    isCss: filePath.endsWith(".css"),
    raw: buffer.length,
    gzip: zlib.gzipSync(buffer).length,
  };
}

function sumSizes(fileSizes, filter) {
  return fileSizes.filter(filter).reduce(
    (acc, file) => {
      acc.raw += file.raw;
      acc.gzip += file.gzip;
      return acc;
    },
    { raw: 0, gzip: 0 },
  );
}

function assertBudget(name, value, max) {
  if (value > max) {
    throw new Error(
      `${name} exceeded budget: ${formatBytes(value)} > ${formatBytes(max)}.`,
    );
  }
}

try {
  const manifest = readHomepageManifest();
  const files = collectChunkFiles(manifest);
  const fileSizes = files.map(sizeForFile).sort((a, b) => b.raw - a.raw);

  const js = sumSizes(fileSizes, (file) => !file.isCss);
  const css = sumSizes(fileSizes, (file) => file.isCss);

  console.log("Homepage client payload details:");
  for (const file of fileSizes) {
    console.log(
      `- ${file.file}: raw ${formatBytes(file.raw)}, gzip ${formatBytes(file.gzip)}`,
    );
  }
  console.log(
    `JS total: raw ${formatBytes(js.raw)}, gzip ${formatBytes(js.gzip)}`,
  );
  console.log(
    `CSS total: raw ${formatBytes(css.raw)}, gzip ${formatBytes(css.gzip)}`,
  );

  assertBudget("Homepage JS raw size", js.raw, budgets.maxJsRawBytes);
  assertBudget("Homepage JS gzip size", js.gzip, budgets.maxJsGzipBytes);
  assertBudget("Homepage CSS raw size", css.raw, budgets.maxCssRawBytes);
  assertBudget("Homepage CSS gzip size", css.gzip, budgets.maxCssGzipBytes);

  console.log("Homepage bundle budget check passed.");
} catch (error) {
  console.error("Homepage bundle budget check failed.");
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}

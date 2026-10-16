import { cp, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";

const assetReferencePattern = /([\"'])(?:\.\/)?(assets\/[^\"']+)\1/g;

/** Return asset paths referenced directly by an HTML document. */
export function assetReferences(html) {
  return [...html.matchAll(assetReferencePattern)].map((match) => match[2]);
}

const assetTags = (html) =>
  [...html.matchAll(/(src|href)=("|')(?:\.\/)?(assets\/[^"']+)\2/g)].map(
    (match) => ({ attribute: match[1], path: match[3], value: match[0] }),
  );

/**
 * Keep the generated entry HTML and Vite's current asset manifest in sync.
 *
 * The Rust CLI embeds the webapp at compile time. A cached CLI binary can
 * therefore contain an older index.html while its embedded asset directory
 * was rebuilt later. When that happens, use the current webapp entry tags and
 * assets so preview and publication fail before a browser sees a 404.
 */
export async function reconcileWebappAssets(staging, webappDist) {
  const entryPath = path.join(staging, "index.html");
  const currentHtml = await readFile(entryPath, "utf8");
  const currentTags = assetTags(currentHtml);
  const missing = [];
  for (const tag of currentTags) {
    try {
      await stat(path.join(staging, tag.path));
    } catch (error) {
      if (error.code === "ENOENT") missing.push(tag);
      else throw error;
    }
  }
  if (missing.length === 0) return { repaired: false, missing: [] };

  const webappEntry = await readFile(path.join(webappDist, "index.html"), "utf8");
  const webappTags = assetTags(webappEntry);
  await cp(path.join(webappDist, "assets"), path.join(staging, "assets"), {
    recursive: true,
    force: true,
  });
  let repairedHtml = currentHtml;
  for (const tag of missing) {
    const extension = path.extname(tag.path);
    const replacement = webappTags.find(
      (candidate) =>
        candidate.attribute === tag.attribute &&
        path.extname(candidate.path) === extension &&
        candidate.path.endsWith("/gtm.js") === tag.path.endsWith("/gtm.js") &&
        (tag.path.startsWith("assets/index-")
          ? candidate.path.startsWith("assets/index-")
          : true),
    );
    if (!replacement) {
      throw new Error(`generated index references missing ${tag.path}, and the current webapp has no replacement`);
    }
    const source = path.join(webappDist, replacement.path);
    await stat(source);
    repairedHtml = repairedHtml.replace(tag.value, replacement.value);
  }
  await writeFile(entryPath, repairedHtml);

  const remaining = [];
  for (const asset of assetReferences(repairedHtml)) {
    try {
      await stat(path.join(staging, asset));
    } catch (error) {
      if (error.code === "ENOENT") remaining.push(asset);
      else throw error;
    }
  }
  if (remaining.length > 0) {
    throw new Error(`webapp asset reconciliation left missing files: ${[...new Set(remaining)].join(", ")}`);
  }
  return { repaired: true, missing: missing.map((tag) => tag.path) };
}

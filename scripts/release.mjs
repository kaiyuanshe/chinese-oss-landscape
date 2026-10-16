import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { cp, mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { assetReferences } from "./site-assets.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const dist = path.join(root, "dist");
const catalog = path.join(root, "site/catalog.yml");
const manifestName = "release-manifest.json";
const expectedItems = Number(process.env.RELEASE_EXPECTED_ITEMS || 31);
const expectedKinds = {
  software: Number(process.env.RELEASE_EXPECTED_SOFTWARE || 29),
  model_weights: Number(process.env.RELEASE_EXPECTED_MODEL_WEIGHTS || 1),
  dataset: Number(process.env.RELEASE_EXPECTED_DATASETS || 0),
  open_standard: Number(process.env.RELEASE_EXPECTED_OPEN_STANDARDS || 0),
  community: Number(process.env.RELEASE_EXPECTED_COMMUNITIES || 1),
};

const fail = (message) => {
  throw new Error(message);
};

const assert = (condition, message) => {
  if (!condition) fail(message);
};

const readJson = async (file) => JSON.parse(await readFile(file, "utf8"));

const walk = async (directory, prefix = "") => {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
    const relative = path.join(prefix, entry.name);
    if (entry.isDirectory()) files.push(...(await walk(path.join(directory, entry.name), relative)));
    else if (entry.isFile()) files.push(relative);
  }
  return files;
};

const digest = (data) => createHash("sha256").update(data).digest("hex");

const fileRecords = async () => {
  const files = (await walk(dist)).filter((file) => file !== manifestName);
  return Promise.all(
    files.map(async (file) => {
      const data = await readFile(path.join(dist, file));
      return { path: file.split(path.sep).join("/"), size: data.length, sha256: digest(data) };
    }),
  );
};

const artifactDigest = async (records) => {
  const hash = createHash("sha256");
  for (const record of records) {
    hash.update(record.path);
    hash.update("\0");
    hash.update(await readFile(path.join(dist, record.path)));
    hash.update("\0");
  }
  return hash.digest("hex");
};

const rustVersion = () => {
  try {
    return execFileSync("rustc", ["--version"], { encoding: "utf8" }).trim();
  } catch {
    return process.env.RUST_VERSION || "unavailable";
  }
};

const sourceSha = () => {
  if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
  try {
    return execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
};

const catalogSummary = async () => {
  const site = await readJson(path.join(dist, "data/site.json"));
  const base = await readJson(path.join(dist, "data/base.json"));
  const rawCatalog = await readFile(catalog, "utf8");
  const items = Array.isArray(site.items) ? site.items : [];
  assert(site.schema_version === "1", "site.json must use schema version 1");
  assert(typeof site.content_version === "string" && site.content_version.trim(), "site.json must expose content_version");
  assert(items.length === expectedItems, `expected ${expectedItems} published items, found ${items.length}`);

  const ids = new Set();
  const kinds = Object.fromEntries(Object.keys(expectedKinds).map((kind) => [kind, 0]));
  const logoPaths = new Set();
  for (const item of items) {
    assert(item.id && !ids.has(item.id), `item IDs must be unique: ${item.id}`);
    ids.add(item.id);
    assert(item.publication_status === "published" || item.publication_status === "needs_review", `${item.id} is not public`);
    assert(item.name?.["zh-CN"]?.trim(), `${item.id} is missing a Chinese name`);
    assert(item.description?.["zh-CN"]?.trim(), `${item.id} is missing a Chinese description`);
    assert(Array.isArray(item.entries) && item.entries.filter((entry) => entry.primary).length === 1, `${item.id} must have one primary entry`);
    assert(item.logo?.path && !item.logo.path.includes(".."), `${item.id} is missing a safe logo path`);
    logoPaths.add(item.logo.path);
    assert(Object.hasOwn(kinds, item.kind), `${item.id} uses unsupported kind ${item.kind}`);
    kinds[item.kind] += 1;
  }
  for (const [kind, expected] of Object.entries(expectedKinds)) {
    assert(kinds[kind] === expected, `expected ${expected} ${kind} items, found ${kinds[kind]}`);
  }

  for (const logo of logoPaths) {
    assert(!path.isAbsolute(logo), `logo path must be relative: ${logo}`);
    await stat(path.join(dist, logo));
  }
  for (const required of ["index.html", "data/base.json", "data/full.json", "data/guide.json"]) {
    await stat(path.join(dist, required));
  }
  for (const forbidden of ["catalog.yml", "settings.yml", "guide.yml", "sources/catalog.yml"]) {
    try {
      await stat(path.join(dist, forbidden));
      fail(`source authoring file leaked into dist: ${forbidden}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }

  const placeholderLogos = (rawCatalog.match(/^\s+path:\s+missing-logo\.svg\s*$/gm) || []).length;
  const officialLogos = items.length - placeholderLogos;
  assert(placeholderLogos >= 0 && officialLogos >= 0, "invalid logo coverage counts");
  return {
    schema_version: site.schema_version,
    content_version: site.content_version,
    item_count: items.length,
    kinds,
    official_logo_count: officialLogos,
    placeholder_logo_count: placeholderLogos,
    base_path: base.base_path || "/",
  };
};

const checkCatalog = async () => {
  const summary = await catalogSummary();
  console.log(JSON.stringify({ check: "catalog", ...summary }, null, 2));
  return summary;
};

const createManifest = async () => {
  await stat(dist);
  const site = await readJson(path.join(dist, "data/site.json"));
  const base = await readJson(path.join(dist, "data/base.json"));
  const files = await fileRecords();
  files.sort((left, right) => left.path.localeCompare(right.path));
  const manifest = {
    format_version: 1,
    source_sha: sourceSha(),
    content_version: site.content_version,
    schema_version: site.schema_version,
    generated_at: new Date().toISOString(),
    target_url: base.url,
    base_path: base.base_path || "/",
    toolchain: {
      node: process.version,
      rust: rustVersion(),
    },
    files,
    artifact_bytes: files.reduce((total, file) => total + file.size, 0),
    artifact_sha256: await artifactDigest(files),
  };
  await writeFile(path.join(dist, manifestName), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(JSON.stringify({ manifest: path.join("dist", manifestName), ...manifest }, null, 2));
};

const verifyManifest = async () => {
  const manifest = await readJson(path.join(dist, manifestName));
  assert(manifest.format_version === 1, "unsupported release manifest format");
  const expected = [...manifest.files].sort((left, right) => left.path.localeCompare(right.path));
  const actual = (await fileRecords()).sort((left, right) => left.path.localeCompare(right.path));
  assert(JSON.stringify(expected.map((file) => file.path)) === JSON.stringify(actual.map((file) => file.path)), "manifest file list does not match dist");
  for (let index = 0; index < expected.length; index += 1) {
    assert(expected[index].size === actual[index].size && expected[index].sha256 === actual[index].sha256, `manifest hash mismatch: ${expected[index].path}`);
  }
  assert(manifest.artifact_sha256 === (await artifactDigest(actual)), "manifest artifact checksum does not match dist");
  assert(manifest.artifact_bytes === actual.reduce((total, file) => total + file.size, 0), "manifest artifact size does not match dist");
  for (const required of ["index.html", "404.html", ".nojekyll", "data/base.json", "data/full.json", "data/site.json"]) {
    assert(actual.some((file) => file.path === required), `release artifact is missing ${required}`);
  }
  const indexHtml = await readFile(path.join(dist, "index.html"), "utf8");
  for (const asset of assetReferences(indexHtml)) {
    assert(actual.some((file) => file.path === asset), `index.html references missing asset ${asset}`);
  }
  const textFiles = actual.filter((file) => /\.(?:html|js|json|css|txt|yml|yaml|svg)$/i.test(file.path));
  for (const file of textFiles) {
    const text = await readFile(path.join(dist, file.path), "utf8");
    assert(!/-----BEGIN (?:RSA|OPENSSH|EC|PRIVATE) KEY-----|\bgh[pousr]_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}/.test(text), `credential-like material found in ${file.path}`);
  }
  console.log(JSON.stringify({ verify: "ok", files: actual.length, artifact_sha256: manifest.artifact_sha256 }, null, 2));
};

const rehearse = async () => {
  const { mkdtemp } = await import("node:fs/promises");
  const rootDir = await mkdtemp(path.join(os.tmpdir(), "chinese-oss-release-"));
  const versions = path.join(rootDir, "versions");
  const current = path.join(rootDir, "current");
  const previous = path.join(versions, "previous");
  const candidate = path.join(versions, "candidate");
  const broken = path.join(versions, "broken");
  await mkdir(versions, { recursive: true });
  for (const [directory, marker] of [[previous, "previous"], [candidate, "candidate"], [broken, "broken"]]) {
    await mkdir(directory);
    await writeFile(path.join(directory, "index.html"), marker);
  }
  await cp(previous, current, { recursive: true });
  const activate = async (source, shouldFail = false) => {
    const backup = `${current}.rollback`;
    await rm(backup, { recursive: true, force: true });
    await rename(current, backup);
    try {
      if (shouldFail) fail("simulated deployment failure");
      await rename(source, current);
      await rm(backup, { recursive: true, force: true });
    } catch (error) {
      await rename(backup, current);
      throw error;
    }
  };
  await activate(candidate);
  assert((await readFile(path.join(current, "index.html"), "utf8")) === "candidate", "candidate activation failed");
  try {
    await activate(broken, true);
    fail("failure rehearsal did not fail");
  } catch (error) {
    assert(error.message === "simulated deployment failure", `unexpected rehearsal error: ${error.message}`);
  }
  assert((await readFile(path.join(current, "index.html"), "utf8")) === "candidate", "failed deployment changed the active version");
  await cp(previous, path.join(versions, "rollback"), { recursive: true });
  await activate(path.join(versions, "rollback"));
  assert((await readFile(path.join(current, "index.html"), "utf8")) === "previous", "rollback did not restore the previous version");
  await rm(rootDir, { recursive: true, force: true });
  console.log(JSON.stringify({ rehearse: "ok", scenarios: ["promote", "failed deployment", "rollback"] }, null, 2));
};

try {
  const command = process.argv[2];
  if (command === "check") await checkCatalog();
  else if (command === "manifest") await createManifest();
  else if (command === "verify") await verifyManifest();
  else if (command === "rehearse") await rehearse();
  else fail("Usage: node scripts/release.mjs check|manifest|verify|rehearse");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}

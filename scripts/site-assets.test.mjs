import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { assetReferences, reconcileWebappAssets } from "./site-assets.mjs";

test("reconciles a stale embedded entry with the current Vite asset manifest", async (t) => {
  const root = await mkdtemp(path.join(tmpdir(), "landscape-assets-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const staging = path.join(root, "staging");
  const webapp = path.join(root, "webapp");
  await mkdir(path.join(staging, "assets"), { recursive: true });
  await mkdir(path.join(webapp, "assets"), { recursive: true });
  await writeFile(
    path.join(staging, "index.html"),
    '<script type="module" src="./assets/old-entry.js"></script><link rel="stylesheet" href="./assets/current.css">',
  );
  await writeFile(
    path.join(webapp, "index.html"),
    '<script type="module" src="./assets/gtm.js"></script><script type="module" src="./assets/new-entry.js"></script><link rel="stylesheet" href="./assets/current.css">',
  );
  await writeFile(path.join(webapp, "assets", "gtm.js"), "console.log('gtm');");
  await writeFile(path.join(webapp, "assets", "new-entry.js"), "console.log('new');");
  await writeFile(path.join(webapp, "assets", "current.css"), "body{}");

  const result = await reconcileWebappAssets(staging, webapp);
  assert.equal(result.repaired, true);
  assert.deepEqual(assetReferences(await readFile(path.join(staging, "index.html"), "utf8")), [
    "assets/new-entry.js",
    "assets/current.css",
  ]);
  assert.equal(await readFile(path.join(staging, "assets", "new-entry.js"), "utf8"), "console.log('new');");
});

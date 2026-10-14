import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";

import { replaceSiteOutput } from "./site-output.mjs";

async function fixture(t) {
  const root = await mkdtemp(path.join(tmpdir(), "landscape-output-test-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  return { root, output: path.join(root, "dist") };
}

test("a successful build replaces all old outputs, including disabled exports", async (t) => {
  const { root, output } = await fixture(t);
  await mkdir(path.join(output, "docs"), { recursive: true });
  await writeFile(path.join(output, "index.html"), "old site");
  await writeFile(path.join(output, "embed-item.html"), "old embed");
  await writeFile(path.join(output, "docs", "items.csv"), "old download");

  await replaceSiteOutput(output, async (staging) => {
    assert.deepEqual(await readdir(staging), []);
    await writeFile(path.join(staging, "index.html"), "new site");
  });

  assert.equal(
    await readFile(path.join(output, "index.html"), "utf8"),
    "new site",
  );
  assert.deepEqual(await readdir(output), ["index.html"]);
  assert.deepEqual(await readdir(root), ["dist"]);
});

test("failed generation keeps the entire previous site and removes partial output", async (t) => {
  const { root, output } = await fixture(t);
  await mkdir(output);
  await writeFile(path.join(output, "index.html"), "stable site");
  await writeFile(path.join(output, "data.json"), "stable data");

  await assert.rejects(
    replaceSiteOutput(output, async (staging) => {
      await writeFile(path.join(staging, "index.html"), "incomplete site");
      throw new Error("generation failed");
    }),
    /generation failed/,
  );

  assert.equal(
    await readFile(path.join(output, "index.html"), "utf8"),
    "stable site",
  );
  assert.equal(
    await readFile(path.join(output, "data.json"), "utf8"),
    "stable data",
  );
  assert.deepEqual(await readdir(root), ["dist"]);
});

test("the first build works without previous output", async (t) => {
  const { root, output } = await fixture(t);
  await replaceSiteOutput(output, async (staging) => {
    await writeFile(path.join(staging, "index.html"), "first site");
  });
  assert.equal(
    await readFile(path.join(output, "index.html"), "utf8"),
    "first site",
  );
  assert.deepEqual(await readdir(root), ["dist"]);
});

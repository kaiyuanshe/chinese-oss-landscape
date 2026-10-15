import { spawn } from "node:child_process";
import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { replaceSiteOutput } from "./site-output.mjs";

const root = fileURLToPath(new URL("..", import.meta.url));
const output = path.join(root, "dist");
const webapp = path.join(root, "ui/webapp");
const children = new Set();

// This adapter owns site paths and local tooling; upstream owns data generation.
const run = (program, args, cwd = root) =>
  new Promise((resolve, reject) => {
    const child = spawn(program, args, {
      cwd,
      stdio: "inherit",
      shell: process.platform === "win32",
    });
    children.add(child);
    child.on("error", reject);
    child.on("exit", (code, signal) => {
      children.delete(child);
      if (code === 0) resolve();
      else reject(new Error(`${program} exited with ${signal || code}`));
    });
  });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    for (const child of children) child.kill(signal);
    process.exit(signal === "SIGINT" ? 130 : 143);
  });
}

const generate = (args) =>
  run("cargo", ["run", "--locked", "--bin", "landscape2", "--", ...args]);
const build = () =>
  replaceSiteOutput(output, async (staging) => {
    await generate([
      "build",
      "--site-profile",
      "--settings-file",
      "settings.yml",
      "--guide-file",
      "guide.yml",
      "--data-file",
      "data.yml",
      "--logos-path",
      "logos",
      "--cache-dir",
      ".cache",
      "--output-dir",
      staging,
    ]);

    const base = JSON.parse(
      await readFile(path.join(staging, "data/base.json"), "utf8"),
    );
    const publicPath = `${(base.base_path || "").replace(/\/+$/, "")}/`;
    const escapedPath = publicPath.replace(
      /[&"<>]/g,
      (character) =>
        ({ "&": "&amp;", '"': "&quot;", "<": "&lt;", ">": "&gt;" })[character],
    );
    const indexPath = path.join(staging, "index.html");
    const html = await readFile(indexPath, "utf8");
    // Keep asset/data links valid after refreshing nested SPA routes.
    await writeFile(
      indexPath,
      html.replace("<head>", `<head><base href="${escapedPath}">`),
    );
  });

const prepareDevelopmentData = async () => {
  const staticDir = path.join(webapp, "static");
  await mkdir(staticDir, { recursive: true });
  for (const directory of ["data", "docs", "images", "logos"]) {
    const destination = path.join(staticDir, directory);
    await rm(destination, { recursive: true, force: true });
    try {
      await cp(path.join(output, directory), destination, { recursive: true });
    } catch (error) {
      if (directory !== "docs" || error.code !== "ENOENT") throw error;
    }
  }
  const basePath = path.join(staticDir, "data/base.json");
  const base = JSON.parse(await readFile(basePath, "utf8"));
  // Vite development runs at /, independently of the published site's subpath.
  delete base.base_path;
  await writeFile(basePath, JSON.stringify(base));
};

try {
  const [command, ...viteArgs] = process.argv.slice(2);
  switch (command) {
    case "build":
      await build();
      break;
    case "dev":
      await build();
      await prepareDevelopmentData();
      await run(
        process.execPath,
        ["node_modules/vite/bin/vite.js", "--host", "127.0.0.1", ...viteArgs],
        webapp,
      );
      break;
    case "preview": {
      const base = JSON.parse(
        await readFile(path.join(output, "data/base.json"), "utf8"),
      );
      await run(
        process.execPath,
        [
          "node_modules/vite/bin/vite.js",
          "preview",
          "--outDir",
          output,
          "--base",
          `${(base.base_path || "").replace(/\/+$/, "")}/`,
          "--host",
          "127.0.0.1",
          ...viteArgs,
        ],
        webapp,
      );
      break;
    }
    case "validate":
      for (const [kind, file] of [
        ["data", "data.yml"],
        ["settings", "settings.yml"],
        ["guide", "guide.yml"],
      ]) {
        await generate(["validate", kind, `--${kind}-file`, file]);
      }
      await generate([
        "validate",
        "site-content",
        "--content-file",
        "crates/core/testdata/site-catalog-v1.yml",
      ]);
      break;
    default:
      throw new Error("Usage: npm run build | dev | preview | validate");
  }
} catch (error) {
  console.error(error.message);
  if (error.code === "ENOENT")
    console.error(
      "Install Rust and Yarn first; run npm run build before preview.",
    );
  process.exitCode = 1;
}

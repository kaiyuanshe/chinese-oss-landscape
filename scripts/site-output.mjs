import { mkdtemp, rename, rm } from "node:fs/promises";
import path from "node:path";

// Generate from scratch, and keep the previous site if generation fails.
export async function replaceSiteOutput(output, generate) {
  const parent = path.dirname(output);
  const staging = await mkdtemp(path.join(parent, ".site-build-"));
  let backup;
  let previousSaved = false;
  let published = false;

  try {
    await generate(staging);
    backup = await mkdtemp(path.join(parent, ".site-previous-"));
    const previous = path.join(backup, "dist");
    try {
      await rename(output, previous);
      previousSaved = true;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }

    try {
      await rename(staging, output);
      published = true;
    } catch (error) {
      if (previousSaved) {
        try {
          await rename(previous, output);
          previousSaved = false;
        } catch (restoreError) {
          throw new AggregateError(
            [error, restoreError],
            `Could not replace the site; the previous output is preserved at ${previous}`,
          );
        }
      }
      throw error;
    }
  } finally {
    await rm(staging, { recursive: true, force: true });
    if (backup && (!previousSaved || published)) {
      await rm(backup, { recursive: true, force: true });
    }
  }
}

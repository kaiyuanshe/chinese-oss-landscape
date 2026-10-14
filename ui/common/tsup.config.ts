// tsup.config.ts
import { readFileSync } from 'node:fs';
import { isDeepStrictEqual } from 'node:util';

import { defineConfig } from 'tsup';
import * as preset from 'tsup-preset-solid';

const preset_options: preset.PresetOptions = {
  entries: [
    {
      entry: 'src/index.tsx',
    },
  ],
  drop_console: true,
  cjs: true,
};

export default defineConfig(async (config) => {
  const watching = !!config.watch;

  const parsed_data = preset.parsePresetOptions(preset_options, watching);

  if (!watching) {
    const package_fields = preset.generatePackageExports(parsed_data);
    const packageJson = JSON.parse(readFileSync(preset.DEFAULT_PKG_PATH, 'utf8'));
    const serializedFields = JSON.parse(JSON.stringify(package_fields));
    // Avoid touching a Cargo build input when generated exports are unchanged.
    if (Object.entries(serializedFields).some(([field, value]) => !isDeepStrictEqual(packageJson[field], value))) {
      await preset.writePackageJson(package_fields);
    }
  }

  return preset.generateTsupOptions(parsed_data);
});

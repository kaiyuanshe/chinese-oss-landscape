import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { copyFile, glob, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { promisify } from 'node:util';

import { solidPlugin } from 'esbuild-plugin-solid';
import { defineConfig, type Options } from 'tsup';

const exec = promisify(execFile);

// TypeScript 7 no longer exposes the JavaScript Compiler API used by DTS bundlers.
const declarations = async () => {
  await exec(process.execPath, ['node_modules/typescript/bin/tsc', '--project', 'tsconfig.build.json']);
  // Bundler resolution permits extensionless imports; NodeNext consumers require
  // explicit file names, including directory index modules, in declarations.
  for await (const file of glob('dist/**/*.d.ts')) {
    const source = await readFile(file, 'utf8');
    const output = source.replace(
      /((?:from\s*|import\s*\(\s*|import\s*)['"])(\.{1,2}\/[^'"]+)(['"])/g,
      (match, prefix, specifier, suffix) => {
        const target = resolve(dirname(file), specifier);
        if (existsSync(`${target}.d.ts`)) return `${prefix}${specifier}.js${suffix}`;
        if (existsSync(`${target}/index.d.ts`)) return `${prefix}${specifier}/index.js${suffix}`;
        return match;
      }
    );
    await writeFile(file, output);
  }
  await copyFile('dist/index.d.ts', 'dist/index.d.cts');
};

export default defineConfig(async (config) => {
  // tsup builds array entries concurrently, so clean before starting either one.
  if (!config.watch) await rm('dist', { recursive: true, force: true });
  const shared: Options = {
    entry: ['src/index.tsx'],
    target: 'esnext',
    platform: 'browser',
    outDir: 'dist',
    dts: false,
    clean: false,
    esbuildOptions(options) {
      options.jsx = 'preserve';
      options.drop = ['console', 'debugger'];
      options.define = {
        ...options.define,
        'process.env.NODE_ENV': '"production"',
        'process.env.PROD': 'true',
        'process.env.DEV': 'false',
        'process.env.SSR': 'false',
        'import.meta.env.NODE_ENV': '"production"',
        'import.meta.env.PROD': 'true',
        'import.meta.env.DEV': 'false',
        'import.meta.env.SSR': 'false',
      };
    },
  };

  return [
    {
      ...shared,
      format: ['esm', 'cjs'],
      esbuildPlugins: [solidPlugin({ solid: { generate: 'dom' } })],
      onSuccess: declarations,
    },
    {
      ...shared,
      format: ['esm'],
      outExtension: () => ({ js: '.jsx' }),
    },
  ];
});

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import isNull from 'lodash/isNull';
import isUndefined from 'lodash/isUndefined';
import { defineConfig, loadEnv } from 'vite';
import { ViteEjsPlugin } from 'vite-plugin-ejs';
import solid from 'vite-plugin-solid';

import { renderSiteMetadata } from '../../scripts/site-brand.mjs';

const projectDir = fileURLToPath(new URL('.', import.meta.url));
const brand = JSON.parse(fs.readFileSync(path.resolve(projectDir, '../../site/brand.json'), 'utf8'));
const bootstrapDir = [
  path.resolve(projectDir, 'node_modules/bootstrap'),
  path.resolve(projectDir, '../../node_modules/bootstrap'),
].find((candidate) => fs.existsSync(candidate));
const CSS_HREF_PATTERN = /<link rel="stylesheet" crossorigin href="(.*?)">/;
const DEVELOPMENT_PROXY_PATHS = ['/static/data', '/static/docs', '/static/images', '/static/logos'];
const scssIncludePaths = [
  path.resolve(projectDir, 'node_modules'),
  path.resolve(projectDir, '../../node_modules'),
].filter((candidate) => fs.existsSync(candidate));

export default defineConfig(({ mode }) => ({
  base: '', // Default '/', static path
  plugins: [
    ViteEjsPlugin(({ mode }) => {
      const developmentData = path.resolve(projectDir, 'static/data/base.json');
      const base =
        mode === 'development' && fs.existsSync(developmentData)
          ? JSON.parse(fs.readFileSync(developmentData, 'utf8'))
          : {};
      return { siteMetadata: renderSiteMetadata(brand, base, { development: mode === 'development' }) };
    }),
    solid(),
    {
      name: 'inject-css-preload',
      transformIndexHtml(html) {
        const assetHref = getCSSHref(html);
        if (!isUndefined(assetHref)) {
          return [
            {
              tag: 'link',
              attrs: { rel: 'preload', href: assetHref, as: 'style', crossorigin: true },
              injectTo: 'head-prepend',
            },
          ];
        } else {
          return html;
        }
      },
    },
    {
      name: 'preview-static-resource-errors',
      configurePreviewServer(server) {
        const outputDir = path.resolve(server.config.root, server.config.build.outDir);
        const basePath = server.config.base.replace(/\/$/, '');
        server.middlewares.use((request, response, next) => {
          let pathname: string;
          try {
            pathname = decodeURIComponent(new URL(request.url || '/', 'http://localhost').pathname);
          } catch {
            response.statusCode = 400;
            response.end('Bad Request');
            return;
          }
          if (basePath && !pathname.startsWith(`${basePath}/`)) {
            next();
            return;
          }
          const resource = pathname.slice(basePath.length);
          if (!/^\/(assets|data|fonts|images|logos|sources|api|docs|embed)(\/|$)/.test(resource)) {
            next();
            return;
          }
          const file = path.resolve(outputDir, `.${resource}`);
          if (file.startsWith(`${outputDir}${path.sep}`) && fs.statSync(file, { throwIfNoEntry: false })?.isFile()) {
            next();
          } else {
            response.statusCode = 404;
            response.end('Not Found');
          }
        });
      },
    },
  ],
  preview: {
    port: 8000,
  },
  server: getDevelopmentServerConfig(mode),
  resolve: {
    dedupe: ['lodash', 'moment', 'solid-js', 'solid-js/web'],
    ...(bootstrapDir ? { alias: { bootstrap: bootstrapDir } } : {}),
  },
  css: {
    preprocessorOptions: {
      scss: {
        includePaths: scssIncludePaths,
        silenceDeprecations: ['color-functions', 'global-builtin', 'if-function', 'import'],
      },
    },
  },
}));

/** Extracts the generated stylesheet URL from rendered HTML. */
const getCSSHref = (html: string) => {
  const match = CSS_HREF_PATTERN.exec(html);
  if (!isNull(match)) {
    return match[1];
  } else {
    return undefined;
  }
};

/** Creates an opt-in dev proxy for datasets and their generated assets. */
const getDevelopmentServerConfig = (mode: string) => {
  const proxyTarget = loadEnv(mode, process.cwd(), '').VITE_PROXY_TARGET;
  if (!proxyTarget) {
    return undefined;
  }

  const targetUrl = new URL(proxyTarget);
  const targetBasePath = targetUrl.pathname.replace(/\/+$/, '');
  const rewritePath = (requestPath: string) => `${targetBasePath}${requestPath.replace(/^\/static/, '')}`;

  return {
    proxy: Object.fromEntries(
      DEVELOPMENT_PROXY_PATHS.map((path) => [
        path,
        {
          target: targetUrl.origin,
          changeOrigin: true,
          rewrite: rewritePath,
        },
      ])
    ),
  };
};

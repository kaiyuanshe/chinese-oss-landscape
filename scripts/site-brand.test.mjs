import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

import { applySiteMetadata, renderSiteMetadata } from "./site-brand.mjs";

const brand = JSON.parse(
  await readFile(new URL("../site/brand.json", import.meta.url), "utf8"),
);
const images = {
  favicon: "images/favicon.png",
  open_graph: "images/social.png",
};
const structuredData = (html) =>
  JSON.parse(
    html.match(/<script type="application\/ld\+json">(.*?)<\/script>/s)[1],
  );

test("published metadata shares one Chinese identity and absolute root URLs", () => {
  const html = renderSiteMetadata(brand, {
    url: "https://map.example.org",
    images,
  });
  assert.ok(html.includes(`<title>${brand.title["zh-CN"]}</title>`));
  for (const field of ["description", "og:description", "twitter:description"])
    assert.ok(
      html.includes(`="${field}" content="${brand.description["zh-CN"]}"`),
    );
  assert.ok(html.includes('rel="canonical" href="https://map.example.org/"'));
  assert.ok(
    html.includes('property="og:url" content="https://map.example.org/"'),
  );
  assert.ok(
    html.includes(
      'property="og:image" content="https://map.example.org/images/social.png"',
    ),
  );
  assert.ok(html.includes('rel="icon" href="images/favicon.png"'));
  const structured = structuredData(html);
  assert.equal(structured.name, brand.name["zh-CN"]);
  assert.equal(structured.headline, brand.title["zh-CN"]);
  assert.equal(structured.description, brand.description["zh-CN"]);
  assert.equal(structured.url, "https://map.example.org/");
  assert.equal(structured.inLanguage, "zh-CN");
});

test("subpath URLs are joined once, including URLs already containing the base path", () => {
  for (const url of [
    "https://map.example.org",
    "https://map.example.org/map/",
    "https://map.example.org/map?old=1#old",
  ])
    for (const base_path of ["/map", "/map/"]) {
      const html = renderSiteMetadata(brand, { url, base_path, images });
      assert.ok(
        html.includes('rel="canonical" href="https://map.example.org/map/"'),
      );
      assert.ok(
        html.includes(
          'content="https://map.example.org/map/images/social.png"',
        ),
      );
      assert.equal(structuredData(html).url, "https://map.example.org/map/");
    }
  const existingPath = renderSiteMetadata(brand, {
    url: "https://map.example.org/map/",
    images,
  });
  assert.equal(
    structuredData(existingPath).url,
    "https://map.example.org/map/",
  );
});

test("local configuration never publishes a canonical or crawlable site URL", () => {
  for (const url of [
    undefined,
    "http://localhost:8000",
    "http://127.0.0.1:8000",
    "http://[::1]:8000",
    "http://preview.localhost:8000",
  ])
    for (const base_path of [undefined, "/map"]) {
      const html = renderSiteMetadata(brand, { url, base_path, images });
      assert.ok(html.includes('content="noindex, nofollow"'));
      assert.ok(!html.includes('rel="canonical"'));
      assert.ok(!html.includes('property="og:url"'));
      assert.equal(structuredData(html).url, undefined);
      assert.ok(html.includes('content="images/social.png"'));
    }
});

test("development retains the brand and resolves local icons through static assets", () => {
  const html = renderSiteMetadata(
    brand,
    { url: "https://map.example.org", base_path: "/map", images },
    { development: true },
  );
  assert.ok(html.includes(`<title>${brand.title["zh-CN"]}</title>`));
  assert.ok(html.includes('rel="icon" href="/static/images/favicon.png"'));
  assert.ok(html.includes('content="/static/images/social.png"'));
  assert.ok(html.includes('content="noindex, nofollow"'));
  assert.equal(structuredData(html).url, undefined);
});

test("remote image URLs are preserved", () => {
  const html = renderSiteMetadata(brand, {
    url: "https://map.example.org",
    base_path: "/map",
    images: {
      favicon: "https://cdn.example.org/favicon.png",
      open_graph: "https://cdn.example.org/share.png?v=1&v2=2",
    },
  });
  assert.ok(html.includes('href="https://cdn.example.org/favicon.png"'));
  assert.ok(
    html.includes('content="https://cdn.example.org/share.png?v=1&amp;v2=2"'),
  );
  assert.equal(
    structuredData(html).image,
    "https://cdn.example.org/share.png?v=1&v2=2",
  );
});

test("branding text cannot break attributes, title elements, or JSON-LD scripts", () => {
  const text = "</title><script>alert(\"test\")</script> & 'quote'";
  const specialBrand = Object.fromEntries(
    ["name", "title", "description"].map((key) => [
      key,
      { "zh-CN": text, en: text },
    ]),
  );
  const html = renderSiteMetadata(specialBrand, {
    url: "https://map.example.org",
    images,
  });
  assert.ok(html.includes("&lt;/title&gt;&lt;script&gt;"));
  assert.ok(html.includes("&quot;test&quot;"));
  assert.ok(!html.includes('<script>alert("test")</script>'));
  assert.equal(structuredData(html).name, text);
  assert.equal(structuredData(html).description, text);
});

test("metadata replacement preserves surrounding upstream scripts and is repeatable", () => {
  const base = { url: "https://map.example.org", images };
  const document = `<head>${renderSiteMetadata(brand)}<script>window.baseDS = {};</script></head>`;
  const updated = applySiteMetadata(document, brand, base);
  assert.ok(updated.endsWith("<script>window.baseDS = {};</script></head>"));
  assert.equal(applySiteMetadata(updated, brand, base), updated);
  assert.throws(
    () => applySiteMetadata("<head></head>", brand, base),
    /Expected one site-brand/,
  );
  assert.throws(
    () => applySiteMetadata(document + document, brand, base),
    /Expected one site-brand/,
  );
});

test("invalid publication URLs fail without emitting credentials or another origin", () => {
  for (const url of [
    "ftp://map.example.org",
    "https://user:password@map.example.org",
  ])
    assert.throws(
      () => renderSiteMetadata(brand, { url }),
      /http\(s\) URL without credentials/,
    );
  for (const base_path of [
    "//other.example.org",
    "/map/../other",
    "/map?x=1",
    "/map\\other",
  ])
    assert.throws(
      () =>
        renderSiteMetadata(brand, {
          url: "https://map.example.org",
          base_path,
        }),
      /base_path/,
    );
});

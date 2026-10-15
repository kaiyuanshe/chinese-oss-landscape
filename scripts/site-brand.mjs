// Site-owned metadata stays outside the upstream settings/data model.
const START = "<!-- site-brand:start -->";
const END = "<!-- site-brand:end -->";

const escapeHtml = (value) =>
  String(value).replace(
    /[&"'<>]/g,
    (character) =>
      ({
        "&": "&amp;",
        '"': "&quot;",
        "'": "&#39;",
        "<": "&lt;",
        ">": "&gt;",
      })[character],
  );

// JSON string escaping alone does not prevent a closing script tag in HTML.
const scriptJson = (value) => JSON.stringify(value).replace(/</g, "\\u003c");

const publicSiteUrl = (base) => {
  if (!base.url) return undefined;
  const url = new URL(base.url);
  if (!/^https?:$/.test(url.protocol) || url.username || url.password)
    throw new Error(
      "Site metadata requires an http(s) URL without credentials",
    );
  if (
    /^(localhost|0\.0\.0\.0|127\..*|\[::1\])$/i.test(url.hostname) ||
    /\.(localhost|local)$/i.test(url.hostname)
  )
    return undefined;
  if (base.base_path) {
    if (
      !base.base_path.startsWith("/") ||
      base.base_path.startsWith("//") ||
      /[\\?#]/.test(base.base_path) ||
      base.base_path.split("/").some((part) => part === "." || part === "..")
    )
      throw new Error(
        "Site metadata requires an absolute base_path without traversal",
      );
    url.pathname = base.base_path;
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  url.search = "";
  url.hash = "";
  return url.href;
};

/** Render Chinese metadata; English copy is reserved for the L1 locale layer. */
export function renderSiteMetadata(
  brand,
  base = {},
  { development = false } = {},
) {
  const name = brand.name["zh-CN"];
  const title = brand.title["zh-CN"];
  const description = brand.description["zh-CN"];
  const canonical = development ? undefined : publicSiteUrl(base);
  const localAsset = (value) =>
    development && !/^https?:\/\//i.test(value)
      ? `/static/${value.replace(/^\/+/, "")}`
      : value;
  const favicon = base.images?.favicon && localAsset(base.images.favicon);
  const shareImage = base.images?.open_graph;
  const image =
    shareImage &&
    (canonical ? new URL(shareImage, canonical).href : localAsset(shareImage));
  const tags = [
    START,
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}" />`,
    `<meta name="robots" content="${canonical ? "index, follow, max-snippet:160, max-image-preview:large" : "noindex, nofollow"}" />`,
    '<meta property="og:type" content="website" />',
    '<meta property="og:locale" content="zh_CN" />',
    `<meta property="og:site_name" content="${escapeHtml(name)}" />`,
    `<meta property="og:title" content="${escapeHtml(title)}" />`,
    `<meta property="og:description" content="${escapeHtml(description)}" />`,
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(description)}" />`,
  ];
  if (canonical)
    tags.push(
      `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
      `<meta property="og:url" content="${escapeHtml(canonical)}" />`,
    );
  if (favicon)
    tags.push(
      `<link rel="icon" href="${escapeHtml(favicon)}" />`,
      `<link rel="apple-touch-icon" href="${escapeHtml(favicon)}" />`,
    );
  if (image)
    tags.push(
      `<meta property="og:image" content="${escapeHtml(image)}" />`,
      `<meta property="og:image:alt" content="${escapeHtml(title)}" />`,
      `<meta name="twitter:image" content="${escapeHtml(image)}" />`,
      `<meta name="twitter:image:alt" content="${escapeHtml(title)}" />`,
    );
  tags.push(
    `<script type="application/ld+json">${scriptJson({
      "@context": "https://schema.org",
      "@type": "WebSite",
      name,
      headline: title,
      description,
      inLanguage: "zh-CN",
      ...(canonical ? { url: canonical } : {}),
      ...(image ? { image } : {}),
    })}</script>`,
    END,
  );
  return tags.join("\n");
}

/** Replace only the owned metadata block, leaving upstream data/scripts intact. */
export function applySiteMetadata(html, brand, base) {
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if (
    start < 0 ||
    end < start ||
    html.indexOf(START, start + START.length) >= 0
  )
    throw new Error("Expected one site-brand metadata block in index.html");
  return `${html.slice(0, start)}${renderSiteMetadata(brand, base)}${html.slice(end + END.length)}`;
}

//! A deliberately small static image subset for site-owned project logos.
//!
//! Validate before the upstream SVG preparation code can resolve resources.
//! XML is parsed, namespaced elements/attributes are allowlisted, and CSS is
//! excluded instead of attempting to sanitize it with string replacements.

use std::path::Path;

use anyhow::{Context, Result, bail};
use imagesize::ImageType;
use usvg::{ImageHrefResolver, TreeParsing, roxmltree};

const SVG_NS: &str = "http://www.w3.org/2000/svg";
const XLINK_NS: &str = "http://www.w3.org/1999/xlink";
const XML_NS: &str = "http://www.w3.org/XML/1998/namespace";
const CONVERSION_HINT: &str = "convert the logo to a static SVG using presentation attributes, or PNG";

const ATTRIBUTES: &[&str] = &[
    "id",
    "x",
    "y",
    "x1",
    "x2",
    "y1",
    "y2",
    "cx",
    "cy",
    "r",
    "rx",
    "ry",
    "width",
    "height",
    "viewBox",
    "preserveAspectRatio",
    "version",
    "d",
    "points",
    "transform",
    "opacity",
    "fill",
    "fill-opacity",
    "fill-rule",
    "stroke",
    "stroke-width",
    "stroke-opacity",
    "stroke-linecap",
    "stroke-linejoin",
    "stroke-miterlimit",
    "stroke-dasharray",
    "stroke-dashoffset",
    "clip-path",
    "clip-rule",
    "clipPathUnits",
    "mask",
    "maskUnits",
    "maskContentUnits",
    "gradientUnits",
    "gradientTransform",
    "spreadMethod",
    "fx",
    "fy",
    "fr",
    "offset",
    "stop-color",
    "stop-opacity",
    "patternUnits",
    "patternContentUnits",
    "patternTransform",
    "marker-start",
    "marker-mid",
    "marker-end",
    "markerWidth",
    "markerHeight",
    "markerUnits",
    "refX",
    "refY",
    "orient",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "text-anchor",
    "dominant-baseline",
    "alignment-baseline",
    "baseline-shift",
    "letter-spacing",
    "word-spacing",
    "textLength",
    "lengthAdjust",
    "dx",
    "dy",
    "rotate",
    "startOffset",
    "method",
    "spacing",
    "visibility",
    "display",
    "overflow",
    "color",
    "shape-rendering",
    "text-rendering",
    "vector-effect",
    "role",
    "aria-label",
    "aria-labelledby",
    "aria-describedby",
    "aria-hidden",
];

/// Check image content and filename agree, without reading linked resources.
pub(super) fn validate(data: &[u8], path: &str) -> Result<()> {
    let extension = Path::new(path)
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    if let Ok(kind) = imagesize::image_type(data) {
        let matches = match kind {
            ImageType::Png => extension == "png",
            ImageType::Jpeg => matches!(extension.as_str(), "jpg" | "jpeg"),
            ImageType::Webp => extension == "webp",
            ImageType::Gif => extension == "gif",
            _ => false,
        };
        if !matches {
            bail!("E_LOGO_FORMAT {path}: expected matching PNG/JPEG/WebP/GIF content and extension");
        }
        let size = imagesize::blob_size(data).context("E_LOGO_FORMAT: invalid raster image")?;
        if size.width == 0 || size.height == 0 {
            bail!("E_LOGO_FORMAT {path}: image dimensions must be non-zero");
        }
        return Ok(());
    }
    if extension != "svg" {
        bail!("E_LOGO_FORMAT {path}: unsupported or invalid image; {CONVERSION_HINT}");
    }
    validate_svg(data).with_context(|| format!("E_LOGO_SVG {path}: {CONVERSION_HINT}"))
}

fn validate_svg(data: &[u8]) -> Result<()> {
    let text = std::str::from_utf8(data).context("SVG must be UTF-8 XML")?;
    // XML requires this exact token. Reject even empty/external declarations,
    // which roxmltree's no-DTD mode otherwise permits without resolving them.
    if text.contains("<!DOCTYPE") {
        bail!("SVG document type declarations are not supported");
    }
    let document = roxmltree::Document::parse_with_options(
        text,
        roxmltree::ParsingOptions {
            allow_dtd: false,
            nodes_limit: 100_000,
        },
    )
    .context("invalid SVG XML")?;
    if !document.root_element().has_tag_name((SVG_NS, "svg")) {
        bail!("root must be an SVG element in the SVG namespace");
    }
    for node in document.descendants() {
        if node.is_pi() {
            bail!("SVG processing instructions and stylesheets are not supported");
        }
        if !node.is_element() {
            continue;
        }
        if node.tag_name().namespace() != Some(SVG_NS) || !allowed_element(node.tag_name().name()) {
            bail!("unsupported SVG element: {}", node.tag_name().name());
        }
        for attribute in node.attributes() {
            validate_attribute(attribute)?;
        }
    }
    // Defensive even after the XML whitelist: neither linked nor embedded
    // images may be read while checking the static SVG's renderable structure.
    let options = usvg::Options {
        image_href_resolver: ImageHrefResolver {
            resolve_data: Box::new(|_, _, _| None),
            resolve_string: Box::new(|_, _| None),
        },
        ..usvg::Options::default()
    };
    usvg::Tree::from_xmltree(&document, &options).context("invalid static SVG structure")?;
    Ok(())
}

fn allowed_element(name: &str) -> bool {
    matches!(
        name,
        "svg"
            | "g"
            | "defs"
            | "symbol"
            | "use"
            | "path"
            | "rect"
            | "circle"
            | "ellipse"
            | "line"
            | "polyline"
            | "polygon"
            | "text"
            | "tspan"
            | "textPath"
            | "title"
            | "desc"
            | "clipPath"
            | "mask"
            | "linearGradient"
            | "radialGradient"
            | "stop"
            | "pattern"
            | "marker"
    )
}

fn validate_attribute(attribute: roxmltree::Attribute<'_, '_>) -> Result<()> {
    let name = attribute.name();
    let value = attribute.value().trim();
    match attribute.namespace() {
        Some(XLINK_NS) if name == "href" => return validate_fragment(value),
        Some(XML_NS) if matches!(name, "space" | "lang") => return Ok(()),
        Some(_) => bail!("unsupported SVG attribute namespace: {name}"),
        None => (),
    }
    if name == "href" {
        return validate_fragment(value);
    }
    if !ATTRIBUTES.contains(&name) {
        bail!("unsupported SVG attribute: {name}");
    }
    if matches!(
        name,
        "fill" | "stroke" | "clip-path" | "mask" | "marker-start" | "marker-mid" | "marker-end"
    ) {
        // These are the only allowed presentation attributes accepting URLs.
        // CSS escapes/comments are excluded, so they cannot disguise a URL.
        if value.contains(['\\', '@', ';']) || value.contains("/*") {
            bail!("CSS escapes, comments and statements are not supported in SVG paint attributes");
        }
        if value.to_ascii_lowercase().contains("url") {
            let Some(inner) = value
                .get(4..)
                .and_then(|value| value.strip_suffix(')'))
                .filter(|_| value.get(..4).is_some_and(|prefix| prefix.eq_ignore_ascii_case("url(")))
            else {
                bail!("SVG paint references must use url(#local-id)");
            };
            let inner = inner.trim();
            let inner = inner
                .strip_prefix('"')
                .and_then(|inner| inner.strip_suffix('"'))
                .or_else(|| inner.strip_prefix('\'').and_then(|inner| inner.strip_suffix('\'')))
                .unwrap_or(inner);
            validate_fragment(inner)?;
        }
    }
    Ok(())
}

fn validate_fragment(value: &str) -> Result<()> {
    let Some(id) = value.strip_prefix('#') else {
        bail!("SVG references must be local fragments; external, file and data URLs are not supported");
    };
    if id.is_empty()
        || !id
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || "_-.:".contains(character))
    {
        bail!("SVG fragment must contain a simple non-empty local ID");
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn svg(content: &str) -> Vec<u8> {
        format!(r#"<svg xmlns="{SVG_NS}" xmlns:xlink="{XLINK_NS}" width="20" height="20">{content}</svg>"#)
            .into_bytes()
    }

    #[test]
    fn accepts_static_shapes_text_and_local_fragment_references() {
        let data = svg(
            r##"<defs><linearGradient id="paint"><stop offset="0" stop-color="red"/></linearGradient><path id="shape" d="M0 0 L10 10"/></defs><use xlink:href="#shape" fill="url(&quot;#paint&quot;)"/><text x="1" y="12">Logo</text>"##,
        );
        validate(&data, "logo.svg").unwrap();
        validate(
            include_bytes!("../../../../../site/assets/logos/missing-logo.svg"),
            "missing-logo.svg",
        )
        .unwrap();
    }

    #[test]
    fn rejects_executable_markup_styles_and_foreign_namespaces() {
        for content in [
            "<script>alert(1)</script>",
            "<g onload=\"alert(1)\"/>",
            "<foreignObject/>",
            "<style>@import 'https://example.org/style.css';</style>",
            "<path style=\"fill:url(https://example.org/paint.svg)\"/>",
            "<animate attributeName=\"href\" to=\"https://example.org\"/>",
            "<g xmlns=\"http://www.w3.org/1999/xhtml\"/>",
            "<?xml-stylesheet href=\"https://example.org/style.css\"?>",
        ] {
            assert!(validate(&svg(content), "logo.svg").is_err(), "accepted {content}");
        }
    }

    #[test]
    fn rejects_external_and_disguised_svg_references() {
        for content in [
            "<use href=\"https://example.org/shape.svg#x\"/>",
            "<use xlink:href=\"file:///private/tmp/secret.svg\"/>",
            "<use href=\"&#104;ttps://example.org/shape.svg\"/>",
            "<image href=\"data:image/svg+xml,test\"/>",
            "<path fill=\"url(https://example.org/paint.svg)\"/>",
            "<path fill=\"u&#114;l(https://example.org/paint.svg)\"/>",
            "<path fill=\"u\\72l(https://example.org/paint.svg)\"/>",
            "<path fill=\"url(/*comment*/https://example.org/paint.svg)\"/>",
            "<g xml:base=\"https://example.org/\"><use href=\"#x\"/></g>",
        ] {
            assert!(validate(&svg(content), "logo.svg").is_err(), "accepted {content}");
        }
    }

    #[test]
    fn rejects_malformed_xml_entities_and_non_svg_content() {
        for data in [
            b"<svg".as_slice(), b"<html>not SVG</html>",
            b"<!DOCTYPE svg SYSTEM 'file:///private/tmp/secret'><svg xmlns='http://www.w3.org/2000/svg'/>",
            b"<!DOCTYPE svg [<!ENTITY payload 'bad'>]><svg xmlns='http://www.w3.org/2000/svg'>&payload;</svg>",
        ] {
            assert!(validate(data, "logo.svg").is_err());
        }
        assert!(validate(&svg("<rect width=\"10\" height=\"10\"/>"), "logo.html").is_err());
    }

    #[test]
    fn validates_raster_content_instead_of_trusting_extensions() {
        let png = hex::decode("89504e470d0a1a0a0000000d4948445200000001000000010804000000b51c0c020000000b4944415478da6364f80f00010501012718e3660000000049454e44ae426082").unwrap();
        validate(&png, "pixel.PNG").unwrap();
        assert!(validate(&png, "pixel.svg").is_err());
        assert!(validate(&png, "pixel.jpeg").is_err());
        assert!(validate(b"this is not an image", "pixel.png").is_err());
        let gif = hex::decode(
            "47494638396101000100800000000000ffffff21f90401000000002c00000000010001000002024401003b",
        )
        .unwrap();
        validate(&gif, "pixel.gif").unwrap();
    }
}

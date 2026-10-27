//! This module provides some helper functions to prepare logos to be displayed
//! on the landscape web application.

use std::{
    fs,
    path::{Path, PathBuf},
    sync::LazyLock,
};

use anyhow::{Context, Result, bail};
use clap::Args;
use regex::bytes::Regex;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use svgtypes::{Align, AspectRatio, ViewBox};
use usvg::tiny_skia_path::{Rect, Transform};

use super::settings::LogosViewbox;

/// Regular expression used to remove the SVG logos' title.
pub static SVG_TITLE: LazyLock<Regex> =
    LazyLock::new(|| Regex::new("<title>.*</title>").expect("exprs in SVG_TITLE to be valid"));

/// Regular expression used to update the SVG logos' viewbox.
pub static SVG_VIEWBOX: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"viewBox="[0-9. ]*""#).expect("expr in SVG_VIEWBOX to be valid"));

/// Landscape logos source.
#[derive(Args, Clone, Default)]
#[group(required = true, multiple = false)]
pub struct LogosSource {
    /// Local path where the logos are stored.
    #[arg(long)]
    pub logos_path: Option<PathBuf>,

    /// Base URL where the logos are hosted.
    #[arg(long)]
    pub logos_url: Option<String>,
}

/// Represents some information about an item's logo.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
pub(crate) struct Logo {
    pub data: Vec<u8>,
    pub extension: String,
    pub digest: String,
}

/// Get logo from the source provided and apply some modifications to it when
/// applicable.
pub(crate) async fn prepare_logo(
    http_client: reqwest::Client,
    logos_source: &LogosSource,
    logos_viewbox: &LogosViewbox,
    file_name: &str,
) -> Result<Logo> {
    // Get logo from the source provided
    let mut logo_data = get_logo(http_client.clone(), logos_source, file_name).await?;

    // Apply some modifications to the logo if it is an SVG file
    let extension = Path::new(file_name)
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or_default()
        .to_lowercase();
    if extension == "svg" {
        // Remove title if present (some identical logos are using a different
        // title, so we do this before computing the digest)
        logo_data = SVG_TITLE.replace(&logo_data, b"").into_owned();

        // Update viewbox to the smallest rectangle in which the object fits
        if logos_viewbox.adjust
            && !logos_viewbox.exclude.contains(&file_name.to_string())
            && let Ok(Some(bounding_box)) = get_svg_bounding_box(&logo_data)
            && bounding_box.left() >= 0.0
            && bounding_box.top() >= 0.0
        {
            let new_viewbox_bounds = format!(
                "{} {} {} {}",
                bounding_box.left(),
                bounding_box.top(),
                bounding_box.right() - bounding_box.left(),
                bounding_box.bottom() - bounding_box.top()
            );
            let new_viewbox = format!(r#"viewBox="{new_viewbox_bounds}""#);
            logo_data = SVG_VIEWBOX.replace(&logo_data, new_viewbox.as_bytes()).into_owned();
        }
    }

    // Calculate digest
    let digest = hex::encode(Sha256::digest(&logo_data));

    Ok(Logo {
        data: logo_data,
        extension,
        digest,
    })
}

/// Get logo content from the corresponding source.
#[allow(clippy::similar_names)]
async fn get_logo(
    http_client: reqwest::Client,
    logos_source: &LogosSource,
    file_name: &str,
) -> Result<Vec<u8>> {
    // Try from path
    if let Some(path) = &logos_source.logos_path {
        return fs::read(path.join(file_name)).map_err(Into::into);
    }

    // Try from url
    if let Some(logos_url) = &logos_source.logos_url {
        let logos_url = logos_url.trim_end_matches('/');
        let logo_url = format!("{logos_url}/{file_name}");
        let resp = http_client.get(logo_url).send().await?;
        if resp.status() != StatusCode::OK {
            bail!("unexpected status code getting logo: {}", resp.status());
        }
        return Ok(resp.bytes().await?.to_vec());
    }

    bail!("logos path or url not provided");
}

/// Get SVG bounding box (smallest rectangle in which the object fits).
fn get_svg_bounding_box(svg_data: &[u8]) -> Result<Option<Rect>> {
    let opt = usvg::Options::default();
    let tree = usvg::Tree::from_data(svg_data, &opt)?;
    let Some(bounds) = tree.root().abs_bounding_box().to_non_zero_rect() else {
        return Ok(None);
    };

    // Modern usvg returns viewport coordinates. The replacement viewBox must
    // remain in the source SVG's user coordinates, including its alignment.
    let uncompressed;
    let svg_data = if svg_data.starts_with(&[0x1f, 0x8b]) {
        uncompressed = usvg::decompress_svgz(svg_data)?;
        uncompressed.as_slice()
    } else {
        svg_data
    };
    let text = std::str::from_utf8(svg_data)?;
    let document = usvg::roxmltree::Document::parse_with_options(
        text,
        usvg::roxmltree::ParsingOptions {
            allow_dtd: true,
            ..usvg::roxmltree::ParsingOptions::default()
        },
    )?;
    let root = document.root_element();
    let Some(view_box) = root.attribute("viewBox").and_then(|value| value.parse::<ViewBox>().ok()) else {
        return Ok(Some(bounds.to_rect()));
    };
    let aspect = root
        .attribute("preserveAspectRatio")
        .and_then(|value| value.parse::<AspectRatio>().ok())
        .unwrap_or_default();
    let transform = view_box_transform(view_box, aspect, tree.size());
    let inverse = transform.invert().context("invalid SVG viewport transform")?;
    Ok(bounds.to_rect().transform(inverse))
}

#[allow(clippy::cast_possible_truncation)]
fn view_box_transform(view_box: ViewBox, aspect: AspectRatio, size: usvg::Size) -> Transform {
    let mut sx = size.width() / view_box.w as f32;
    let mut sy = size.height() / view_box.h as f32;
    if aspect.align != Align::None {
        let scale = if aspect.slice { sx.max(sy) } else { sx.min(sy) };
        sx = scale;
        sy = scale;
    }
    let spare_width = size.width() - view_box.w as f32 * sx;
    let spare_height = size.height() - view_box.h as f32 * sy;
    let horizontal = match aspect.align {
        Align::XMidYMin | Align::XMidYMid | Align::XMidYMax => spare_width / 2.0,
        Align::XMaxYMin | Align::XMaxYMid | Align::XMaxYMax => spare_width,
        _ => 0.0,
    };
    let vertical = match aspect.align {
        Align::XMinYMid | Align::XMidYMid | Align::XMaxYMid => spare_height / 2.0,
        Align::XMinYMax | Align::XMidYMax | Align::XMaxYMax => spare_height,
        _ => 0.0,
    };
    Transform::from_row(
        sx,
        0.0,
        0.0,
        sy,
        horizontal - view_box.x as f32 * sx,
        vertical - view_box.y as f32 * sy,
    )
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn svg_bounds_include_transforms_and_keep_empty_images_unchanged() {
        let svg = br#"<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><g transform="translate(10 20)"><rect x="2" y="3" width="30" height="40"/></g></svg>"#;
        let bounds = get_svg_bounding_box(svg).unwrap().unwrap();
        assert_eq!(
            (bounds.left(), bounds.top(), bounds.width(), bounds.height()),
            (12.0, 23.0, 30.0, 40.0)
        );
        let empty = br#"<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"/>"#;
        assert!(get_svg_bounding_box(empty).unwrap().is_none());
    }

    #[test]
    fn svg_bounds_remain_in_source_coordinates_when_viewport_is_scaled() {
        for aspect in ["xMidYMid meet", "xMaxYMin slice", "none"] {
            let svg = format!(
                r#"<svg xmlns="http://www.w3.org/2000/svg" width="200" height="100" viewBox="10 20 100 100" preserveAspectRatio="{aspect}"><rect x="12" y="23" width="30" height="40"/></svg>"#
            );
            let bounds = get_svg_bounding_box(svg.as_bytes()).unwrap().unwrap();
            assert_eq!(
                (bounds.left(), bounds.top(), bounds.width(), bounds.height()),
                (12.0, 23.0, 30.0, 40.0),
                "{aspect}"
            );
        }
    }

    #[test]
    fn legacy_svg_bounds_preserve_internal_xml_entity_support() {
        let svg = br#"<!DOCTYPE svg [<!ENTITY width "30">]><svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect x="12" y="23" width="&width;" height="40"/></svg>"#;
        let bounds = get_svg_bounding_box(svg).unwrap().unwrap();
        assert_eq!(
            (bounds.left(), bounds.top(), bounds.width(), bounds.height()),
            (12.0, 23.0, 30.0, 40.0)
        );
    }

    #[test]
    fn svgz_bounds_preserve_source_coordinates() {
        // Gzip-compressed SVG with a 200x100 viewport, viewBox="10 20 100 100",
        // and a rectangle at (12, 23) with dimensions 30x40.
        let svgz = b"\x1f\x8b\x08\x00\x00\x00\x00\x00\x02\xffM\x8dK\x0e\xc3 \x0cD\xafb\xf9\x00\xb1\x03YU\xc0\xa2Wi\x11 5\x1f%V\x9c\xde\xbexSe1\x8by\x9aO8\xce\x02\xd7\xfcY\x8e\x88Ud{\x10\xa9\xea\xa0~X\xf7B\x8e\x99\xa9'\x10\xb4\xbd\xa5F\xec\x00\xa1\xe6V\xaaD\x1c\xcd\x9c-\xebs\xbd\xcc\x81c\xe8\xcc\x84)\xec\xf9%\x60\xdc!|{\xd3\xffG\xfcmcb\xa4\x14\xec#\xfd\x00\xea\x94\xf6\x1f\x8b\x00\x00\x00";
        let bounds = get_svg_bounding_box(svgz).unwrap().unwrap();
        assert_eq!(
            (bounds.left(), bounds.top(), bounds.width(), bounds.height()),
            (12.0, 23.0, 30.0, 40.0)
        );
    }
}

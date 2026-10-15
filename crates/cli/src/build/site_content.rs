//! Site-owned publishing boundary. Raw catalogs never reach output directories.

use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};

use anyhow::{Context, Result, bail};
use clap::Args;
use landscape2_core::{
    data::{DataSource, LandscapeData},
    settings::LogosViewbox,
    site_catalog::{SiteCatalog, SiteContentSource, projection::SiteProjection},
};

use super::{BuildArgs, DATASETS_PATH, LOGOS_PATH, SOURCES_PATH, logos::prepare_logo};

mod logo;

/// Select exactly one legacy or site-owned data source for a build.
#[derive(Args, Default)]
#[group(required = true, multiple = false)]
pub struct BuildDataSource {
    /// Legacy landscape YAML file.
    #[arg(long)]
    pub data_file: Option<PathBuf>,

    /// Legacy landscape YAML URL.
    #[arg(long)]
    pub data_url: Option<String>,

    /// Versioned site catalog (requires the site profile and local logos).
    #[arg(long, requires_all = ["site_profile", "logos_path"])]
    pub content_file: Option<PathBuf>,
}

impl BuildDataSource {
    pub(super) fn legacy_source(&self) -> DataSource {
        DataSource {
            data_file: self.data_file.clone(),
            data_url: self.data_url.clone(),
        }
    }
}

pub(super) async fn load(args: &BuildArgs) -> Result<Option<SiteProjection>> {
    let Some(path) = &args.data_source.content_file else {
        return Ok(None);
    };
    if !args.site_profile
        || args.logos_source.logos_path.is_none()
        || args.data_source.data_file.is_some()
        || args.data_source.data_url.is_some()
    {
        bail!("site content requires --site-profile, local logos and no legacy data source");
    }
    // Do not silently mix a new public projection with files from an earlier build.
    // The npm adapter provides an empty staging directory and an atomic replacement.
    if args.output_dir.exists() && fs::read_dir(&args.output_dir)?.next().is_some() {
        bail!("site content requires an empty output directory; use npm run build for staged replacement");
    }
    let catalog = SiteCatalog::new(&SiteContentSource::from_file(path.clone())).await?;
    Ok(Some(catalog.project()?))
}

/// Resolve only local approved logos, reject symlink escapes and fail the build
/// on missing/unreadable files instead of publishing silently broken images.
pub(super) async fn prepare_logos(
    args: &BuildArgs,
    viewbox: &LogosViewbox,
    data: &mut LandscapeData,
) -> Result<()> {
    let root = args.logos_source.logos_path.as_ref().context("local logo directory is required")?;
    let root = root.canonicalize().context("cannot resolve local logo directory")?;
    let client = reqwest::Client::new();
    let mut prepared = HashMap::<String, String>::new();
    for item in &mut data.items {
        if let Some(path) = prepared.get(&item.logo) {
            item.logo.clone_from(path);
            continue;
        }
        let source = root
            .join(&item.logo)
            .canonicalize()
            .with_context(|| format!("missing local logo for {}: {}", item.id, item.logo))?;
        if !source.starts_with(&root) || !source.is_file() {
            bail!(
                "logo for {} must be a file within the local logo directory",
                item.id
            );
        }
        logo::validate(&fs::read(&source)?, &item.logo)?;
        let logo = prepare_logo(client.clone(), &args.logos_source, viewbox, &item.logo).await?;
        let path = format!("{LOGOS_PATH}/{}.{}", logo.digest, logo.extension);
        fs::write(args.output_dir.join(&path), logo.data)?;
        prepared.insert(item.logo.clone(), path.clone());
        item.logo = path;
    }
    Ok(())
}

pub(super) fn is_application_asset(path: &str) -> bool {
    path.starts_with("assets/") || path.starts_with("fonts/")
}

pub(super) fn write_public_files(
    projection: &mut SiteProjection,
    data: &LandscapeData,
    output_dir: &Path,
) -> Result<()> {
    for item in &mut projection.metadata.items {
        if let Some(logo) = &mut item.logo {
            let rendered = data
                .items
                .iter()
                .find(|rendered| rendered.id == item.id)
                .context("public metadata is missing its rendered item")?;
            logo.path.clone_from(&rendered.logo);
        }
    }
    fs::write(
        output_dir.join(DATASETS_PATH).join("site.json"),
        serde_json::to_vec(&projection.metadata)?,
    )?;
    fs::write(
        output_dir.join(SOURCES_PATH).join("data.yml"),
        &projection.legacy_yaml,
    )?;
    Ok(())
}

#[cfg(test)]
mod tests;

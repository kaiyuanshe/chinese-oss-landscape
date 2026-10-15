//! This module defines the functionality of the validate CLI subcommand.

use anyhow::{Context, Result};
use clap::Subcommand;
use landscape2_core::{
    data::{DataSource, LandscapeData},
    guide::{GuideSource, LandscapeGuide},
    settings::{LandscapeSettings, SettingsSource},
    site_catalog::{SiteCatalog, SiteContentSource},
};
use tracing::instrument;

/// Validate command arguments.
#[derive(clap::Args)]
#[command(args_conflicts_with_subcommands = true)]
pub struct ValidateArgs {
    /// Landscape file to validate.
    #[command(subcommand)]
    pub target: Target,
}

/// Landscape file to validate.
#[derive(Subcommand)]
pub enum Target {
    /// Validate landscape data file.
    Data(DataSource),

    /// Validate landscape guide file.
    Guide(GuideSource),

    /// Validate landscape settings file.
    Settings(SettingsSource),

    /// Validate the site-owned content contract.
    SiteContent(SiteContentSource),
}

/// Validate landscape data file.
///
/// # Errors
/// Returns an error if the landscape data file is invalid or cannot be read.
#[instrument(skip_all)]
pub async fn validate_data(data_source: &DataSource) -> Result<()> {
    LandscapeData::new(data_source)
        .await
        .context("the landscape data file provided is not valid")?;

    println!("The landscape data file provided is valid!");
    Ok(())
}

/// Validate landscape guide file.
///
/// # Errors
/// Returns an error if the landscape guide file is invalid or cannot be read.
#[instrument(skip_all)]
pub async fn validate_guide(guide_source: &GuideSource) -> Result<()> {
    LandscapeGuide::new(guide_source)
        .await
        .context("the landscape guide file provided is not valid")?;

    println!("The landscape guide file provided is valid!");
    Ok(())
}

/// Validate landscape settings file.
///
/// # Errors
/// Returns an error if the landscape settings file is invalid or cannot be read.
#[instrument(skip_all)]
pub async fn validate_settings(settings_source: &SettingsSource) -> Result<()> {
    LandscapeSettings::new(settings_source)
        .await
        .context("the landscape settings file provided is not valid")?;

    println!("The landscape settings file provided is valid!");
    Ok(())
}

/// Validate the site-owned content contract.
///
/// # Errors
/// Returns an error if the content source cannot be read or violates the contract.
#[instrument(skip_all)]
pub async fn validate_site_content(source: &SiteContentSource) -> Result<()> {
    SiteCatalog::new(source)
        .await
        .context("the site content contract provided is not valid")?;

    println!("The site content contract provided is valid!");
    Ok(())
}

#![warn(clippy::all, clippy::pedantic)]
#![allow(
    clippy::doc_markdown,
    clippy::blocks_in_conditions,
    clippy::module_name_repetitions
)]

use anyhow::Result;
use clap::{Parser, Subcommand};
use landscape2::build::{BuildArgs, build};
use landscape2::validate::{
    Target, ValidateArgs, validate_data, validate_guide, validate_settings, validate_site_content,
};
use tracing_subscriber::EnvFilter;

/// CLI arguments.
#[derive(Parser)]
#[command(
    version,
    about = "Landscape2 CLI tool

https://github.com/cncf/landscape2#usage"
)]
struct Cli {
    #[command(subcommand)]
    command: Command,
}

/// Commands available.
#[derive(Subcommand)]
#[allow(clippy::large_enum_variant)]
enum Command {
    /// Build landscape website.
    Build(BuildArgs),

    /// Validate landscape data sources files.
    Validate(ValidateArgs),
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Setup logging
    match &cli.command {
        Command::Build(_) => {
            let env_filter =
                EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("landscape2=debug"));
            tracing_subscriber::fmt().with_env_filter(env_filter).init();
        }
        Command::Validate(_) => {}
    }

    // Run command
    match &cli.command {
        Command::Build(args) => build(args).await?,
        Command::Validate(args) => match &args.target {
            Target::Data(src) => validate_data(src).await?,
            Target::Guide(src) => validate_guide(src).await?,
            Target::Settings(src) => validate_settings(src).await?,
            Target::SiteContent(src) => validate_site_content(src).await?,
        },
    }

    Ok(())
}

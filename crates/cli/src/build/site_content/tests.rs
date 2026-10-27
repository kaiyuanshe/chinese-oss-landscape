use std::{
    fs,
    path::{Path, PathBuf},
    time::{SystemTime, UNIX_EPOCH},
};

use clap::Parser;
use landscape2_core::{
    data::{DataSource, LandscapeData},
    site_catalog::{LogoRecord, Placement, PublicationStatus, SiteCatalog, WithdrawalRecord},
};
use serde_json::Value;

use super::*;

const FIXTURE: &str = include_str!("../../../../core/testdata/site-catalog-v1.yml");

#[derive(Parser)]
struct TestCli {
    #[command(flatten)]
    build: BuildArgs,
}

struct TempDir(PathBuf);

impl TempDir {
    fn new() -> Self {
        let nonce = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_nanos();
        let path =
            std::env::temp_dir().join(format!("landscape-site-content-{}-{nonce}", std::process::id()));
        fs::create_dir_all(&path).unwrap();
        Self(path)
    }
}

impl Drop for TempDir {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.0);
    }
}

fn args(root: &Path) -> BuildArgs {
    let logos = Path::new(env!("CARGO_MANIFEST_DIR")).join("../../site/assets/logos");
    TestCli::try_parse_from([
        "build",
        "--site-profile",
        "--content-file",
        root.join("catalog.yml").to_str().unwrap(),
        "--logos-path",
        logos.to_str().unwrap(),
        "--settings-file",
        root.join("settings.yml").to_str().unwrap(),
        "--output-dir",
        root.join("dist").to_str().unwrap(),
    ])
    .unwrap()
    .build
}

fn write_inputs(root: &Path, catalog: &SiteCatalog) {
    // JSON is accepted by the YAML parser and keeps these fixtures independent
    // of whitespace and source-text replacement.
    fs::write(root.join("catalog.yml"), serde_json::to_vec(catalog).unwrap()).unwrap();
    fs::write(
        root.join("settings.yml"),
        "foundation: Test\nurl: https://example.org\nbase_path: /map\n",
    )
    .unwrap();
}

fn output_text(root: &Path) -> String {
    let mut output = String::new();
    for entry in fs::read_dir(root).unwrap() {
        let path = entry.unwrap().path();
        if path.is_dir() {
            output.push_str(&output_text(&path));
        } else {
            output.push_str(&String::from_utf8_lossy(&fs::read(path).unwrap()));
        }
    }
    output
}

#[test]
fn source_selection_requires_one_input_and_site_profile_for_catalogs() {
    let base = [
        "build",
        "--settings-file",
        "settings.yml",
        "--logos-path",
        "logos",
        "--output-dir",
        "dist",
    ];
    assert!(TestCli::try_parse_from(base).is_err());
    let with = |extra: &[&str]| {
        let mut args = base.to_vec();
        args.extend_from_slice(extra);
        TestCli::try_parse_from(args)
    };
    assert!(with(&["--data-file", "data.yml"]).is_ok());
    assert!(with(&["--content-file", "catalog.yml"]).is_err());
    assert!(with(&["--site-profile", "--content-file", "catalog.yml"]).is_ok());
    assert!(
        with(&[
            "--site-profile",
            "--content-file",
            "catalog.yml",
            "--data-file",
            "data.yml"
        ])
        .is_err()
    );
    assert!(
        with(&[
            "--data-file",
            "data.yml",
            "--data-url",
            "https://example.org/data.yml"
        ])
        .is_err()
    );
}

#[test]
fn excludes_development_data_from_embedded_assets() {
    for path in [
        "data/full.json",
        "sources/data.yml",
        "logos/draft.svg",
        "docs/items.csv",
        "index.html",
    ] {
        assert!(!is_application_asset(path), "unexpected asset: {path}");
    }
    assert!(is_application_asset("assets/index.js"));
    assert!(is_application_asset("fonts/local.woff"));
}

fn publication_fixture() -> SiteCatalog {
    let mut catalog = SiteCatalog::from_yaml(FIXTURE).unwrap();
    catalog.items[0].placements.push(Placement {
        category_id: "software".into(),
        subcategory_id: "platforms".into(),
        primary: false,
    });
    catalog.items[0].logo = Some(LogoRecord {
        path: "missing-logo.svg".into(),
        source_url: "https://example.org/logo".into(),
        alt: "Example".into(),
    });
    catalog.items[0].legacy_ids.push("old-compiler".into());
    for (id, status) in [
        ("draft-only-marker", PublicationStatus::Draft),
        ("in-review-only-marker", PublicationStatus::InReview),
    ] {
        let mut hidden = catalog.items[1].clone();
        hidden.id = id.into();
        hidden.canonical_name = id.into();
        hidden.name.zh_cn = id.into();
        hidden.publication_status = status;
        hidden.legacy_ids = vec![format!("{id}-alias")];
        // Hidden assets need not exist and must never be read or copied.
        hidden.logo = Some(LogoRecord {
            path: format!("{id}.svg"),
            source_url: "https://example.org/unpublished-logo".into(),
            alt: id.into(),
        });
        catalog.items.push(hidden);
    }
    let withdrawn = &mut catalog.items[4];
    withdrawn.name.zh_cn = "withdrawn-detail-marker".into();
    withdrawn.description.zh_cn = "withdrawn-detail-marker".into();
    withdrawn.publication_status = PublicationStatus::Withdrawn;
    withdrawn.withdrawal = Some(WithdrawalRecord {
        reason_code: "merged".into(),
        public_message: "Merged into the software entry".into(),
        replacement_id: Some("example-software".into()),
        effective_at: "2026-10-14".parse().unwrap(),
    });
    let mut unused = catalog.evidence[0].clone();
    unused.id = "unreferenced-evidence-marker".into();
    catalog.evidence.push(unused);
    for item in &mut catalog.items {
        if let Some(review) = &mut item.review {
            review.reviewer_role = "editor-only-marker".into();
        }
    }
    catalog
}

#[tokio::test]
async fn build_filters_all_artifacts_and_keeps_stable_identity() {
    let root = TempDir::new();
    write_inputs(&root.0, &publication_fixture());
    super::super::build(&args(&root.0)).await.unwrap();
    let dist = root.0.join("dist");
    let output = output_text(&dist);
    for marker in [
        "draft-only-marker",
        "in-review-only-marker",
        "withdrawn-detail-marker",
        "editor-only-marker",
        "unreferenced-evidence-marker",
        "ev-community-origin",
        "reviewer_role",
    ] {
        assert!(!output.contains(marker), "private marker leaked: {marker}");
    }
    let read_json = |path| serde_json::from_slice::<Value>(&fs::read(dist.join(path)).unwrap()).unwrap();
    let base = read_json("data/base.json");
    let full = read_json("data/full.json");
    let site = read_json("data/site.json");
    for dataset in [&base, &full, &site] {
        assert_eq!(dataset["items"].as_array().unwrap().len(), 4);
        assert_eq!(dataset["items"][0]["id"], "example-software");
    }
    assert_eq!(
        base["items"][0]["additional_categories"].as_array().unwrap().len(),
        1
    );
    assert_eq!(
        site["id_map"]["legacy_to_stable"]["old-compiler"],
        "example-software"
    );
    assert_eq!(site["withdrawals"][0]["id"], "example-community");
    assert_eq!(site["items"][0]["logo"]["path"], full["items"][0]["logo"]);
    for item in full["items"].as_array().unwrap() {
        assert!(dist.join(item["logo"].as_str().unwrap()).is_file());
    }
    assert!(fs::read_to_string(dist.join("index.html")).unwrap().contains("example-software"));
    for path in [
        "api",
        "embed",
        "docs/items.csv",
        "data/stats.json",
        "sources/catalog.yml",
        "sources/settings.yml",
    ] {
        assert!(!dist.join(path).exists());
    }
    let source = LandscapeData::new(&DataSource {
        data_file: Some(dist.join("sources/data.yml")),
        data_url: None,
    })
    .await
    .unwrap();
    assert_eq!(source.items.len(), 4);
    assert_eq!(source.items[0].additional_categories.as_ref().unwrap().len(), 1);
    // Reusing an output directory must not retain a previous site's hidden files.
    fs::write(dist.join("stale.txt"), "old output").unwrap();
    assert!(
        super::super::build(&args(&root.0))
            .await
            .unwrap_err()
            .to_string()
            .contains("empty output")
    );
    assert_eq!(fs::read_to_string(dist.join("stale.txt")).unwrap(), "old output");
}

#[tokio::test]
async fn empty_catalog_builds_and_missing_logos_fail() {
    let root = TempDir::new();
    let empty = SiteCatalog::from_yaml(
        "schema_version: '1'\ncontent_version: empty\ntaxonomy: {categories: []}\nevidence: []\nitems: []\n",
    )
    .unwrap();
    write_inputs(&root.0, &empty);
    super::super::build(&args(&root.0)).await.unwrap();
    let site: Value = serde_json::from_slice(&fs::read(root.0.join("dist/data/site.json")).unwrap()).unwrap();
    assert_eq!(site["items"], serde_json::json!([]));
    for file in ["base.json", "full.json"] {
        let data: Value =
            serde_json::from_slice(&fs::read(root.0.join("dist/data").join(file)).unwrap()).unwrap();
        assert_eq!(data["items"], serde_json::json!([]));
        if file == "base.json" {
            assert_eq!(data["categories"], serde_json::json!([]));
        }
    }
    let html = fs::read_to_string(root.0.join("dist/index.html")).unwrap();
    assert!(html.contains("\"items\": []") || html.contains("\"items\":[]"));

    let missing_root = TempDir::new();
    let mut catalog = SiteCatalog::from_yaml(FIXTURE).unwrap();
    catalog.items[0].logo = Some(LogoRecord {
        path: "does-not-exist.svg".into(),
        source_url: "https://example.org/logo".into(),
        alt: "logo".into(),
    });
    write_inputs(&missing_root.0, &catalog);
    let error = super::super::build(&args(&missing_root.0)).await.unwrap_err();
    assert!(error.to_string().contains("missing local logo"));
    assert!(!missing_root.0.join("dist/data/site.json").exists());
}

#[cfg(unix)]
#[tokio::test]
async fn rejects_logo_symlinks_outside_root() {
    let root = TempDir::new();
    let mut catalog = SiteCatalog::from_yaml(FIXTURE).unwrap();
    let logos = root.0.join("logos");
    fs::create_dir(&logos).unwrap();
    fs::write(root.0.join("outside.svg"), "not a publishable logo").unwrap();
    std::os::unix::fs::symlink(root.0.join("outside.svg"), logos.join("escape.svg")).unwrap();
    catalog.items[0].logo = Some(LogoRecord {
        path: "escape.svg".into(),
        source_url: "https://example.org/logo".into(),
        alt: "logo".into(),
    });
    write_inputs(&root.0, &catalog);
    let mut arguments = args(&root.0);
    arguments.logos_source.logos_path = Some(logos);
    let error = super::super::build(&arguments).await.unwrap_err();
    assert!(error.to_string().contains("within the local logo directory"));
}

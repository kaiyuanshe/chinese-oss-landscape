//! The site's initial capability boundary, without changing upstream data types.
//!
//! This projection operates on parsed in-memory data. It is not the content
//! approval or private-field filter: source copies remain governed by the
//! separate content publishing pipeline.

use landscape2_core::{
    data::LandscapeData,
    datasets::{Datasets, NewDatasetsInput, base::Base, full::Full},
    settings::LandscapeSettings,
};

/// Remove optional governance, commercial and collected data from the site view.
pub(super) fn project(data: &mut LandscapeData, settings: &mut LandscapeSettings) {
    settings.analytics = None;
    settings.osano = None;
    settings.screenshot_width = None;
    settings.members_category = None;
    settings.enduser = None;
    settings.featured_items = None;
    settings.upcoming_event = None;
    settings.hide_organization_section_in_projects = Some(true);

    for item in &mut data.items {
        item.accepted_at = None;
        item.archived_at = None;
        item.graduated_at = None;
        item.incubating_at = None;
        item.joined_at = None;
        item.latest_annual_review_at = None;
        item.latest_annual_review_url = None;
        item.maturity = None;
        item.member_subcategory = None;
        item.enduser = None;
        item.featured = None;
        item.clomonitor_name = None;
        item.clomonitor_report_summary = None;
        item.crunchbase_data = None;
        item.crunchbase_url = None;
        item.devstats_url = None;
        item.lfx_slug = None;
        item.training_certifications = None;
        item.training_type = None;
        item.unnamed_organization = None;

        if let Some(repositories) = &mut item.repositories {
            for repository in repositories {
                repository.github_data = None;
            }
        }
        item.set_website();
    }
}

/// Prepare only the datasets used by the main site and its project details.
pub(super) fn datasets(input: &NewDatasetsInput) -> Datasets {
    Datasets {
        base: Base::new(
            input.landscape_data,
            input.settings,
            input.guide,
            &None,
            input.qr_code,
        ),
        full: Full {
            items: input.landscape_data.items.clone(),
            ..Full::default()
        },
        ..Datasets::default()
    }
}

#[cfg(test)]
mod tests {
    use std::{collections::HashMap, fs, path::PathBuf, time::SystemTime};

    use clap::Parser;
    use landscape2_core::{
        data::{
            AdditionalCategory, Category, CrunchbaseData, GithubData, Item, ItemSummary, Organization,
            Repository, RepositoryGithubData,
        },
        guide::{Category as CategoryGuide, LandscapeGuide},
    };

    use super::*;
    use crate::build::{BuildArgs, DATASETS_PATH, collect_external_data, generate_datasets};

    #[derive(Parser)]
    struct TestCli {
        #[command(flatten)]
        build: BuildArgs,
    }

    fn build_args(extra: &[&str]) -> BuildArgs {
        let mut args = vec![
            "build",
            "--data-file",
            "data.yml",
            "--settings-file",
            "settings.yml",
            "--logos-path",
            "logos",
            "--output-dir",
            "dist",
        ];
        args.extend_from_slice(extra);
        TestCli::try_parse_from(args).unwrap().build
    }

    #[test]
    fn projection_preserves_project_identity_links_and_manual_content() {
        let core_item = Item {
            id: "category--subcategory--project".to_string(),
            name: "Project".to_string(),
            category: "Category".to_string(),
            subcategory: "Subcategory".to_string(),
            description: Some("An independently maintained project".to_string()),
            homepage_url: "https://example.org".to_string(),
            website: "https://example.org".to_string(),
            documentation_url: Some("https://example.org/docs".to_string()),
            logo: "project.svg".to_string(),
            tag: Some(vec!["database".to_string()]),
            additional_categories: Some(vec![AdditionalCategory {
                category: "Other category".to_string(),
                subcategory: "Other subcategory".to_string(),
            }]),
            annotations: Some(HashMap::from([(
                "source".to_string(),
                "official announcement".to_string(),
            )])),
            summary: Some(ItemSummary {
                use_case: Some("Storage".to_string()),
                ..ItemSummary::default()
            }),
            repositories: Some(vec![Repository {
                url: "https://github.com/example/project".to_string(),
                license: Some("Apache-2.0".to_string()),
                branch: Some("main".to_string()),
                primary: Some(true),
                github_data: None,
            }]),
            ..Item::default()
        };
        let mut enriched = core_item.clone();
        enriched.maturity = Some("graduated".to_string());
        enriched.member_subcategory = Some("Gold".to_string());
        enriched.crunchbase_url = Some("https://www.crunchbase.com/organization/example".to_string());
        enriched.crunchbase_data = Some(Organization::default());
        enriched.clomonitor_name = Some("example".to_string());
        enriched.clomonitor_report_summary = Some("images/report.svg".to_string());
        enriched.repositories.as_mut().unwrap()[0].github_data = Some(RepositoryGithubData::default());
        let category = Category {
            name: "Category".to_string(),
            ..Category::default()
        };
        let mut data = LandscapeData {
            categories: vec![category.clone()],
            items: vec![enriched],
        };
        let mut settings = LandscapeSettings {
            screenshot_width: Some(1500),
            members_category: Some("Category".to_string()),
            ..LandscapeSettings::default()
        };

        project(&mut data, &mut settings);

        assert_eq!(data.items, vec![core_item]);
        assert_eq!(data.categories, vec![category]);
        assert!(settings.screenshot_width.is_none());
        assert!(settings.members_category.is_none());
    }

    #[tokio::test]
    async fn profile_is_opt_in_and_never_opens_the_enrichment_cache() {
        assert!(!build_args(&[]).site_profile);
        let mut args = build_args(&["--site-profile"]);
        // A regular executable file cannot be used as a cache directory.
        // The profile must return before attempting to initialize it.
        args.cache_dir = Some(std::env::current_exe().unwrap());
        let mut data = LandscapeData::default();
        let result = collect_external_data(&args, &mut data, &LandscapeSettings::default()).await.unwrap();

        assert!(result.0.is_empty());
        assert!(result.1.is_empty());
    }

    #[test]
    fn site_datasets_keep_core_content_and_guide_without_optional_files() {
        let root = TestOutput::new();
        fs::create_dir(root.0.join(DATASETS_PATH)).unwrap();
        let data = LandscapeData {
            items: vec![Item {
                id: "project".to_string(),
                name: "Project".to_string(),
                ..Item::default()
            }],
            ..LandscapeData::default()
        };
        let guide = Some(LandscapeGuide {
            categories: Some(vec![CategoryGuide {
                category: "Category".to_string(),
                ..CategoryGuide::default()
            }]),
        });
        let input = NewDatasetsInput {
            landscape_data: &data,
            settings: &LandscapeSettings::default(),
            crunchbase_data: &CrunchbaseData::default(),
            github_data: &GithubData::default(),
            games: &None,
            guide: &guide,
            qr_code: &String::new(),
        };

        let result = generate_datasets(&input, &root.0, true).unwrap();

        assert_eq!(result.full.items, data.items);
        assert!(result.base.guide_summary.contains_key("Category"));
        assert!(result.embed.views.is_empty());
        assert_eq!(
            serde_json::to_value(&result.stats).unwrap(),
            serde_json::json!({})
        );
        let mut files: Vec<_> = fs::read_dir(root.0.join(DATASETS_PATH))
            .unwrap()
            .map(|entry| entry.unwrap().file_name())
            .collect();
        files.sort();
        assert_eq!(files, vec!["base.json", "full.json"]);
    }

    struct TestOutput(PathBuf);

    impl TestOutput {
        fn new() -> Self {
            let nonce = SystemTime::now().duration_since(SystemTime::UNIX_EPOCH).unwrap().as_nanos();
            let path =
                std::env::temp_dir().join(format!("landscape2-site-profile-{}-{nonce}", std::process::id()));
            fs::create_dir(&path).unwrap();
            Self(path)
        }
    }

    impl Drop for TestOutput {
        fn drop(&mut self) {
            let _ = fs::remove_dir_all(&self.0);
        }
    }
}

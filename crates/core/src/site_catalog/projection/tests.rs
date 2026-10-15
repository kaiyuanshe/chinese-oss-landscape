use std::{
    fs,
    sync::atomic::{AtomicU64, Ordering},
};

use super::*;
use crate::{
    data::DataSource,
    site_catalog::{
        Entry, Evidence, LegacyLink, LogoRecord, Placement, SiteCategory, SiteSubcategory, SiteTag,
        WithdrawalRecord,
    },
};

fn fixture() -> SiteCatalog {
    SiteCatalog::from_yaml(include_str!("../../../testdata/site-catalog-v1.yml")).unwrap()
}

fn serialized(projection: &SiteProjection) -> String {
    format!(
        "{}{}{}",
        projection.legacy_yaml,
        serde_yaml::to_string(&projection.engine_data).unwrap(),
        serde_yaml::to_string(&projection.metadata).unwrap()
    )
}

#[test]
fn five_types_keep_original_sources_and_asset_scopes() {
    let projection = fixture().project().unwrap();
    assert_eq!(projection.engine_data.items.len(), 5);
    assert_eq!(projection.metadata.items.len(), 5);
    assert_eq!(projection.metadata.id_map.engine_to_stable.len(), 5);
    assert_eq!(projection.metadata.id_map.stable_to_primary.len(), 5);
    for item in &projection.engine_data.items {
        let public = projection.metadata.items.iter().find(|public| public.id == item.id).unwrap();
        let primary = public.entries.iter().find(|entry| entry.primary).unwrap();
        let (entry_role, license_scope) = match public.kind {
            ItemKind::Software => (EntryRole::Repository, LicenseScope::SourceCode),
            ItemKind::ModelWeights => (EntryRole::Weights, LicenseScope::ModelWeights),
            ItemKind::Dataset => (EntryRole::Dataset, LicenseScope::Dataset),
            ItemKind::OpenStandard => (EntryRole::Specification, LicenseScope::StandardText),
            ItemKind::Community => (EntryRole::Official, LicenseScope::Organization),
        };
        assert_eq!(primary.role, entry_role);
        let license = public.licenses.iter().find(|license| license.scope == license_scope).unwrap();
        if public.kind == ItemKind::Community {
            assert_eq!(license.status, LicenseStatus::NotApplicable);
            assert!(license.identifier.is_none());
        } else {
            assert_eq!(license.status, LicenseStatus::Verified);
            assert_eq!(license.applies_to_entry.as_deref(), Some(primary.id.as_str()));
        }
        assert!(primary.original);
        assert_eq!(item.homepage_url, primary.url);
        assert_eq!(item.name, public.name.zh_cn);
        assert_eq!(item.logo, MISSING_LOGO);
        if public.kind == ItemKind::Software {
            assert_eq!(
                item.repositories.as_ref().unwrap()[0].license.as_deref(),
                Some("Apache-2.0")
            );
        } else {
            assert!(
                item.repositories.is_none(),
                "non-software must not synthesize a repository"
            );
        }
    }
    let dataset = projection.metadata.items.iter().find(|item| item.id == "example-dataset").unwrap();
    assert_eq!(dataset.publication_status, PublicationStatus::NeedsReview);
    assert!(dataset.name.en.is_none());
    let model = projection.metadata.items.iter().find(|item| item.id == "example-model").unwrap();
    assert_eq!(model.project_status, ProjectStatus::Archived);
    assert_eq!(model.origin.regions, vec![OriginRegion::Mainland]);
    assert_eq!(
        model.affiliation.as_ref().unwrap().current_foundation.as_ref().unwrap().name,
        "Overseas Foundation"
    );
    let value = serde_yaml::to_value(&projection.metadata).unwrap();
    for item in value["items"].as_sequence().unwrap() {
        for forbidden in ["review", "legacy_ids", "withdrawal"] {
            assert!(item.get(forbidden).is_none());
        }
    }
    assert!(!serialized(&projection).contains("reviewer_role"));
}

#[test]
fn unpublished_records_and_unused_evidence_and_taxonomy_are_excluded() {
    let mut catalog = fixture();
    for (index, status) in [PublicationStatus::Draft, PublicationStatus::InReview].into_iter().enumerate() {
        let mut private = catalog.items[0].clone();
        private.id = format!("private-sentinel-{index}");
        private.canonical_name = format!("PRIVATE_SENTINEL_{index}");
        private.name.zh_cn = format!("PRIVATE_SENTINEL_{index}");
        private.publication_status = status;
        private.legacy_ids = vec![format!("PRIVATE_ALIAS_{index}")];
        catalog.legacy_links.push(LegacyLink {
            legacy_id: format!("PRIVATE_MAPPED_ALIAS_{index}"),
            item_id: private.id.clone(),
        });
        catalog.items.push(private);
    }
    catalog.items[0].review.as_mut().unwrap().reviewer_role = "EDITORIAL_ROLE_SENTINEL".to_string();
    catalog.evidence.push(Evidence {
        id: "unused-evidence".to_string(),
        title: "UNUSED_EVIDENCE_SENTINEL".to_string(),
        url: "https://example.org/unpublished-evidence".to_string(),
        publisher: "Unused publisher".to_string(),
        claim: "Not referenced by a public item".to_string(),
        checked_at: NaiveDate::from_ymd_opt(2026, 10, 1).unwrap(),
        public: true,
    });
    catalog.taxonomy.categories.push(SiteCategory {
        id: "unused-category".to_string(),
        name: LocalizedText {
            zh_cn: "UNUSED_CATEGORY_SENTINEL".to_string(),
            en: None,
        },
        subcategories: vec![SiteSubcategory {
            id: "unused-subcategory".to_string(),
            name: LocalizedText {
                zh_cn: "UNUSED_SUBCATEGORY_SENTINEL".to_string(),
                en: None,
            },
        }],
    });
    catalog.taxonomy.tags.push(SiteTag {
        id: "unused-tag".to_string(),
        name: LocalizedText {
            zh_cn: "UNUSED_TAG_SENTINEL".to_string(),
            en: None,
        },
    });
    let projection = catalog.project().unwrap();
    assert_eq!(projection.metadata.items.len(), 5);
    let output = serialized(&projection);
    for sentinel in [
        "PRIVATE_",
        "private-sentinel",
        "EDITORIAL_ROLE_SENTINEL",
        "UNUSED_",
    ] {
        assert!(!output.contains(sentinel), "leaked sentinel {sentinel}");
    }
    assert_eq!(projection.metadata.taxonomy.categories[0].subcategories.len(), 1);
    assert!(projection.metadata.evidence.iter().any(|evidence| evidence.id == "ev-standard-policy"));
}

#[test]
fn placements_share_one_stable_item_and_renaming_does_not_change_urls() {
    let mut catalog = fixture();
    catalog.items[0].placements.push(Placement {
        category_id: "software".to_string(),
        subcategory_id: "platforms".to_string(),
        primary: false,
    });
    let before = catalog.project().unwrap();
    assert_eq!(before.engine_data.items.len(), 5);
    assert_eq!(before.metadata.id_map.engine_to_stable.len(), 6);
    assert_eq!(
        before.engine_data.items[0].additional_categories.as_ref().unwrap()[0].subcategory,
        "平台"
    );
    assert_eq!(
        before.metadata.id_map.engine_to_stable["software--platforms--example-software"],
        "example-software"
    );
    catalog.items[0].name.zh_cn = "已改名的软件".to_string();
    catalog.taxonomy.categories[0].name.zh_cn = "软件的新分类显示名".to_string();
    let after = catalog.project().unwrap();
    assert_eq!(after.metadata.id_map, before.metadata.id_map);
    assert_eq!(after.engine_data.items[0].id, before.engine_data.items[0].id);
    assert_eq!(after.engine_data.items[0].name, "已改名的软件");
    catalog.items[0].placements[0].primary = false;
    catalog.items[0].placements[1].primary = true;
    let moved = catalog.project().unwrap();
    assert_eq!(moved.engine_data.items[0].id, "example-software");
    assert_eq!(
        moved.metadata.id_map.stable_to_primary["example-software"],
        "software--platforms--example-software"
    );
}

#[test]
fn equal_display_names_do_not_collapse_distinct_items() {
    let mut catalog = fixture();
    let mut another = catalog.items[0].clone();
    another.id = "another-software".to_string();
    catalog.items.push(another);
    let projection = catalog.project().unwrap();
    assert_eq!(projection.engine_data.items.len(), 6);
    assert_eq!(
        projection.engine_data.items.iter().filter(|item| item.name == "示例编译器").count(),
        2
    );
    assert_eq!(
        projection.metadata.id_map.engine_to_stable["software--compilers--another-software"],
        "another-software"
    );
}

#[test]
fn generated_identity_collisions_are_rejected_after_legacy_normalization() {
    let mut catalog = fixture();
    let mut another = catalog.items[0].clone();
    another.id = "example:software".to_string();
    catalog.items.push(another);
    assert!(catalog.project().unwrap_err().to_string().contains("E_PROJECTION_ID"));
}

#[test]
fn aliases_and_stable_ids_cannot_shadow_generated_identities() {
    let mut catalog = fixture();
    catalog.items[1].legacy_ids.push("software--compilers--example-software".to_string());
    assert!(catalog.project().unwrap_err().to_string().contains("E_PROJECTION_ID"));
    catalog.items[1].legacy_ids.clear();
    let mut private = catalog.items[0].clone();
    private.id = "software--compilers--example-software".to_string();
    private.publication_status = PublicationStatus::Draft;
    catalog.items.push(private);
    assert!(catalog.project().unwrap_err().to_string().contains("E_PROJECTION_ID"));
}

#[test]
fn withdrawn_items_only_publish_tombstones_and_old_link_mappings() {
    let mut catalog = fixture();
    let item = &mut catalog.items[1];
    item.publication_status = PublicationStatus::Withdrawn;
    item.name.zh_cn = "WITHDRAWN_NAME_SENTINEL".to_string();
    item.description.zh_cn = "WITHDRAWN_DESCRIPTION_SENTINEL".to_string();
    item.legacy_ids.push("old-model-id".to_string());
    item.withdrawal = Some(WithdrawalRecord {
        reason_code: "merged".to_string(),
        public_message: "已合并到替代条目".to_string(),
        replacement_id: Some("example-software".to_string()),
        effective_at: NaiveDate::from_ymd_opt(2026, 10, 15).unwrap(),
    });
    let projection = catalog.project().unwrap();
    assert_eq!(projection.metadata.items.len(), 4);
    assert_eq!(projection.metadata.withdrawals.len(), 1);
    assert_eq!(
        projection.metadata.withdrawals[0].replacement_id.as_deref(),
        Some("example-software")
    );
    assert_eq!(
        projection.metadata.id_map.legacy_to_stable["old-model-id"],
        "example-model"
    );
    assert_eq!(
        projection.metadata.id_map.legacy_to_stable["data-ai--models--example-model"],
        "example-model"
    );
    assert!(!serialized(&projection).contains("WITHDRAWN_"));
    assert!(!serialized(&projection).contains("ev-model-"));
    assert!(!projection.metadata.id_map.stable_to_primary.contains_key("example-model"));
    let value = serde_yaml::to_value(&projection.metadata.withdrawals[0]).unwrap();
    assert_eq!(value.as_mapping().unwrap().len(), 5);
}

#[test]
fn withdrawal_cannot_disclose_an_unpublished_replacement() {
    let mut catalog = fixture();
    catalog.items[0].publication_status = PublicationStatus::Draft;
    catalog.items[1].publication_status = PublicationStatus::Withdrawn;
    catalog.items[1].withdrawal = Some(WithdrawalRecord {
        reason_code: "merged".to_string(),
        public_message: "已合并".to_string(),
        replacement_id: Some("example-software".to_string()),
        effective_at: NaiveDate::from_ymd_opt(2026, 10, 15).unwrap(),
    });
    assert!(catalog.project().is_err(), "unpublished replacements must fail");
}

#[test]
fn withdrawal_chains_resolve_to_a_public_or_minimal_withdrawn_endpoint() {
    let mut catalog = fixture();
    let effective_at = NaiveDate::from_ymd_opt(2026, 10, 15).unwrap();
    for (index, replacement) in [(0, Some("example-model")), (1, Some("example-dataset"))] {
        catalog.items[index].publication_status = PublicationStatus::Withdrawn;
        catalog.items[index].withdrawal = Some(WithdrawalRecord {
            reason_code: "merged".to_string(),
            public_message: "已合并".to_string(),
            replacement_id: replacement.map(str::to_string),
            effective_at,
        });
    }
    let projection = catalog.project().unwrap();
    assert_eq!(
        projection.metadata.withdrawals[0].replacement_id.as_deref(),
        Some("example-dataset")
    );
    catalog.items[1].withdrawal.as_mut().unwrap().replacement_id = None;
    let projection = catalog.project().unwrap();
    assert_eq!(
        projection.metadata.withdrawals[0].replacement_id.as_deref(),
        Some("example-model")
    );
    assert!(projection.metadata.withdrawals[1].replacement_id.is_none());
    catalog.items[1].withdrawal.as_mut().unwrap().replacement_id = Some("example-software".to_string());
    assert!(catalog.project().is_err(), "withdrawal cycles must fail");
}

#[test]
fn logo_paths_must_remain_relative_to_the_selected_logo_directory() {
    for path in [
        "../secret.svg",
        "/tmp/secret.svg",
        "https://example.org/logo.svg",
        "foo\\bar.svg",
        "foo/./logo.svg",
        "foo//logo.svg",
    ] {
        let mut catalog = fixture();
        catalog.items[0].logo = Some(LogoRecord {
            path: path.to_string(),
            source_url: "https://example.org/brand".to_string(),
            alt: "Logo".to_string(),
        });
        assert!(catalog.project().is_err(), "accepted unsafe logo path {path}");
    }
    let mut catalog = fixture();
    catalog.items[0].logo = Some(LogoRecord {
        path: "software/logo.svg".to_string(),
        source_url: "https://example.org/brand".to_string(),
        alt: "Logo".to_string(),
    });
    let projection = catalog.project().unwrap();
    assert_eq!(
        projection.metadata.items[0].logo.as_ref().unwrap().path,
        "software/logo.svg"
    );
}

#[test]
fn repositories_do_not_inherit_another_assets_license() {
    let mut catalog = fixture();
    catalog.items[0].entries.push(Entry {
        id: "secondary-source".to_string(),
        role: EntryRole::Repository,
        url: "https://example.org/secondary".to_string(),
        original: true,
        ..Default::default()
    });
    catalog.items[1].entries.push(Entry {
        id: "training-code".to_string(),
        role: EntryRole::Repository,
        url: "https://example.org/training".to_string(),
        original: true,
        ..Default::default()
    });
    let projection = catalog.project().unwrap();
    let repositories = projection.engine_data.items[0].repositories.as_ref().unwrap();
    assert_eq!(repositories.len(), 2);
    assert!(repositories[1].license.is_none());
    assert!(projection.engine_data.items[1].repositories.is_none());
    assert!(projection.metadata.items[1].entries.iter().any(|entry| entry.id == "training-code"));

    let mut independent_license = catalog.items[0].licenses[0].clone();
    independent_license.applies_to_entry = Some("secondary-source".to_string());
    independent_license.identifier = Some("MIT".to_string());
    let mut evidence = catalog.evidence[0].clone();
    evidence.id = "ev-independent-code-license".to_string();
    evidence.title = "示例补充代码许可".to_string();
    evidence.url = "https://example.org/code/license".to_string();
    evidence.claim = "补充仓库和模型训练代码使用 MIT，权重许可单独记录".to_string();
    independent_license.evidence_ids = vec![evidence.id.clone()];
    catalog.evidence.push(evidence);
    catalog.items[0].licenses.push(independent_license.clone());
    independent_license.applies_to_entry = Some("training-code".to_string());
    catalog.items[1].licenses.push(independent_license);
    // Input order must not make a supplemental repository the primary source.
    catalog.items[0].entries.reverse();
    catalog.items[1].entries.reverse();
    let projection = catalog.project().unwrap();
    let software = &projection.engine_data.items[0];
    assert_eq!(
        software.primary_repository().unwrap().url,
        "https://example.org/software/repository"
    );
    let repositories = software.repositories.as_ref().unwrap();
    assert_eq!(repositories.len(), 2);
    assert_eq!(repositories[0].url, "https://example.org/secondary");
    assert_eq!(repositories[0].license.as_deref(), Some("MIT"));
    assert_eq!(repositories[1].license.as_deref(), Some("Apache-2.0"));
    assert!(projection.engine_data.items[1].repositories.is_none());
    let model = &projection.metadata.items[1];
    for (entry, scope, identifier) in [
        ("weights", LicenseScope::ModelWeights, "Apache-2.0"),
        ("training-code", LicenseScope::SourceCode, "MIT"),
    ] {
        let license = model
            .licenses
            .iter()
            .find(|license| license.applies_to_entry.as_deref() == Some(entry))
            .unwrap();
        assert_eq!(license.scope, scope);
        assert_eq!(license.identifier.as_deref(), Some(identifier));
    }
    assert_eq!(
        model.entries.iter().find(|entry| entry.primary).unwrap().id,
        "weights"
    );
}

#[tokio::test]
async fn compatibility_yaml_is_consumed_by_the_unmodified_upstream_parser() {
    static NEXT_FILE: AtomicU64 = AtomicU64::new(0);
    let mut catalog = fixture();
    catalog.items[0].placements.push(Placement {
        category_id: "software".to_string(),
        subcategory_id: "platforms".to_string(),
        primary: false,
    });
    let projection = catalog.project().unwrap();
    let path = std::env::temp_dir().join(format!(
        "site-projection-{}-{}.yml",
        std::process::id(),
        NEXT_FILE.fetch_add(1, Ordering::Relaxed)
    ));
    fs::write(&path, &projection.legacy_yaml).unwrap();
    let result = LandscapeData::new(&DataSource {
        data_file: Some(path.clone()),
        data_url: None,
    })
    .await;
    fs::remove_file(path).unwrap();
    let legacy = result.unwrap();
    assert_eq!(legacy.items.len(), 5);
    for item in &legacy.items {
        let stable = &projection.metadata.id_map.engine_to_stable[&item.id];
        assert_eq!(item.annotations.as_ref().unwrap()["site-id"], *stable);
        assert_eq!(item.name, *stable);
    }
    let software = legacy.items.iter().find(|item| item.name == "example-software").unwrap();
    assert_eq!(
        software.additional_categories.as_ref().unwrap()[0].subcategory,
        "platforms"
    );
    assert_eq!(
        software.primary_repository().unwrap().url,
        "https://example.org/software/repository"
    );
    assert!(
        legacy
            .items
            .iter()
            .filter(|item| item.name != "example-software")
            .all(|item| item.repositories.is_none())
    );
}

#[test]
fn conflicting_display_taxonomy_is_rejected_instead_of_merging_categories() {
    let mut catalog = fixture();
    catalog.taxonomy.categories[1].name = catalog.taxonomy.categories[0].name.clone();
    assert!(catalog.project().unwrap_err().to_string().contains("E_PROJECTION_TAXONOMY"));
}

#[test]
fn empty_public_catalog_produces_an_empty_valid_projection() {
    let mut catalog = fixture();
    for item in &mut catalog.items {
        item.publication_status = PublicationStatus::Draft;
    }
    let projection = catalog.project().unwrap();
    assert!(projection.metadata.items.is_empty());
    assert!(projection.metadata.evidence.is_empty());
    assert!(projection.metadata.taxonomy.categories.is_empty());
    assert!(projection.metadata.taxonomy.tags.is_empty());
    assert!(projection.metadata.id_map.legacy_to_stable.is_empty());
    assert!(projection.engine_data.items.is_empty());
    assert_eq!(projection.legacy_yaml, "landscape: []\n");
}

//! Public, deterministic projections of the site-owned content catalog.
//!
//! The source contract is never serialized into published assets. These output
//! types explicitly list public fields, keeping editorial metadata out of both
//! the compatibility YAML and the site metadata file.

use std::collections::{BTreeMap, BTreeSet, HashMap};

use anyhow::{Result, bail};
use chrono::NaiveDate;
use serde::Serialize;

use crate::{
    data::{AdditionalCategory, Category, Item, ItemLink, LandscapeData, Repository, Subcategory},
    util::normalize_name,
};

use super::{
    AccessLevel, EntryRole, ItemKind, LicenseScope, LicenseStatus, LocalizedText, OriginRegion,
    ProjectStatus, PublicationStatus, SiteCatalog, SiteItem, StandardPolicyStatus,
};

/// Filename supplied by the publishing layer when a project has no local logo.
pub const MISSING_LOGO: &str = "missing-logo.svg";

/// Both representations are generated together from the same public catalog.
#[derive(Debug)]
pub struct SiteProjection {
    pub engine_data: LandscapeData,
    pub legacy_yaml: String,
    pub metadata: PublicSiteMetadata,
}

/// Public metadata consumed by the site-specific presentation layer.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicSiteMetadata {
    pub schema_version: String,
    pub content_version: String,
    pub taxonomy: PublicTaxonomy,
    pub items: Vec<PublicSiteItem>,
    pub evidence: Vec<PublicEvidence>,
    pub id_map: PublicIdMap,
    pub withdrawals: Vec<PublicWithdrawal>,
}

/// Machine identities remain separate from translated display names.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct PublicIdMap {
    pub engine_to_stable: BTreeMap<String, String>,
    pub stable_to_primary: BTreeMap<String, String>,
    pub legacy_to_stable: BTreeMap<String, String>,
}

/// Only taxonomy nodes referenced by visible entries are published.
#[derive(Debug, Clone, Default, PartialEq, Serialize)]
pub struct PublicTaxonomy {
    pub categories: Vec<PublicCategory>,
    pub tags: Vec<PublicTag>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicCategory {
    pub id: String,
    pub name: PublicLocalizedText,
    pub subcategories: Vec<PublicSubcategory>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicSubcategory {
    pub id: String,
    pub name: PublicLocalizedText,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicTag {
    pub id: String,
    pub name: PublicLocalizedText,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicLocalizedText {
    #[serde(rename = "zh-CN")]
    pub zh_cn: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub en: Option<String>,
}

impl From<&LocalizedText> for PublicLocalizedText {
    fn from(value: &LocalizedText) -> Self {
        Self {
            zh_cn: value.zh_cn.clone(),
            en: value.en.clone().filter(|text| !text.trim().is_empty()),
        }
    }
}

/// Display fields only: no review record, private state, or source object copy.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicSiteItem {
    pub id: String,
    pub kind: ItemKind,
    pub canonical_name: String,
    pub aliases: Vec<String>,
    pub name: PublicLocalizedText,
    pub description: PublicLocalizedText,
    pub placements: Vec<PublicPlacement>,
    pub tag_ids: Vec<String>,
    pub entries: Vec<PublicEntry>,
    pub licenses: Vec<PublicLicense>,
    pub origin: PublicOrigin,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub affiliation: Option<PublicAffiliation>,
    pub publication_status: PublicationStatus,
    pub project_status: ProjectStatus,
    pub status_evidence_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub status_checked_at: Option<NaiveDate>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub logo: Option<PublicLogo>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub standard_policy: Option<PublicStandardPolicy>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicPlacement {
    pub category_id: String,
    pub subcategory_id: String,
    pub primary: bool,
    pub engine_id: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicEntry {
    pub id: String,
    pub role: EntryRole,
    pub url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub title: Option<String>,
    pub primary: bool,
    pub original: bool,
    pub access: AccessLevel,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicLicense {
    pub scope: LicenseScope,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub applies_to_entry: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub identifier: Option<String>,
    pub status: LicenseStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub osi_approved: Option<bool>,
    pub evidence_ids: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub checked_at: Option<NaiveDate>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicOrigin {
    pub regions: Vec<OriginRegion>,
    pub statement: String,
    pub evidence_ids: Vec<String>,
    pub checked_at: NaiveDate,
    pub region_evidence: Vec<PublicRegionEvidence>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicRegionEvidence {
    pub region: OriginRegion,
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicAffiliation {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_maintainer: Option<PublicParty>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub current_foundation: Option<PublicParty>,
    pub as_of: NaiveDate,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicParty {
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub url: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicLogo {
    pub path: String,
    pub source_url: String,
    pub alt: String,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicStandardPolicy {
    pub status: StandardPolicyStatus,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub entry_id: Option<String>,
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicEvidence {
    pub id: String,
    pub title: String,
    pub url: String,
    pub publisher: String,
    pub claim: String,
    pub checked_at: NaiveDate,
}

/// Withdrawn entries expose only the information needed to resolve old links.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct PublicWithdrawal {
    pub id: String,
    pub reason_code: String,
    pub public_message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub replacement_id: Option<String>,
    pub effective_at: NaiveDate,
}

impl SiteCatalog {
    /// Produce legacy input, engine data and public metadata as one projection.
    ///
    /// # Errors
    /// Returns an error for invalid source content, ambiguous identities,
    /// unsafe logo paths or a withdrawal pointing at an unpublished item.
    pub fn project(&self) -> Result<SiteProjection> {
        self.validate()?;
        validate_projection_ids(self)?;

        let public_items: Vec<_> = self.public_items().collect();
        let taxonomy = project_taxonomy(self, &public_items)?;
        let mut id_map = PublicIdMap::default();
        let mut engine_data = LandscapeData::default();
        let mut legacy = LegacyData::default();
        populate_categories(&taxonomy, &mut engine_data, &mut legacy);
        let mut items = Vec::new();
        let mut evidence_ids = BTreeSet::new();
        for item in public_items {
            let public_item = project_item(item)?;
            collect_evidence(&public_item, &mut evidence_ids);
            for placement in &public_item.placements {
                id_map.engine_to_stable.insert(placement.engine_id.clone(), item.id.clone());
                if placement.primary {
                    id_map.stable_to_primary.insert(item.id.clone(), placement.engine_id.clone());
                }
            }
            let engine_item = project_engine_item(item, &taxonomy)?;
            insert_legacy_item(&mut legacy, item, &engine_item);
            engine_data.items.push(engine_item);
            items.push(public_item);
        }
        let withdrawals = project_withdrawals(self)?;
        for item in self
            .items
            .iter()
            .filter(|item| item.is_public() || item.publication_status == PublicationStatus::Withdrawn)
        {
            for legacy_id in &item.legacy_ids {
                id_map.legacy_to_stable.insert(legacy_id.clone(), item.id.clone());
            }
            if item.publication_status == PublicationStatus::Withdrawn {
                for placement in &item.placements {
                    id_map.legacy_to_stable.insert(
                        engine_id(&placement.category_id, &placement.subcategory_id, &item.id),
                        item.id.clone(),
                    );
                }
            }
        }
        for link in &self.legacy_links {
            if items.iter().any(|item| item.id == link.item_id)
                || withdrawals.iter().any(|item| item.id == link.item_id)
            {
                id_map.legacy_to_stable.insert(link.legacy_id.clone(), link.item_id.clone());
            }
        }
        let evidence = self
            .evidence
            .iter()
            .filter(|evidence| evidence.public && evidence_ids.contains(&evidence.id))
            .map(|evidence| PublicEvidence {
                id: evidence.id.clone(),
                title: evidence.title.clone(),
                url: evidence.url.clone(),
                publisher: evidence.publisher.clone(),
                claim: evidence.claim.clone(),
                checked_at: evidence.checked_at,
            })
            .collect();
        Ok(SiteProjection {
            engine_data,
            legacy_yaml: serde_yaml::to_string(&legacy)?,
            metadata: PublicSiteMetadata {
                schema_version: self.schema_version.clone(),
                content_version: self.content_version.clone(),
                taxonomy,
                items,
                evidence,
                id_map,
                withdrawals,
            },
        })
    }
}

fn engine_id(category: &str, subcategory: &str, item: &str) -> String {
    format!(
        "{}--{}--{}",
        normalize_name(category),
        normalize_name(subcategory),
        normalize_name(item)
    )
}

/// Reserve identities from all states so publishing a draft cannot silently
/// reassign a link which already belongs to a visible or withdrawn item.
fn validate_projection_ids(catalog: &SiteCatalog) -> Result<()> {
    let mut ids: BTreeMap<String, &str> = BTreeMap::new();
    for item in &catalog.items {
        ids.insert(item.id.clone(), &item.id);
        for alias in &item.legacy_ids {
            if ids.insert(alias.clone(), &item.id).is_some() {
                bail!("E_PROJECTION_ID: conflicting legacy id {alias}");
            }
        }
    }
    for link in &catalog.legacy_links {
        if ids.insert(link.legacy_id.clone(), &link.item_id).is_some() {
            bail!("E_PROJECTION_ID: conflicting legacy id {}", link.legacy_id);
        }
    }
    for item in &catalog.items {
        for placement in &item.placements {
            let id = engine_id(&placement.category_id, &placement.subcategory_id, &item.id);
            if let Some(existing) = ids.insert(id.clone(), &item.id) {
                bail!(
                    "E_PROJECTION_ID: engine id {id} for {} conflicts with {existing}",
                    item.id
                );
            }
        }
    }
    Ok(())
}

fn project_taxonomy(catalog: &SiteCatalog, items: &[&SiteItem]) -> Result<PublicTaxonomy> {
    let subcategories: BTreeSet<_> = items
        .iter()
        .flat_map(|item| item.placements.iter().map(|placement| placement.subcategory_id.as_str()))
        .collect();
    let tags: BTreeSet<_> = items.iter().flat_map(|item| item.tag_ids.iter().map(String::as_str)).collect();
    let mut result = PublicTaxonomy::default();
    let mut category_names = BTreeSet::new();
    for category in &catalog.taxonomy.categories {
        let children: Vec<_> = category
            .subcategories
            .iter()
            .filter(|subcategory| subcategories.contains(subcategory.id.as_str()))
            .map(|subcategory| PublicSubcategory {
                id: subcategory.id.clone(),
                name: (&subcategory.name).into(),
            })
            .collect();
        if children.is_empty() {
            continue;
        }
        if !category_names.insert(normalize_name(&category.name.zh_cn)) {
            bail!(
                "E_PROJECTION_TAXONOMY: ambiguous category name {}",
                category.name.zh_cn
            );
        }
        let mut child_names = BTreeSet::new();
        for child in &children {
            if !child_names.insert(normalize_name(&child.name.zh_cn)) {
                bail!(
                    "E_PROJECTION_TAXONOMY: ambiguous subcategory name {}",
                    child.name.zh_cn
                );
            }
        }
        result.categories.push(PublicCategory {
            id: category.id.clone(),
            name: (&category.name).into(),
            subcategories: children,
        });
    }
    result.tags = catalog
        .taxonomy
        .tags
        .iter()
        .filter(|tag| tags.contains(tag.id.as_str()))
        .map(|tag| PublicTag {
            id: tag.id.clone(),
            name: (&tag.name).into(),
        })
        .collect();
    Ok(result)
}

#[allow(clippy::too_many_lines)]
fn project_item(item: &SiteItem) -> Result<PublicSiteItem> {
    let origin = item.origin.as_ref().expect("validated public item origin");
    if let Some(logo) = &item.logo {
        validate_logo_path(&logo.path)?;
    }
    Ok(PublicSiteItem {
        id: item.id.clone(),
        kind: item.kind,
        canonical_name: item.canonical_name.clone(),
        aliases: item.aliases.clone(),
        name: (&item.name).into(),
        description: (&item.description).into(),
        placements: item
            .placements
            .iter()
            .map(|placement| PublicPlacement {
                category_id: placement.category_id.clone(),
                subcategory_id: placement.subcategory_id.clone(),
                primary: placement.primary,
                engine_id: engine_id(&placement.category_id, &placement.subcategory_id, &item.id),
            })
            .collect(),
        tag_ids: item.tag_ids.clone(),
        entries: item
            .entries
            .iter()
            .map(|entry| PublicEntry {
                id: entry.id.clone(),
                role: entry.role,
                url: entry.url.clone(),
                title: entry.title.clone(),
                primary: entry.primary,
                original: entry.original,
                access: entry.access,
            })
            .collect(),
        licenses: item
            .licenses
            .iter()
            .map(|license| PublicLicense {
                scope: license.scope,
                applies_to_entry: license.applies_to_entry.clone(),
                version: license.version.clone(),
                identifier: license.identifier.clone(),
                status: license.status,
                osi_approved: license.osi_approved,
                evidence_ids: license.evidence_ids.clone(),
                checked_at: license.checked_at,
            })
            .collect(),
        origin: PublicOrigin {
            regions: origin.regions.clone(),
            statement: origin.statement.clone(),
            evidence_ids: origin.evidence_ids.clone(),
            checked_at: origin.checked_at,
            region_evidence: origin
                .region_evidence
                .iter()
                .map(|mapping| PublicRegionEvidence {
                    region: mapping.region,
                    evidence_ids: mapping.evidence_ids.clone(),
                })
                .collect(),
        },
        affiliation: item.affiliation.as_ref().map(|affiliation| PublicAffiliation {
            current_maintainer: affiliation.current_maintainer.as_ref().map(public_party),
            current_foundation: affiliation.current_foundation.as_ref().map(public_party),
            as_of: affiliation.as_of,
        }),
        publication_status: item.publication_status,
        project_status: item.project_status,
        status_evidence_ids: item.status_evidence_ids.clone(),
        status_checked_at: item.status_checked_at,
        logo: item.logo.as_ref().map(|logo| PublicLogo {
            path: logo.path.clone(),
            source_url: logo.source_url.clone(),
            alt: logo.alt.clone(),
        }),
        standard_policy: item.standard_policy.as_ref().map(|policy| PublicStandardPolicy {
            status: policy.status,
            entry_id: policy.entry_id.clone(),
            evidence_ids: policy.evidence_ids.clone(),
        }),
    })
}

fn public_party(party: &super::Party) -> PublicParty {
    PublicParty {
        name: party.name.clone(),
        url: party.url.clone(),
    }
}

fn validate_logo_path(path: &str) -> Result<()> {
    if path.contains(['\\', ':', '?', '#', '\0'])
        || path.split('/').any(|part| part.is_empty() || part == "." || part == "..")
    {
        bail!("E_PROJECTION_LOGO: logo must use a safe relative path: {path}");
    }
    Ok(())
}

fn collect_evidence(item: &PublicSiteItem, ids: &mut BTreeSet<String>) {
    ids.extend(item.origin.evidence_ids.iter().cloned());
    for mapping in &item.origin.region_evidence {
        ids.extend(mapping.evidence_ids.iter().cloned());
    }
    ids.extend(item.status_evidence_ids.iter().cloned());
    for license in &item.licenses {
        ids.extend(license.evidence_ids.iter().cloned());
    }
    if let Some(policy) = &item.standard_policy {
        ids.extend(policy.evidence_ids.iter().cloned());
    }
}

fn project_withdrawals(catalog: &SiteCatalog) -> Result<Vec<PublicWithdrawal>> {
    let items: BTreeMap<_, _> = catalog.items.iter().map(|item| (item.id.as_str(), item)).collect();
    catalog
        .items
        .iter()
        .filter(|item| item.publication_status == PublicationStatus::Withdrawn)
        .map(|item| {
            let record = item.withdrawal.as_ref().expect("validated withdrawal");
            let replacement_id = resolve_replacement(item, &items)?;
            Ok(PublicWithdrawal {
                id: item.id.clone(),
                reason_code: record.reason_code.clone(),
                public_message: record.public_message.clone(),
                replacement_id,
                effective_at: record.effective_at,
            })
        })
        .collect()
}

fn resolve_replacement(item: &SiteItem, items: &BTreeMap<&str, &SiteItem>) -> Result<Option<String>> {
    let mut seen = BTreeSet::from([item.id.as_str()]);
    let mut next = item.withdrawal.as_ref().and_then(|withdrawal| withdrawal.replacement_id.as_deref());
    while let Some(id) = next {
        if !seen.insert(id) {
            bail!("E_PROJECTION_WITHDRAWAL: replacement cycle for {}", item.id);
        }
        let target = items.get(id).expect("validated replacement reference");
        if target.is_public() {
            return Ok(Some(id.to_string()));
        }
        if target.publication_status != PublicationStatus::Withdrawn {
            bail!(
                "E_PROJECTION_WITHDRAWAL: replacement {id} for {} is not public",
                item.id
            );
        }
        next = target.withdrawal.as_ref().and_then(|withdrawal| withdrawal.replacement_id.as_deref());
        if next.is_none() {
            return Ok(Some(id.to_string()));
        }
    }
    Ok(None)
}

fn populate_categories(taxonomy: &PublicTaxonomy, engine: &mut LandscapeData, legacy: &mut LegacyData) {
    for category in &taxonomy.categories {
        engine.categories.push(Category {
            name: category.name.zh_cn.clone(),
            normalized_name: normalize_name(&category.name.zh_cn),
            subcategories: category
                .subcategories
                .iter()
                .map(|subcategory| Subcategory {
                    name: subcategory.name.zh_cn.clone(),
                    normalized_name: normalize_name(&subcategory.name.zh_cn),
                })
                .collect(),
        });
        legacy.landscape.push(LegacyCategory {
            name: category.id.clone(),
            subcategories: category
                .subcategories
                .iter()
                .map(|subcategory| LegacySubcategory {
                    name: subcategory.id.clone(),
                    items: vec![],
                })
                .collect(),
        });
    }
}

fn project_engine_item(item: &SiteItem, taxonomy: &PublicTaxonomy) -> Result<Item> {
    let primary = item.placements.iter().find(|placement| placement.primary).expect("validated placement");
    let primary_entry = item.entries.iter().find(|entry| entry.primary).expect("validated primary entry");
    let (category, subcategory) = display_placement(taxonomy, &primary.category_id, &primary.subcategory_id);
    let homepage = item
        .entries
        .iter()
        .find(|entry| entry.role == EntryRole::Official && entry.original)
        .unwrap_or(primary_entry)
        .url
        .clone();
    let additional_categories: Vec<_> = item
        .placements
        .iter()
        .filter(|placement| !placement.primary)
        .map(|placement| {
            let (category, subcategory) =
                display_placement(taxonomy, &placement.category_id, &placement.subcategory_id);
            AdditionalCategory {
                category,
                subcategory,
            }
        })
        .collect();
    let repositories: Vec<_> = item
        .entries
        .iter()
        .filter(|entry| item.kind == ItemKind::Software && entry.role == EntryRole::Repository)
        .map(|entry| Repository {
            url: entry.url.clone(),
            primary: Some(entry.primary),
            license: item
                .licenses
                .iter()
                .find(|license| {
                    license.scope == LicenseScope::SourceCode
                        && license.status == LicenseStatus::Verified
                        && license.applies_to_entry.as_deref() == Some(entry.id.as_str())
                })
                .and_then(|license| license.identifier.clone()),
            ..Default::default()
        })
        .collect();
    let other_links: Vec<_> = item
        .entries
        .iter()
        .filter(|entry| entry.role != EntryRole::Repository && entry.url != homepage)
        .map(|entry| ItemLink {
            name: entry.title.clone().unwrap_or_else(|| entry.id.clone()),
            url: entry.url.clone(),
        })
        .collect();
    let logo = item.logo.as_ref().map_or(MISSING_LOGO, |logo| logo.path.as_str());
    validate_logo_path(logo)?;
    Ok(Item {
        id: item.id.clone(),
        name: item.name.zh_cn.clone(),
        category,
        subcategory,
        homepage_url: homepage.clone(),
        website: homepage,
        logo: logo.to_string(),
        description: Some(item.description.zh_cn.clone()),
        annotations: Some(HashMap::from([("site-id".to_string(), item.id.clone())])),
        additional_categories: (!additional_categories.is_empty()).then_some(additional_categories),
        repositories: (!repositories.is_empty()).then_some(repositories),
        other_links: (!other_links.is_empty()).then_some(other_links),
        ..Default::default()
    })
}

fn display_placement(taxonomy: &PublicTaxonomy, category_id: &str, subcategory_id: &str) -> (String, String) {
    let category = taxonomy
        .categories
        .iter()
        .find(|category| category.id == category_id)
        .expect("validated category");
    let subcategory = category
        .subcategories
        .iter()
        .find(|subcategory| subcategory.id == subcategory_id)
        .expect("validated subcategory");
    (category.name.zh_cn.clone(), subcategory.name.zh_cn.clone())
}

fn insert_legacy_item(legacy: &mut LegacyData, item: &SiteItem, engine: &Item) {
    let primary = item.placements.iter().find(|placement| placement.primary).expect("validated placement");
    let category = legacy
        .landscape
        .iter_mut()
        .find(|category| category.name == primary.category_id)
        .expect("projected category");
    let subcategory = category
        .subcategories
        .iter_mut()
        .find(|subcategory| subcategory.name == primary.subcategory_id)
        .expect("projected subcategory");
    let repositories = engine.repositories.as_deref().unwrap_or_default();
    let primary_repo = repositories.iter().find(|repo| repo.primary == Some(true));
    subcategory.items.push(LegacyItem {
        name: item.id.clone(),
        homepage_url: engine.homepage_url.clone(),
        logo: engine.logo.clone(),
        description: item.description.zh_cn.clone(),
        repo_url: primary_repo.map(|repo| repo.url.clone()),
        license: primary_repo.and_then(|repo| repo.license.clone()),
        additional_repos: repositories
            .iter()
            .filter(|repo| repo.primary != Some(true))
            .map(|repo| LegacyRepository {
                repo_url: repo.url.clone(),
                license: repo.license.clone(),
            })
            .collect(),
        second_path: item
            .placements
            .iter()
            .filter(|placement| !placement.primary)
            .map(|placement| format!("{} / {}", placement.category_id, placement.subcategory_id))
            .collect(),
        extra: LegacyExtra {
            annotations: BTreeMap::from([
                ("site-id".to_string(), item.id.clone()),
                ("site-name".to_string(), item.name.zh_cn.clone()),
            ]),
            other_links: engine.other_links.clone().unwrap_or_default(),
        },
    });
}

// A deliberately small legacy writer. The upstream parser remains untouched.
#[derive(Default, Serialize)]
struct LegacyData {
    landscape: Vec<LegacyCategory>,
}

#[derive(Serialize)]
struct LegacyCategory {
    name: String,
    subcategories: Vec<LegacySubcategory>,
}

#[derive(Serialize)]
struct LegacySubcategory {
    name: String,
    items: Vec<LegacyItem>,
}

#[derive(Serialize)]
struct LegacyItem {
    name: String,
    homepage_url: String,
    logo: String,
    description: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    repo_url: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    license: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    additional_repos: Vec<LegacyRepository>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    second_path: Vec<String>,
    extra: LegacyExtra,
}

#[derive(Serialize)]
struct LegacyRepository {
    repo_url: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    license: Option<String>,
}

#[derive(Serialize)]
struct LegacyExtra {
    annotations: BTreeMap<String, String>,
    #[serde(skip_serializing_if = "Vec::is_empty")]
    other_links: Vec<ItemLink>,
}

#[cfg(test)]
mod tests;

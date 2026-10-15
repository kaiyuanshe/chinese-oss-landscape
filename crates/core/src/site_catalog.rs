//! Versioned content contract for the Chinese open source landscape.
//!
//! This module is deliberately separate from [`crate::data`]. The latter
//! parses the upstream Landscape2 YAML format; this contract keeps stable IDs,
//! localization, evidence and asset-level licensing independent. The publishing
//! adapter in [`projection`] exposes only approved public fields.

use std::{
    collections::{HashMap, HashSet},
    fs,
    path::PathBuf,
};

use anyhow::{Context, Result, bail};
use chrono::NaiveDate;
use clap::Args;
use reqwest::StatusCode;
use serde::{Deserialize, Serialize};
use url::Url;

pub mod projection;

const SCHEMA_VERSION: &str = "1";

/// A source for the versioned site content contract.
#[derive(Args, Default, Debug, Clone, PartialEq)]
#[group(required = true, multiple = false)]
pub struct SiteContentSource {
    /// Site content contract file local path.
    #[arg(long = "content-file")]
    pub content_file: Option<PathBuf>,

    /// Site content contract file URL.
    #[arg(long = "content-url")]
    pub content_url: Option<String>,
}

impl SiteContentSource {
    /// Create a source from a local file.
    #[must_use]
    pub fn from_file(path: PathBuf) -> Self {
        Self {
            content_file: Some(path),
            content_url: None,
        }
    }
}

/// The versioned, site-owned content catalog.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SiteCatalog {
    pub schema_version: String,
    pub content_version: String,
    pub taxonomy: SiteTaxonomy,
    pub evidence: Vec<Evidence>,
    pub items: Vec<SiteItem>,
    #[serde(default)]
    pub legacy_links: Vec<LegacyLink>,
}

impl SiteCatalog {
    /// Load and validate a catalog from a file or URL.
    ///
    /// # Errors
    /// Returns an error when the source cannot be read or the contract is invalid.
    pub async fn new(source: &SiteContentSource) -> Result<Self> {
        let raw = if let Some(path) = &source.content_file {
            fs::read_to_string(path)
                .with_context(|| format!("failed to read site content: {}", path.display()))?
        } else if let Some(url) = &source.content_url {
            let response = reqwest::get(url).await?;
            if response.status() != StatusCode::OK {
                bail!(
                    "unexpected status code getting site content: {}",
                    response.status()
                );
            }
            response.text().await?
        } else {
            bail!("content file or url not provided");
        };

        Self::from_yaml(&raw)
    }

    /// Parse and validate YAML content.
    ///
    /// # Errors
    /// Returns an error when the YAML is malformed or violates the contract.
    pub fn from_yaml(raw: &str) -> Result<Self> {
        let catalog: Self = serde_yaml::from_str(raw).context("invalid site content YAML")?;
        catalog.validate()?;
        Ok(catalog)
    }

    /// Validate the contract and its cross references.
    ///
    /// # Errors
    /// Returns an error when a required field, reference, status or asset rule is invalid.
    pub fn validate(&self) -> Result<()> {
        if self.schema_version != SCHEMA_VERSION {
            bail!("E_SCHEMA_VERSION schema_version: expected {SCHEMA_VERSION}");
        }
        if self.content_version.trim().is_empty() {
            bail!("E_REQUIRED content_version: value is required");
        }

        let category_ids = unique_ids(
            self.taxonomy.categories.iter().map(|category| category.id.as_str()),
            "taxonomy.categories",
        )?;
        let mut subcategory_ids = Vec::new();
        let mut subcategory_parents = HashMap::new();
        for (index, category) in self.taxonomy.categories.iter().enumerate() {
            validate_id(&category.id, &format!("taxonomy.categories[{index}].id"))?;
            validate_localized(&category.name, &format!("taxonomy.categories[{index}].name"))?;
            for (subcategory_index, subcategory) in category.subcategories.iter().enumerate() {
                validate_id(
                    &subcategory.id,
                    &format!("taxonomy.categories[{index}].subcategories[{subcategory_index}].id"),
                )?;
                validate_localized(
                    &subcategory.name,
                    &format!("taxonomy.categories[{index}].subcategories[{subcategory_index}].name"),
                )?;
                subcategory_ids.push(subcategory.id.as_str());
                subcategory_parents.insert(subcategory.id.as_str(), category.id.as_str());
            }
        }
        unique_ids(subcategory_ids, "taxonomy.subcategories")?;
        let tag_ids = unique_ids(
            self.taxonomy.tags.iter().map(|tag| tag.id.as_str()),
            "taxonomy.tags",
        )?;
        for (index, tag) in self.taxonomy.tags.iter().enumerate() {
            validate_id(&tag.id, &format!("taxonomy.tags[{index}].id"))?;
            validate_localized(&tag.name, &format!("taxonomy.tags[{index}].name"))?;
        }

        let evidence_ids = unique_ids(self.evidence.iter().map(|item| item.id.as_str()), "evidence")?;
        for (index, evidence) in self.evidence.iter().enumerate() {
            validate_id(&evidence.id, &format!("evidence[{index}].id"))?;
            require_text(&evidence.title, &format!("evidence[{index}].title"))?;
            validate_http_url(&evidence.url, &format!("evidence[{index}].url"))?;
            require_text(&evidence.publisher, &format!("evidence[{index}].publisher"))?;
            require_text(&evidence.claim, &format!("evidence[{index}].claim"))?;
            if !evidence.public {
                bail!("E_PRIVATE_EVIDENCE evidence[{index}].public: evidence must be public");
            }
        }

        let item_ids = unique_ids(self.items.iter().map(|item| item.id.as_str()), "items")?;
        let mut legacy_ids = Vec::new();
        for (index, item) in self.items.iter().enumerate() {
            validate_item(
                item,
                index,
                &category_ids,
                &subcategory_parents,
                &tag_ids,
                &evidence_ids,
                &item_ids,
            )?;
            legacy_ids.extend(item.legacy_ids.iter().map(String::as_str));
        }
        unique_ids(legacy_ids, "items.legacy_ids")?;
        validate_replacements(&self.items)?;

        let mut mapped_legacy_ids = Vec::new();
        for (index, link) in self.legacy_links.iter().enumerate() {
            require_text(&link.legacy_id, &format!("legacy_links[{index}].legacy_id"))?;
            if !item_ids.contains(&link.item_id.as_str()) {
                bail!(
                    "E_REFERENCE legacy_links[{index}].item_id: unknown item {}",
                    link.item_id
                );
            }
            mapped_legacy_ids.push(link.legacy_id.as_str());
        }
        unique_ids(mapped_legacy_ids, "legacy_links")?;
        let mut all_legacy_ids = HashSet::new();
        for item in &self.items {
            for legacy_id in &item.legacy_ids {
                require_text(legacy_id, "items.legacy_ids")?;
                if !all_legacy_ids.insert(legacy_id) || item_ids.contains(&legacy_id.as_str()) {
                    bail!("E_DUPLICATE items.legacy_ids: conflicting legacy id {legacy_id}");
                }
            }
        }
        for link in &self.legacy_links {
            if !all_legacy_ids.insert(&link.legacy_id) || item_ids.contains(&link.legacy_id.as_str()) {
                bail!(
                    "E_DUPLICATE legacy_links: conflicting legacy id {}",
                    link.legacy_id
                );
            }
        }
        Ok(())
    }

    /// Filter source records by publication state for the publishing adapter.
    ///
    /// These are complete authoring records, not a public field whitelist. Never
    /// serialize this iterator directly into public artifacts.
    pub fn public_items(&self) -> impl Iterator<Item = &SiteItem> {
        self.items.iter().filter(|item| item.is_public())
    }
}

/// Taxonomy with stable IDs independent from translated labels.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SiteTaxonomy {
    pub categories: Vec<SiteCategory>,
    #[serde(default)]
    pub tags: Vec<SiteTag>,
}

/// A stable category.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SiteCategory {
    pub id: String,
    pub name: LocalizedText,
    pub subcategories: Vec<SiteSubcategory>,
}

/// A stable subcategory.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SiteSubcategory {
    pub id: String,
    pub name: LocalizedText,
}

/// A stable tag.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SiteTag {
    pub id: String,
    pub name: LocalizedText,
}

/// Chinese is required; English is an explicit optional fallback.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LocalizedText {
    #[serde(rename = "zh-CN")]
    pub zh_cn: String,
    #[serde(default)]
    pub en: Option<String>,
}

impl LocalizedText {
    /// Resolve a requested locale, falling back to Chinese for missing or unsupported locales.
    #[must_use]
    pub fn text(&self, locale: &str) -> &str {
        if locale == "en" {
            self.en.as_deref().filter(|value| !value.trim().is_empty()).unwrap_or(&self.zh_cn)
        } else {
            &self.zh_cn
        }
    }
}

/// One site-owned entry.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct SiteItem {
    pub id: String,
    pub kind: ItemKind,
    pub canonical_name: String,
    #[serde(default)]
    pub aliases: Vec<String>,
    pub name: LocalizedText,
    #[serde(default)]
    pub description: LocalizedText,
    #[serde(default)]
    pub placements: Vec<Placement>,
    #[serde(default)]
    pub tag_ids: Vec<String>,
    #[serde(default)]
    pub entries: Vec<Entry>,
    #[serde(default)]
    pub licenses: Vec<LicenseRecord>,
    #[serde(default)]
    pub origin: Option<Origin>,
    #[serde(default)]
    pub affiliation: Option<Affiliation>,
    pub publication_status: PublicationStatus,
    pub project_status: ProjectStatus,
    #[serde(default)]
    pub status_evidence_ids: Vec<String>,
    #[serde(default)]
    pub status_checked_at: Option<NaiveDate>,
    #[serde(default)]
    pub review: Option<ReviewRecord>,
    #[serde(default)]
    pub logo: Option<LogoRecord>,
    #[serde(default)]
    pub legacy_ids: Vec<String>,
    #[serde(default)]
    pub withdrawal: Option<WithdrawalRecord>,
    #[serde(default)]
    pub standard_policy: Option<StandardPolicy>,
}

impl SiteItem {
    /// Whether this item is included in the public map and search projection.
    #[must_use]
    pub const fn is_public(&self) -> bool {
        matches!(
            self.publication_status,
            PublicationStatus::Published | PublicationStatus::NeedsReview
        )
    }
}

/// The five supported object types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ItemKind {
    Software,
    ModelWeights,
    Dataset,
    OpenStandard,
    Community,
}

/// A category placement. Exactly one placement is primary.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Placement {
    pub category_id: String,
    pub subcategory_id: String,
    pub primary: bool,
}

/// A type-specific or informational public entry point.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Entry {
    pub id: String,
    pub role: EntryRole,
    pub url: String,
    #[serde(default)]
    pub title: Option<String>,
    pub primary: bool,
    #[serde(default)]
    pub original: bool,
    #[serde(default)]
    pub access: AccessLevel,
}

impl Default for Entry {
    fn default() -> Self {
        Self {
            id: String::new(),
            role: EntryRole::Official,
            url: String::new(),
            title: None,
            primary: false,
            original: false,
            access: AccessLevel::Public,
        }
    }
}

/// Entry roles are independent from the old repository-only data model.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum EntryRole {
    Repository,
    Weights,
    Dataset,
    Specification,
    Official,
    Documentation,
    Community,
}

/// Access conditions are recorded even while policy for restricted assets is pending.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum AccessLevel {
    #[default]
    Public,
    Login,
    Approval,
    Contract,
}

/// A license applies to an asset scope, never implicitly to another scope.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LicenseRecord {
    pub scope: LicenseScope,
    #[serde(default)]
    pub applies_to_entry: Option<String>,
    #[serde(default)]
    pub version: Option<String>,
    #[serde(default)]
    pub identifier: Option<String>,
    pub status: LicenseStatus,
    #[serde(default)]
    pub osi_approved: Option<bool>,
    #[serde(default)]
    pub evidence_ids: Vec<String>,
    #[serde(default)]
    pub checked_at: Option<NaiveDate>,
}

/// Asset scopes for license evidence.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LicenseScope {
    SourceCode,
    ModelWeights,
    Dataset,
    StandardText,
    StandardImplementation,
    Organization,
}

/// License verification state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LicenseStatus {
    Verified,
    InReview,
    Unknown,
    NotApplicable,
}

/// Historical origin evidence and regional attribution.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Origin {
    pub regions: Vec<OriginRegion>,
    pub statement: String,
    pub evidence_ids: Vec<String>,
    pub checked_at: NaiveDate,
    pub region_evidence: Vec<OriginRegionEvidence>,
}

/// Evidence supporting a particular historical origin region.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct OriginRegionEvidence {
    pub region: OriginRegion,
    pub evidence_ids: Vec<String>,
}

/// Public implementation and patent policy status for an open standard.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct StandardPolicy {
    pub status: StandardPolicyStatus,
    #[serde(default)]
    pub entry_id: Option<String>,
    #[serde(default)]
    pub evidence_ids: Vec<String>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum StandardPolicyStatus {
    Public,
    Restricted,
    Unknown,
    NotApplicable,
}

/// The four regions accepted by D0.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum OriginRegion {
    Mainland,
    HongKong,
    #[serde(rename = "macau", alias = "macao")]
    Macao,
    Taiwan,
}

/// Current affiliation, independent of historical origin.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Affiliation {
    #[serde(default)]
    pub current_maintainer: Option<Party>,
    #[serde(default)]
    pub current_foundation: Option<Party>,
    pub as_of: NaiveDate,
}

/// A public organization or project party.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Party {
    pub name: String,
    #[serde(default)]
    pub url: Option<String>,
}

/// Public evidence for the current maintenance state.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct Evidence {
    pub id: String,
    pub title: String,
    pub url: String,
    pub publisher: String,
    pub claim: String,
    pub checked_at: NaiveDate,
    #[serde(default = "default_true")]
    pub public: bool,
}

/// Review metadata uses a role, never a private contact field.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct ReviewRecord {
    pub reviewed_at: NaiveDate,
    pub reviewer_role: String,
}

/// Local logo and attribution metadata.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LogoRecord {
    pub path: String,
    pub source_url: String,
    pub alt: String,
}

/// Small public record retained for an item that was withdrawn or merged.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct WithdrawalRecord {
    pub reason_code: String,
    pub public_message: String,
    #[serde(default)]
    pub replacement_id: Option<String>,
    pub effective_at: NaiveDate,
}

/// A legacy ID mapping to a stable site item.
#[derive(Debug, Clone, Default, PartialEq, Serialize, Deserialize)]
#[serde(deny_unknown_fields)]
pub struct LegacyLink {
    pub legacy_id: String,
    pub item_id: String,
}

/// Publication state, separate from maintenance state.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum PublicationStatus {
    Draft,
    InReview,
    Published,
    NeedsReview,
    Withdrawn,
}

/// Maintenance state, shared by all five object types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ProjectStatus {
    Active,
    Archived,
    Unknown,
}

#[allow(clippy::too_many_lines)]
fn validate_item(
    item: &SiteItem,
    index: usize,
    category_ids: &[&str],
    subcategory_parents: &HashMap<&str, &str>,
    tag_ids: &[&str],
    evidence_ids: &[&str],
    item_ids: &[&str],
) -> Result<()> {
    let path = |field: &str| format!("items[{index}].{field}");
    let is_public = item.is_public();
    validate_id(&item.id, &path("id"))?;
    require_text(&item.canonical_name, &path("canonical_name"))?;
    validate_localized(&item.name, &path("name"))?;
    if is_public || !item.description.zh_cn.trim().is_empty() {
        validate_localized(&item.description, &path("description"))?;
    }
    if is_public && item.placements.is_empty() {
        bail!(
            "E_REQUIRED {}: at least one placement is required",
            path("placements")
        );
    }
    let primary_count = item.placements.iter().filter(|placement| placement.primary).count();
    if is_public && primary_count != 1 {
        bail!(
            "E_PRIMARY {}: exactly one primary placement is required",
            path("placements")
        );
    }
    let mut placements = HashSet::new();
    for (placement_index, placement) in item.placements.iter().enumerate() {
        if !category_ids.contains(&placement.category_id.as_str()) {
            bail!(
                "E_REFERENCE items[{index}].placements[{placement_index}].category_id: unknown category {}",
                placement.category_id
            );
        }
        if subcategory_parents.get(placement.subcategory_id.as_str()) != Some(&placement.category_id.as_str())
        {
            bail!(
                "E_REFERENCE items[{index}].placements[{placement_index}]: subcategory {} does not belong to category {}",
                placement.subcategory_id,
                placement.category_id
            );
        }
        if !placements.insert((&placement.category_id, &placement.subcategory_id)) {
            bail!("E_DUPLICATE items[{index}].placements: duplicate placement");
        }
    }
    unique_ids(item.tag_ids.iter().map(String::as_str), &path("tag_ids"))?;
    for (tag_index, tag_id) in item.tag_ids.iter().enumerate() {
        if !tag_ids.contains(&tag_id.as_str()) {
            bail!(
                "E_REFERENCE {}[{tag_index}]: unknown tag {tag_id}",
                path("tag_ids")
            );
        }
    }

    let mut entry_ids = HashSet::new();
    for (entry_index, entry) in item.entries.iter().enumerate() {
        validate_id(&entry.id, &format!("items[{index}].entries[{entry_index}].id"))?;
        if !entry_ids.insert(&entry.id) {
            bail!("E_DUPLICATE items[{index}].entries: duplicate id {}", entry.id);
        }
    }
    let primary_entries: Vec<&Entry> = item.entries.iter().filter(|entry| entry.primary).collect();
    if is_public && primary_entries.len() != 1 {
        bail!(
            "E_PRIMARY {}: exactly one primary entry is required",
            path("entries")
        );
    }
    for (entry_index, entry) in item.entries.iter().enumerate() {
        validate_http_url(&entry.url, &format!("items[{index}].entries[{entry_index}].url"))?;
        if entry.primary && !entry.original {
            bail!("E_ENTRY items[{index}].entries[{entry_index}].original: primary entry must be original");
        }
        if entry.primary && entry.access != AccessLevel::Public && is_public {
            bail!(
                "E_ENTRY items[{index}].entries[{entry_index}].access: public items require a public primary entry"
            );
        }
    }
    if let Some(primary) = primary_entries.first() {
        let expected_role = expected_entry_role(item.kind);
        if primary.role != expected_role {
            bail!(
                "E_ENTRY {}: primary role must be {:?}",
                path("entries"),
                expected_role
            );
        }
    }

    if let Some(origin) = &item.origin {
        validate_origin(origin, index, evidence_ids, is_public)?;
    } else if is_public {
        bail!("E_ORIGIN {}: public item requires origin", path("origin"));
    }
    validate_evidence_refs(
        &item.status_evidence_ids,
        evidence_ids,
        &path("status_evidence_ids"),
    )?;
    if matches!(
        item.project_status,
        ProjectStatus::Active | ProjectStatus::Archived
    ) && (item.status_evidence_ids.is_empty() || item.status_checked_at.is_none())
    {
        bail!(
            "E_STATUS {}: active/archived status requires evidence and checked_at",
            path("project_status")
        );
    }
    if let Some(affiliation) = &item.affiliation {
        if let Some(party) = &affiliation.current_maintainer {
            require_text(&party.name, &path("affiliation.current_maintainer.name"))?;
            if let Some(url) = &party.url {
                validate_http_url(url, &path("affiliation.current_maintainer.url"))?;
            }
        }
        if let Some(party) = &affiliation.current_foundation {
            require_text(&party.name, &path("affiliation.current_foundation.name"))?;
            if let Some(url) = &party.url {
                validate_http_url(url, &path("affiliation.current_foundation.url"))?;
            }
        }
    }
    validate_licenses(item, index, evidence_ids, is_public)?;
    validate_standard_policy(item, index, evidence_ids, is_public)?;
    validate_publication_requirements(item, index, item_ids)?;
    if let Some(withdrawal) = &item.withdrawal {
        require_text(&withdrawal.reason_code, &path("withdrawal.reason_code"))?;
        require_text(&withdrawal.public_message, &path("withdrawal.public_message"))?;
        if let Some(replacement_id) = &withdrawal.replacement_id
            && (replacement_id == &item.id || !item_ids.contains(&replacement_id.as_str()))
        {
            bail!(
                "E_REFERENCE {}.replacement_id: unknown or self replacement",
                path("withdrawal")
            );
        }
    }
    if item.publication_status == PublicationStatus::Withdrawn && item.withdrawal.is_none() {
        bail!(
            "E_WITHDRAWAL {}: withdrawn item requires a minimal withdrawal record",
            path("withdrawal")
        );
    }
    if item.publication_status != PublicationStatus::Withdrawn && item.withdrawal.is_some() {
        bail!(
            "E_WITHDRAWAL {}: only withdrawn items may have a withdrawal record",
            path("withdrawal")
        );
    }
    if let Some(review) = &item.review {
        require_text(&review.reviewer_role, &path("review.reviewer_role"))?;
    }
    if let Some(logo) = &item.logo {
        validate_logo_path(&logo.path, &path("logo.path"))?;
        require_text(&logo.source_url, &path("logo.source_url"))?;
        validate_http_url(&logo.source_url, &path("logo.source_url"))?;
        require_text(&logo.alt, &path("logo.alt"))?;
    }
    Ok(())
}

fn validate_publication_requirements(item: &SiteItem, index: usize, _item_ids: &[&str]) -> Result<()> {
    let path = |field: &str| format!("items[{index}].{field}");
    if matches!(
        item.publication_status,
        PublicationStatus::Published | PublicationStatus::NeedsReview
    ) {
        if item.origin.as_ref().is_none_or(|origin| origin.evidence_ids.is_empty()) || item.review.is_none() {
            bail!(
                "E_PUBLISH {}: published item requires origin evidence and review metadata",
                path("publication_status")
            );
        }
        if item.publication_status == PublicationStatus::NeedsReview && item.status_checked_at.is_none() {
            bail!(
                "E_STATUS {}: needs_review requires status_checked_at",
                path("status_checked_at")
            );
        }
    }
    Ok(())
}

fn validate_replacements(items: &[SiteItem]) -> Result<()> {
    let by_id: HashMap<&str, &SiteItem> = items.iter().map(|item| (item.id.as_str(), item)).collect();
    for (index, item) in items.iter().enumerate() {
        let mut current = item;
        let mut seen = HashSet::from([item.id.as_str()]);
        while let Some(replacement_id) =
            current.withdrawal.as_ref().and_then(|record| record.replacement_id.as_deref())
        {
            if !seen.insert(replacement_id) {
                bail!("E_WITHDRAWAL items[{index}].withdrawal.replacement_id: replacement cycle");
            }
            let Some(replacement) = by_id.get(replacement_id) else {
                bail!(
                    "E_REFERENCE items[{index}].withdrawal.replacement_id: unknown replacement {replacement_id}"
                );
            };
            if matches!(
                replacement.publication_status,
                PublicationStatus::Draft | PublicationStatus::InReview
            ) {
                bail!(
                    "E_WITHDRAWAL items[{index}].withdrawal.replacement_id: replacement cannot expose an unpublished item"
                );
            }
            current = replacement;
        }
    }
    Ok(())
}

fn validate_licenses(item: &SiteItem, index: usize, evidence_ids: &[&str], is_public: bool) -> Result<()> {
    let path = |field: &str| format!("items[{index}].{field}");
    if item.kind == ItemKind::Community
        && is_public
        && (item.licenses.len() != 1
            || item.licenses[0].scope != LicenseScope::Organization
            || item.licenses[0].status != LicenseStatus::NotApplicable)
    {
        bail!(
            "E_LICENSE {}: community must use one organization/not_applicable license record",
            path("licenses")
        );
    }
    for (license_index, record) in item.licenses.iter().enumerate() {
        let license_path = format!("items[{index}].licenses[{license_index}]");
        validate_evidence_refs(
            &record.evidence_ids,
            evidence_ids,
            &format!("{license_path}.evidence_ids"),
        )?;
        if record.scope == LicenseScope::Organization {
            if item.kind != ItemKind::Community
                || record.status != LicenseStatus::NotApplicable
                || record.identifier.is_some()
                || record.osi_approved.is_some()
                || record.applies_to_entry.is_some()
                || record.version.is_some()
            {
                bail!(
                    "E_LICENSE {license_path}: organization license is only not_applicable to community identity"
                );
            }
        } else if record.status == LicenseStatus::NotApplicable {
            bail!("E_LICENSE {license_path}: asset licenses cannot be not_applicable");
        }
        if let Some(entry_id) = &record.applies_to_entry {
            let Some(entry) = item.entries.iter().find(|entry| &entry.id == entry_id) else {
                bail!("E_REFERENCE {license_path}.applies_to_entry: unknown entry {entry_id}");
            };
            if entry.role != license_entry_role(record.scope) {
                bail!("E_LICENSE {license_path}.applies_to_entry: entry role does not match license scope");
            }
        }
        if record.status == LicenseStatus::Verified
            && (record.identifier.as_deref().unwrap_or("").trim().is_empty()
                || record.osi_approved != Some(true)
                || record.evidence_ids.is_empty()
                || record.checked_at.is_none()
                || record.applies_to_entry.is_none()
                || record.version.as_deref().unwrap_or("").trim().is_empty())
        {
            bail!(
                "E_LICENSE {license_path}: verified license requires identifier, OSI approval, evidence, checked_at, covered entry and asset version/snapshot"
            );
        }
    }
    if is_public && item.kind != ItemKind::Community {
        let primary = item.entries.iter().find(|entry| entry.primary);
        let covered = item.licenses.iter().any(|record| {
            record.scope == expected_license_scope(item.kind)
                && record.status == LicenseStatus::Verified
                && primary.is_some_and(|entry| record.applies_to_entry.as_ref() == Some(&entry.id))
        });
        if !covered {
            bail!(
                "E_LICENSE {}: public item requires a verified license covering its primary asset entry",
                path("licenses")
            );
        }
    }
    Ok(())
}

fn validate_standard_policy(
    item: &SiteItem,
    index: usize,
    evidence_ids: &[&str],
    is_public: bool,
) -> Result<()> {
    if item.kind != ItemKind::OpenStandard {
        if item.standard_policy.is_some() {
            bail!("E_STANDARD items[{index}].standard_policy: only open standards may declare this policy");
        }
        return Ok(());
    }
    let path = |field: &str| format!("items[{index}].{field}");
    let Some(policy) = &item.standard_policy else {
        if is_public {
            bail!(
                "E_STANDARD {}: public standard requires implementation/patent policy",
                path("standard_policy")
            );
        }
        return Ok(());
    };
    if is_public && (policy.status != StandardPolicyStatus::Public || policy.evidence_ids.is_empty()) {
        bail!(
            "E_STANDARD {}: public standard requires a public policy with evidence",
            path("standard_policy")
        );
    }
    validate_evidence_refs(
        &policy.evidence_ids,
        evidence_ids,
        &path("standard_policy.evidence_ids"),
    )?;
    if let Some(entry_id) = &policy.entry_id
        && !item.entries.iter().any(|entry| &entry.id == entry_id)
    {
        bail!(
            "E_REFERENCE {}.entry_id: unknown entry {entry_id}",
            path("standard_policy")
        );
    }
    Ok(())
}

fn validate_origin(origin: &Origin, index: usize, evidence_ids: &[&str], is_public: bool) -> Result<()> {
    let mut regions = HashSet::new();
    if origin.regions.is_empty() || origin.regions.iter().any(|region| !regions.insert(region)) {
        bail!("E_ORIGIN items[{index}].origin.regions: regions must be non-empty and unique");
    }
    require_text(&origin.statement, &format!("items[{index}].origin.statement"))?;
    if is_public && origin.evidence_ids.is_empty() {
        bail!("E_ORIGIN items[{index}].origin.evidence_ids: at least one evidence is required");
    }
    validate_evidence_refs(
        &origin.evidence_ids,
        evidence_ids,
        &format!("items[{index}].origin.evidence_ids"),
    )?;
    let mut region_evidence = HashSet::new();
    for mapping in &origin.region_evidence {
        if !regions.contains(&mapping.region) || !region_evidence.insert(mapping.region) {
            bail!("E_ORIGIN items[{index}].origin.region_evidence: invalid or duplicate region");
        }
        if is_public && mapping.evidence_ids.is_empty() {
            bail!("E_ORIGIN items[{index}].origin.region_evidence: each region requires evidence");
        }
        validate_evidence_refs(
            &mapping.evidence_ids,
            evidence_ids,
            &format!("items[{index}].origin.region_evidence"),
        )?;
    }
    if is_public && region_evidence.len() != regions.len() {
        bail!("E_ORIGIN items[{index}].origin.region_evidence: every region requires evidence");
    }
    Ok(())
}

fn expected_entry_role(kind: ItemKind) -> EntryRole {
    match kind {
        ItemKind::Software => EntryRole::Repository,
        ItemKind::ModelWeights => EntryRole::Weights,
        ItemKind::Dataset => EntryRole::Dataset,
        ItemKind::OpenStandard => EntryRole::Specification,
        ItemKind::Community => EntryRole::Official,
    }
}

fn expected_license_scope(kind: ItemKind) -> LicenseScope {
    match kind {
        ItemKind::Software => LicenseScope::SourceCode,
        ItemKind::ModelWeights => LicenseScope::ModelWeights,
        ItemKind::Dataset => LicenseScope::Dataset,
        ItemKind::OpenStandard => LicenseScope::StandardText,
        ItemKind::Community => LicenseScope::Organization,
    }
}

fn license_entry_role(scope: LicenseScope) -> EntryRole {
    match scope {
        LicenseScope::SourceCode | LicenseScope::StandardImplementation => EntryRole::Repository,
        LicenseScope::ModelWeights => EntryRole::Weights,
        LicenseScope::Dataset => EntryRole::Dataset,
        LicenseScope::StandardText => EntryRole::Specification,
        LicenseScope::Organization => EntryRole::Official,
    }
}

fn validate_logo_path(value: &str, path: &str) -> Result<()> {
    require_text(value, path)?;
    if value.chars().any(|character| character.is_control() || "\\:%?#".contains(character))
        || value.split('/').any(|component| matches!(component, "" | "." | ".."))
    {
        bail!("E_LOGO_PATH {path}: expected a relative asset path without traversal or URL encoding");
    }
    Ok(())
}

fn validate_localized(value: &LocalizedText, path: &str) -> Result<()> {
    require_text(&value.zh_cn, &format!("{path}.zh-CN"))?;
    if value.en.as_deref().is_some_and(|text| text.trim().is_empty()) {
        bail!("E_I18N {path}.en: English text cannot be empty");
    }
    Ok(())
}

fn validate_id(value: &str, path: &str) -> Result<()> {
    if value.is_empty()
        || value.len() > 128
        || !value.chars().all(|character| {
            character.is_ascii_lowercase()
                || character.is_ascii_digit()
                || character == '-'
                || character == ':'
        })
        || value.starts_with(['-', ':'])
        || value.ends_with(['-', ':'])
    {
        bail!("E_ID {path}: expected a stable lowercase id");
    }
    Ok(())
}

fn require_text(value: &str, path: &str) -> Result<()> {
    if value.trim().is_empty() {
        bail!("E_REQUIRED {path}: value is required");
    }
    Ok(())
}

fn validate_http_url(value: &str, path: &str) -> Result<()> {
    let parsed = Url::parse(value).with_context(|| format!("E_URL {path}: invalid URL"))?;
    if !matches!(parsed.scheme(), "http" | "https") || parsed.host().is_none() {
        bail!("E_URL {path}: only http(s) URLs with a host are allowed");
    }
    Ok(())
}

fn require_evidence(id: &str, evidence_ids: &[&str], path: &str) -> Result<()> {
    if !evidence_ids.contains(&id) {
        bail!("E_REFERENCE {path}: unknown evidence {id}");
    }
    Ok(())
}

fn validate_evidence_refs(ids: &[String], evidence_ids: &[&str], path: &str) -> Result<()> {
    unique_ids(ids.iter().map(String::as_str), path)?;
    for id in ids {
        require_evidence(id, evidence_ids, path)?;
    }
    Ok(())
}

fn unique_ids<'a, I>(values: I, path: &str) -> Result<Vec<&'a str>>
where
    I: IntoIterator<Item = &'a str>,
{
    let mut result = Vec::new();
    for value in values {
        if result.contains(&value) {
            bail!("E_DUPLICATE {path}: duplicate id {value}");
        }
        result.push(value);
    }
    Ok(result)
}

fn default_true() -> bool {
    true
}

#[cfg(test)]
mod tests {
    use super::*;

    const VALID: &str = include_str!("../testdata/site-catalog-v1.yml");

    #[test]
    fn validates_all_five_kinds_and_independent_states() {
        let catalog = SiteCatalog::from_yaml(VALID).unwrap();
        assert_eq!(catalog.items.len(), 5);
        assert_eq!(catalog.items[1].kind, ItemKind::ModelWeights);
        assert_eq!(
            catalog.items[1].affiliation.as_ref().unwrap().current_foundation.as_ref().unwrap().name,
            "Overseas Foundation"
        );
        assert_eq!(catalog.items[2].name.en, None);
        assert_eq!(catalog.items[2].origin.as_ref().unwrap().regions.len(), 2);
        assert_eq!(catalog.items[4].licenses[0].status, LicenseStatus::NotApplicable);
    }

    #[test]
    fn rejects_duplicate_ids_and_unknown_references() {
        let mut duplicate = serde_yaml::from_str::<SiteCatalog>(VALID).unwrap();
        duplicate.items[4].id = duplicate.items[0].id.clone();
        let error = duplicate.validate().unwrap_err().to_string();
        assert!(error.contains("E_DUPLICATE"));

        let mut unknown = serde_yaml::from_str::<SiteCatalog>(VALID).unwrap();
        unknown.items[0].tag_ids = vec!["missing-tag".to_string()];
        let error = unknown.validate().unwrap_err().to_string();
        assert!(error.contains("E_REFERENCE"));
    }

    #[test]
    fn rejects_license_inheritance_and_missing_primary_entries() {
        let mut code_only = serde_yaml::from_str::<SiteCatalog>(VALID).unwrap();
        code_only.items[1].licenses[0].scope = LicenseScope::SourceCode;
        let error = code_only.validate().unwrap_err().to_string();
        assert!(error.contains("E_LICENSE"));

        let mut no_primary = serde_yaml::from_str::<SiteCatalog>(VALID).unwrap();
        no_primary.items[0].entries[0].primary = false;
        let error = no_primary.validate().unwrap_err().to_string();
        assert!(error.contains("E_PRIMARY"));
    }

    #[test]
    fn validates_supplemental_license_scopes_and_all_references() {
        let mut catalog = SiteCatalog::from_yaml(VALID).unwrap();
        let mut code_entry = catalog.items[0].entries[0].clone();
        code_entry.primary = false;
        let code_license = catalog.items[0].licenses[0].clone();
        catalog.items[1].entries.push(code_entry);
        catalog.items[1].licenses.push(code_license);
        catalog.validate().unwrap();

        let mut invalid = catalog.clone();
        invalid.items[1].licenses[1].evidence_ids = vec!["missing-evidence".to_string()];
        assert!(invalid.validate().unwrap_err().to_string().contains("E_REFERENCE"));

        let mut invalid = catalog.clone();
        invalid.items[1].licenses[1].applies_to_entry = Some("weights".to_string());
        assert!(invalid.validate().unwrap_err().to_string().contains("E_LICENSE"));

        catalog.items[1].licenses[1].status = LicenseStatus::Unknown;
        catalog.items[1].licenses[1].applies_to_entry = Some("missing-entry".to_string());
        assert!(catalog.validate().unwrap_err().to_string().contains("E_REFERENCE"));
    }

    #[test]
    fn requires_license_coverage_of_primary_asset_and_version() {
        let mut catalog = SiteCatalog::from_yaml(VALID).unwrap();
        let mut other_weights = catalog.items[1].entries[0].clone();
        other_weights.id = "other-weights".to_string();
        other_weights.primary = false;
        catalog.items[1].entries.push(other_weights);
        catalog.items[1].licenses[0].applies_to_entry = Some("other-weights".to_string());
        assert!(catalog.validate().unwrap_err().to_string().contains("primary asset"));

        let mut catalog = SiteCatalog::from_yaml(VALID).unwrap();
        catalog.items[1].licenses[0].version = None;
        assert!(catalog.validate().unwrap_err().to_string().contains("version/snapshot"));
    }

    #[test]
    fn rejects_duplicate_tag_and_evidence_references() {
        let mut catalog = SiteCatalog::from_yaml(VALID).unwrap();
        catalog.items[0].tag_ids.push("compiler".to_string());
        assert!(catalog.validate().unwrap_err().to_string().contains("E_DUPLICATE"));

        let mut catalog = SiteCatalog::from_yaml(VALID).unwrap();
        catalog.items[0].licenses[0].evidence_ids.push("ev-software-license".to_string());
        assert!(catalog.validate().unwrap_err().to_string().contains("E_DUPLICATE"));

        let mut catalog = SiteCatalog::from_yaml(VALID).unwrap();
        catalog.items[0].origin.as_mut().unwrap().region_evidence[0]
            .evidence_ids
            .push("ev-software-origin".to_string());
        assert!(catalog.validate().unwrap_err().to_string().contains("E_DUPLICATE"));
    }

    #[test]
    fn checks_standard_policy_references_even_before_publication() {
        let mut catalog = SiteCatalog::from_yaml(VALID).unwrap();
        catalog.items[3].publication_status = PublicationStatus::Draft;
        catalog.items[3].standard_policy.as_mut().unwrap().evidence_ids =
            vec!["missing-evidence".to_string()];
        assert!(catalog.validate().unwrap_err().to_string().contains("E_REFERENCE"));

        let mut catalog = SiteCatalog::from_yaml(VALID).unwrap();
        catalog.items[3].publication_status = PublicationStatus::InReview;
        catalog.items[3].standard_policy.as_mut().unwrap().entry_id = Some("missing-entry".to_string());
        assert!(catalog.validate().unwrap_err().to_string().contains("E_REFERENCE"));
    }

    #[test]
    fn rejects_withdrawal_cycles_and_unpublished_replacements() {
        let mut catalog = SiteCatalog::from_yaml(VALID).unwrap();
        let withdrawal = |replacement_id: &str| WithdrawalRecord {
            reason_code: "merged".to_string(),
            public_message: "条目已合并".to_string(),
            replacement_id: Some(replacement_id.to_string()),
            effective_at: NaiveDate::from_ymd_opt(2026, 10, 15).unwrap(),
        };
        catalog.items[0].publication_status = PublicationStatus::Withdrawn;
        catalog.items[0].withdrawal = Some(withdrawal("example-model"));
        catalog.validate().unwrap();

        catalog.items[1].publication_status = PublicationStatus::Draft;
        assert!(catalog.validate().unwrap_err().to_string().contains("unpublished"));

        catalog.items[1].publication_status = PublicationStatus::Withdrawn;
        catalog.items[1].withdrawal = Some(withdrawal("example-software"));
        assert!(catalog.validate().unwrap_err().to_string().contains("cycle"));
    }

    #[test]
    fn rejects_logo_paths_outside_the_asset_directory() {
        let mut catalog = SiteCatalog::from_yaml(VALID).unwrap();
        catalog.items[0].logo = Some(LogoRecord {
            path: "projects/compiler.svg".to_string(),
            source_url: "https://example.org/software/brand".to_string(),
            alt: "示例编译器".to_string(),
        });
        catalog.validate().unwrap();
        for path in [
            "../secret.svg",
            "/tmp/logo.svg",
            "projects/../secret.svg",
            "projects\\secret.svg",
            "https://example.org/logo.svg",
            "%2e%2e/secret.svg",
            "projects/logo.svg?version=1",
            "projects/logo.svg#fragment",
            "C:/logo.svg",
            "projects//logo.svg",
        ] {
            catalog.items[0].logo.as_mut().unwrap().path = path.to_string();
            assert!(
                catalog.validate().unwrap_err().to_string().contains("E_LOGO_PATH"),
                "{path}"
            );
        }
    }

    #[test]
    fn rejects_private_evidence_and_missing_chinese_text() {
        let mut private = serde_yaml::from_str::<SiteCatalog>(VALID).unwrap();
        private.evidence[0].public = false;
        let error = private.validate().unwrap_err().to_string();
        assert!(error.contains("E_PRIVATE_EVIDENCE"));

        let mut missing = serde_yaml::from_str::<SiteCatalog>(VALID).unwrap();
        missing.items[0].name.zh_cn.clear();
        let error = missing.validate().unwrap_err().to_string();
        assert!(error.contains("E_REQUIRED"));
    }

    #[test]
    fn resolves_english_fallback_and_excludes_non_public_states() {
        let mut catalog = SiteCatalog::from_yaml(VALID).unwrap();
        assert_eq!(catalog.items[2].name.text("en"), "示例数据集");
        catalog.items[0].publication_status = PublicationStatus::Draft;
        assert_eq!(catalog.public_items().count(), 4);
    }
}

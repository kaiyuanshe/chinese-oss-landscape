import type { SiteEvidence, SiteItemMetadata, SiteLicense, SiteOrigin } from 'common';

import { LocalizedItemContent, LocalizedText } from '../types';

export interface SitePlacement {
  category_id: string;
  subcategory_id: string;
  primary: boolean;
  engine_id?: string;
}

interface SiteOriginRecord {
  regions: string[];
  statement: string;
  evidence_ids: string[];
  checked_at: string;
}

interface SiteItem {
  id: string;
  kind?: SiteItemMetadata['kind'];
  canonical_name?: string;
  aliases?: string[];
  name: LocalizedText;
  description?: LocalizedText;
  placements?: SitePlacement[];
  tag_ids?: string[];
  entries?: SiteItemMetadata['entries'];
  licenses?: Array<SiteLicense & { evidence_ids?: string[] }>;
  origin?: SiteOriginRecord;
  affiliation?: SiteItemMetadata['affiliation'];
  publication_status?: SiteItemMetadata['publication_status'];
  project_status?: SiteItemMetadata['project_status'];
  status_evidence_ids?: string[];
  status_checked_at?: string;
  standard_policy?: {
    status: 'public' | 'restricted' | 'unknown' | 'not_applicable';
    evidence_ids?: string[];
    entry_id?: string;
  };
}

interface SiteTaxonomyEntry {
  id: string;
  name: LocalizedText;
  subcategories: Array<{ id: string; name: LocalizedText }>;
}

interface SiteWithdrawal {
  legacy_id: string;
  reason_code: string;
  public_message: string;
  replacement_id?: string;
  effective_at: string;
}

export interface SiteCatalogData {
  id_map?: {
    engine_to_stable?: Record<string, string>;
    legacy_to_stable?: Record<string, string>;
  };
  taxonomy?: {
    categories?: SiteTaxonomyEntry[];
    tags?: Array<{ id: string; name: LocalizedText }>;
  };
  items?: SiteItem[];
  evidence?: SiteEvidence[];
  withdrawals?: SiteWithdrawal[];
}

export interface SiteLocalization {
  items: Record<string, LocalizedItemContent>;
  metadata: Record<string, SiteItemMetadata>;
  categories: Record<string, LocalizedText>;
  subcategories: Record<string, LocalizedText>;
  tags: Record<string, LocalizedText>;
  legacyCategories: Record<string, LocalizedText>;
  legacySubcategories: Record<string, LocalizedText>;
  legacyToStable: Record<string, string>;
  withdrawals: Record<string, SiteWithdrawal>;
}

const emptyLocalization = (): SiteLocalization => ({
  items: {},
  metadata: {},
  categories: {},
  subcategories: {},
  tags: {},
  legacyCategories: {},
  legacySubcategories: {},
  legacyToStable: {},
  withdrawals: {},
});

const evidenceFor = (ids: string[] | undefined, evidenceById: Map<string, SiteEvidence>): SiteEvidence[] =>
  (ids || []).map((id) => evidenceById.get(id)).filter((evidence): evidence is SiteEvidence => Boolean(evidence));

const toMetadata = (item: SiteItem, evidenceById: Map<string, SiteEvidence>): SiteItemMetadata => {
  const metadata: SiteItemMetadata = {
    id: item.id,
    kind: item.kind || 'software',
    canonical_name: item.canonical_name || item.name['zh-CN'],
    aliases: item.aliases || [],
    name: item.name,
    description: item.description,
    tag_ids: item.tag_ids || [],
    entries: item.entries || [],
    licenses: item.licenses || [],
    affiliation: item.affiliation,
    publication_status: item.publication_status || 'published',
    project_status: item.project_status || 'unknown',
    status_checked_at: item.status_checked_at,
    status_evidence: evidenceFor(item.status_evidence_ids, evidenceById),
  };

  if (item.origin) {
    const origin: SiteOrigin = {
      regions: item.origin.regions,
      statement: item.origin.statement,
      checked_at: item.origin.checked_at,
      evidence: evidenceFor(item.origin.evidence_ids, evidenceById),
    };
    metadata.origin = origin;
  }

  if (item.standard_policy) {
    metadata.standard_policy = {
      status: item.standard_policy.status,
      evidence: evidenceFor(item.standard_policy.evidence_ids, evidenceById),
    };
  }

  return metadata;
};

export const buildSiteLocalization = (catalog?: SiteCatalogData): SiteLocalization => {
  if (!catalog) return emptyLocalization();

  const localization = emptyLocalization();
  const categoriesById = new Map<string, SiteTaxonomyEntry>();
  const evidenceById = new Map((catalog.evidence || []).map((evidence) => [evidence.id, evidence]));

  for (const category of catalog.taxonomy?.categories || []) {
    categoriesById.set(category.id, category);
    localization.categories[category.id] = category.name;
    for (const subcategory of category.subcategories || []) {
      localization.subcategories[`${category.id}:${subcategory.id}`] = subcategory.name;
    }
  }

  for (const tag of catalog.taxonomy?.tags || []) {
    localization.tags[tag.id] = tag.name;
  }

  localization.legacyToStable = {
    ...(catalog.id_map?.legacy_to_stable || {}),
    ...(catalog.id_map?.engine_to_stable || {}),
  };
  for (const withdrawal of catalog.withdrawals || []) {
    localization.withdrawals[withdrawal.legacy_id] = withdrawal;
  }

  const engineToStable = catalog.id_map?.engine_to_stable || {};
  for (const item of catalog.items || []) {
    const primaryPlacement = (item.placements || []).find((placement) => placement.primary) || item.placements?.[0];
    const category = primaryPlacement ? categoriesById.get(primaryPlacement.category_id) : undefined;
    const subcategory = category?.subcategories.find((entry) => entry.id === primaryPlacement?.subcategory_id);
    const localized: LocalizedItemContent = {
      name: item.name,
      description: item.description,
      category: category?.name,
      subcategory: subcategory?.name,
    };
    localization.items[item.id] = localized;
    localization.metadata[item.id] = toMetadata(item, evidenceById);

    for (const placement of item.placements || []) {
      if (!placement.engine_id) continue;
      const stableId = engineToStable[placement.engine_id] || item.id;
      if (!localization.items[stableId]) localization.items[stableId] = localized;
      if (!localization.metadata[stableId]) localization.metadata[stableId] = localization.metadata[item.id];
    }
  }

  return localization;
};

const getStableId = (
  localization: SiteLocalization,
  item: { id: string; annotations?: Record<string, string> }
): string => {
  const annotatedId = item.annotations?.['site-id'] || item.id;
  return localization.legacyToStable[annotatedId] || annotatedId;
};

export const getLocalizedItemContent = (
  localization: SiteLocalization,
  item: { id: string; annotations?: Record<string, string> }
): LocalizedItemContent | undefined => localization.items[getStableId(localization, item)];

export const getSiteItemMetadata = (
  localization: SiteLocalization,
  item: { id: string; annotations?: Record<string, string> }
): SiteItemMetadata | undefined => localization.metadata[getStableId(localization, item)];

export const getSiteStableId = getStableId;

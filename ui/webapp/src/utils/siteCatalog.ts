import { LocalizedItemContent, LocalizedText } from '../types';

interface SitePlacement {
  category_id: string;
  subcategory_id: string;
  primary: boolean;
  engine_id?: string;
}

interface SiteItem {
  id: string;
  name: LocalizedText;
  description?: LocalizedText;
  placements?: SitePlacement[];
}

interface SiteTaxonomyEntry {
  id: string;
  name: LocalizedText;
  subcategories: Array<{ id: string; name: LocalizedText }>;
}

export interface SiteCatalogData {
  id_map?: {
    engine_to_stable?: Record<string, string>;
  };
  taxonomy?: {
    categories?: SiteTaxonomyEntry[];
  };
  items?: SiteItem[];
}

export interface SiteLocalization {
  items: Record<string, LocalizedItemContent>;
  categories: Record<string, LocalizedText>;
  subcategories: Record<string, LocalizedText>;
  legacyCategories: Record<string, LocalizedText>;
  legacySubcategories: Record<string, LocalizedText>;
}

const emptyLocalization = (): SiteLocalization => ({
  items: {},
  categories: {},
  subcategories: {},
  legacyCategories: {},
  legacySubcategories: {},
});

export const buildSiteLocalization = (catalog?: SiteCatalogData): SiteLocalization => {
  if (!catalog) return emptyLocalization();

  const localization = emptyLocalization();
  const categoriesById = new Map<string, SiteTaxonomyEntry>();

  for (const category of catalog.taxonomy?.categories || []) {
    categoriesById.set(category.id, category);
    localization.categories[category.id] = category.name;
    for (const subcategory of category.subcategories || []) {
      localization.subcategories[`${category.id}:${subcategory.id}`] = subcategory.name;
    }
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

    for (const placement of item.placements || []) {
      if (!placement.engine_id) continue;
      const stableId = engineToStable[placement.engine_id] || item.id;
      if (!localization.items[stableId]) localization.items[stableId] = localized;
    }
  }

  return localization;
};

export const getLocalizedItemContent = (
  localization: SiteLocalization,
  item: { id: string; annotations?: Record<string, string> }
): LocalizedItemContent | undefined => {
  const stableId = item.annotations?.['site-id'] || item.id;
  return localization.items[stableId];
};

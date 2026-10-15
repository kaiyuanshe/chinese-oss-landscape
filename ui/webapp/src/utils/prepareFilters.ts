import type { SiteItemKind, SiteProjectStatus } from 'common';
import { capitalizeFirstLetter, formatTAGName } from 'common';
import isUndefined from 'lodash/isUndefined';

import { FilterCategory, FilterSection, Item, Repository } from '../types';
import checkIfCategoryInGroup from './checkIfCategoryInGroup';
import itemsDataGetter from './itemsDataGetter';

const cleanValue = (t: string): string => {
  // return encodeURIComponent(t);
  return t;
};

const KIND_LABELS: Record<SiteItemKind, { 'zh-CN': string; en: string }> = {
  software: { 'zh-CN': '软件', en: 'Software' },
  model_weights: { 'zh-CN': '模型权重', en: 'Model weights' },
  dataset: { 'zh-CN': '数据集', en: 'Dataset' },
  open_standard: { 'zh-CN': '开放标准', en: 'Open standard' },
  community: { 'zh-CN': '社区 / 组织', en: 'Community / organization' },
};

const STATUS_LABELS: Record<SiteProjectStatus, { 'zh-CN': string; en: string }> = {
  active: { 'zh-CN': '活跃', en: 'Active' },
  archived: { 'zh-CN': '已归档', en: 'Archived' },
  unknown: { 'zh-CN': '未知', en: 'Unknown' },
};

const subcategoryValue = (category: string, subcategory: string): string => `${category}::${subcategory}`;
const splitSubcategoryValue = (value: string): [string, string] | undefined => {
  const separator = value.indexOf('::');
  return separator < 0 ? undefined : [value.slice(0, separator), value.slice(separator + 2)];
};

export interface FiltersPerGroup {
  [key: string]: PreparedFilters;
}

export interface FiltersOptions {
  itemsWithoutMaturity: boolean;
  itemsWithoutLicense: boolean;
}

interface PreparedFilters {
  filters: FilterSection[];
  options: FiltersOptions;
}

const getFiltersPerGroup = () => {
  const groups: FiltersPerGroup = {};

  const groupedItems = itemsDataGetter.getGroupedData();
  Object.keys(groupedItems).forEach((group: string) => {
    groups[group] = { ...prepareFilters(groupedItems[group], group) };
  });

  return groups;
};

const prepareFilters = (items: Item[], group: string): PreparedFilters => {
  const filters: FilterSection[] = [];

  const maturityTypes: string[] = [];
  const kinds: SiteItemKind[] = [];
  const projectStatuses: SiteProjectStatus[] = [];
  const tags: string[] = [];
  const organizations: string[] = [];
  const licenses: string[] = [];
  const countries: string[] = [];
  const companyTypes: string[] = [];
  const extraTypes: string[] = [];
  const categories: string[] = [];
  const subcategories: string[] = [];
  let industry: string[] = [];
  let itemsWithoutMaturity: boolean = false;
  let nonOss: boolean = false;

  items.forEach((i: Item) => {
    if (i.site?.kind) kinds.push(i.site.kind);
    if (i.site?.project_status) projectStatuses.push(i.site.project_status);
    if (i.maturity) {
      maturityTypes.push(i.maturity);
    } else {
      itemsWithoutMaturity = true;
    }

    if (i.tag) {
      i.tag.forEach((t) => {
        tags.push(t);
      });
    }

    if (i.specification) {
      extraTypes.push('specification');
    }

    if (i.enduser) {
      extraTypes.push('enduser');
    }

    if (i.category && checkIfCategoryInGroup(i.category, group)) {
      categories.push(i.category);
      subcategories.push(subcategoryValue(i.category, i.subcategory));
    }

    if (i.additional_categories) {
      i.additional_categories.forEach((ac) => {
        if (checkIfCategoryInGroup(ac.category, group)) {
          categories.push(ac.category);
          subcategories.push(subcategoryValue(ac.category, ac.subcategory));
        }
      });
    }

    if (i.crunchbase_data) {
      if (i.crunchbase_data.name) {
        organizations.push(i.crunchbase_data.name);
      }

      if (i.crunchbase_data.country) {
        countries.push(i.crunchbase_data.country);
      }

      if (i.crunchbase_data.categories) {
        industry = [...industry, ...i.crunchbase_data.categories];
      }

      if (i.crunchbase_data.company_type) {
        companyTypes.push(i.crunchbase_data.company_type);
      }
    }

    if (i.site?.licenses?.length) {
      i.site.licenses.forEach((license) => {
        licenses.push(license.identifier || 'not-applicable');
      });
    } else if (i.repositories) {
      i.repositories.forEach((r: Repository) => {
        if (r.license) {
          licenses.push(r.license);
        } else if (r.github_data && r.github_data.license) {
          licenses.push(r.github_data.license);
        }
      });
    }

    if (isUndefined(i.oss)) {
      nonOss = true;
    }
  });

  if (kinds.length > 0) {
    filters.push({
      value: FilterCategory.Kind,
      title: 'Object type',
      localizedTitle: { 'zh-CN': '对象类型', en: 'Object type' },
      options: [...new Set(kinds)].sort().map((kind) => ({
        value: kind,
        name: KIND_LABELS[kind].en,
        localizedName: KIND_LABELS[kind],
      })),
    });
  }

  if (projectStatuses.length > 0) {
    filters.push({
      value: FilterCategory.ProjectStatus,
      title: 'Maintenance status',
      localizedTitle: { 'zh-CN': '维护状态', en: 'Maintenance status' },
      options: [...new Set(projectStatuses)].sort().map((status) => ({
        value: status,
        name: STATUS_LABELS[status].en,
        localizedName: STATUS_LABELS[status],
      })),
    });
  }

  if (maturityTypes.length > 0) {
    filters.push({
      value: FilterCategory.Maturity,
      title: 'Project',
      options: [...new Set(maturityTypes)].sort().map((pr: string) => ({
        value: cleanValue(pr),
        name: capitalizeFirstLetter(pr),
      })),
    });
  }

  if (tags.length > 0) {
    filters.push({
      value: FilterCategory.TAG,
      title: 'TAG',
      options: [...new Set(tags)].sort().map((tag: string) => ({
        value: tag,
        name: formatTAGName(tag),
        localizedName: itemsDataGetter.getSiteLocalization().tags[tag],
      })),
    });
  }

  if (organizations.length > 0) {
    filters.push({
      value: FilterCategory.Organization,
      title: 'Organization',
      options: [...new Set(organizations)].sort().map((org: string) => ({
        value: cleanValue(org),
        name: org,
      })),
    });
  }

  if (categories.length > 0) {
    const cleanCategories = [...new Set(categories)].sort();

    // Add categories filter only if there are more than one category
    if (cleanCategories.length > 1) {
      filters.push({
        value: FilterCategory.Category,
        title: 'Category',
        options: [...new Set(categories)].sort().map((cat: string) => ({
          value: cleanValue(cat),
          name: cat,
          localizedName: itemsDataGetter.getSiteLocalization().legacyCategories[cat],
        })),
      });
    }
  }

  if (subcategories.length > 0) {
    filters.push({
      value: FilterCategory.Subcategory,
      title: 'Subcategory',
      localizedTitle: { 'zh-CN': '子分类', en: 'Subcategory' },
      options: [...new Set(subcategories)].sort().map((value) => {
        const parts = splitSubcategoryValue(value);
        const category = parts?.[0] || '';
        const subcategory = parts?.[1] || value;
        return {
          value,
          name: subcategory,
          localizedName: itemsDataGetter.getSiteLocalization().legacySubcategories[`${category}:${subcategory}`],
        };
      }),
    });
  }

  if (licenses.length > 0) {
    filters.push({
      value: FilterCategory.License,
      title: 'License',
      options: [...new Set(licenses)].sort().map((license: string) => ({
        value: cleanValue(license),
        name: license,
        localizedName: license === 'not-applicable' ? { 'zh-CN': '不适用', en: 'Not applicable' } : undefined,
      })),
    });
  }

  if (countries.length > 0) {
    filters.push({
      value: FilterCategory.Country,
      title: 'Country',
      options: [...new Set(countries)].sort().map((country: string) => ({
        value: cleanValue(country),
        name: country,
      })),
    });
  }

  if (industry.length > 0) {
    filters.push({
      value: FilterCategory.Industry,
      title: 'Industry',
      options: [...new Set(industry)].sort().map((i: string) => ({
        value: cleanValue(i),
        name: i,
      })),
    });

    if (companyTypes.length > 0) {
      filters.push({
        value: FilterCategory.OrgType,
        title: 'Organization type',
        options: [...new Set(companyTypes)].sort().map((ot: string) => ({
          value: cleanValue(ot),
          name: ot,
        })),
      });
    }

    if (extraTypes.length > 0) {
      const options = [];
      if (extraTypes.includes('enduser')) {
        options.push({
          value: 'enduser',
          name: 'End user',
        });
      }
      if (extraTypes.includes('specification')) {
        options.push({
          value: 'specification',
          name: 'Specification',
        });
      }
      filters.push({
        value: FilterCategory.Extra,
        title: 'Extra',
        options: options,
      });
    }
  }

  return { filters: filters, options: { itemsWithoutMaturity: itemsWithoutMaturity, itemsWithoutLicense: nonOss } };
};

export default getFiltersPerGroup;

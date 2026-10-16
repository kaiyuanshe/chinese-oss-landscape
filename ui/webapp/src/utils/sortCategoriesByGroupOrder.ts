import intersection from 'lodash/intersection';

import type { Group } from '../types';

const ALL_GROUP = 'all';

/**
 * Use taxonomy order for all categories and a group's configured order otherwise.
 */
const sortCategoriesByGroupOrder = (categories: string[], group: string): string[] => {
  const configuredCategories =
    group === ALL_GROUP
      ? window.baseDS.categories.map((category) => category.name)
      : window.baseDS.groups?.find((item: Group) => item.normalized_name === group)?.categories;
  if (!configuredCategories) {
    return categories;
  }

  const orderedCategories = intersection(configuredCategories, categories);
  const remainingCategories = categories.filter((category: string) => !orderedCategories.includes(category));

  return [...orderedCategories, ...remainingCategories];
};

export default sortCategoriesByGroupOrder;

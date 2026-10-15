import isUndefined from 'lodash/isUndefined';

import { Locale, resolveLocalizedText } from '../i18n';
import { Item, Repository } from '../types/types';
import { cleanEmojis } from './cleanEmojis';

// Get item's description
export const getItemDescription = (item?: Item | null, locale: Locale = 'zh-CN'): string => {
  if (item) {
    const localizedDescription = resolveLocalizedText(item.localized?.description, locale);
    if (localizedDescription) return localizedDescription;
    if (item.description && item.description !== '') {
      return item.description;
    } else if (item.repositories) {
      const primaryRepo = item.repositories.find((repo: Repository) => repo.primary);
      if (
        primaryRepo &&
        primaryRepo.github_data &&
        primaryRepo.github_data.description &&
        primaryRepo.github_data.description !== ''
      ) {
        return cleanEmojis(primaryRepo.github_data.description);
      }
    } else if (
      isUndefined(item.maturity) &&
      item.crunchbase_data &&
      item.crunchbase_data.description &&
      item.crunchbase_data.description !== ''
    ) {
      return cleanEmojis(item.crunchbase_data.description);
    }
  }

  return locale === 'en' ? 'This item does not have a description available yet' : '暂无项目简介';
};

export const getItemName = (item: Item, locale: Locale = 'zh-CN'): string => {
  return resolveLocalizedText(item.localized?.name, locale) || item.name;
};

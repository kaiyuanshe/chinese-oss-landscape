import type { Locale } from 'common';

const LANGUAGE_PARAM = 'lang';

export const parseLocale = (value: string | null | undefined): Locale | undefined => {
  if (value === 'en' || value === 'zh-CN') return value;
  return undefined;
};

export const getInitialLocale = (search: string, storedLocale?: string | null): Locale => {
  const urlLocale = parseLocale(new URLSearchParams(search).get(LANGUAGE_PARAM));
  return urlLocale || parseLocale(storedLocale) || 'zh-CN';
};

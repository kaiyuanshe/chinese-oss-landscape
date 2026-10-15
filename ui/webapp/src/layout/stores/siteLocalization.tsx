import { resolveLocalizedText } from 'common';
import { createContext, ParentComponent, useContext } from 'solid-js';

import itemsDataGetter from '../../utils/itemsDataGetter';
import { useFullDataReady } from './fullData';
import { useLocale } from './locale';

interface SiteLocalizationContextValue {
  categoryName: (name: string) => string;
  subcategoryName: (category: string, subcategory: string) => string;
  tagName: (tag: string) => string;
}

const SiteLocalizationContext = createContext<SiteLocalizationContextValue>({
  categoryName: (name) => name,
  subcategoryName: (_category, subcategory) => subcategory,
  tagName: (tag) => tag,
});

export const SiteLocalizationProvider: ParentComponent = (props) => {
  const { locale } = useLocale();
  const fullDataReady = useFullDataReady();

  const categoryName = (name: string) => {
    fullDataReady();
    const value = itemsDataGetter.getSiteLocalization().legacyCategories[name];
    return resolveLocalizedText(value, locale()) || name;
  };

  const subcategoryName = (category: string, subcategory: string) => {
    fullDataReady();
    const value = itemsDataGetter.getSiteLocalization().legacySubcategories[`${category}:${subcategory}`];
    return resolveLocalizedText(value, locale()) || subcategory;
  };

  const tagName = (tag: string) => {
    fullDataReady();
    const value = itemsDataGetter.getSiteLocalization().tags[tag];
    return resolveLocalizedText(value, locale()) || tag;
  };

  return (
    <SiteLocalizationContext.Provider value={{ categoryName, subcategoryName, tagName }}>
      {props.children}
    </SiteLocalizationContext.Provider>
  );
};

export const useSiteLocalization = (): SiteLocalizationContextValue => useContext(SiteLocalizationContext);

import { resolveLocalizedText } from 'common';
import { createContext, ParentComponent, useContext } from 'solid-js';

import itemsDataGetter from '../../utils/itemsDataGetter';
import { useFullDataReady } from './fullData';
import { useLocale } from './locale';

interface SiteLocalizationContextValue {
  categoryName: (name: string) => string;
  subcategoryName: (category: string, subcategory: string) => string;
}

const SiteLocalizationContext = createContext<SiteLocalizationContextValue>({
  categoryName: (name) => name,
  subcategoryName: (_category, subcategory) => subcategory,
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

  return (
    <SiteLocalizationContext.Provider value={{ categoryName, subcategoryName }}>
      {props.children}
    </SiteLocalizationContext.Provider>
  );
};

export const useSiteLocalization = (): SiteLocalizationContextValue => useContext(SiteLocalizationContext);

import { useLocation, useNavigate } from '@solidjs/router';
import { I18nProvider, Locale } from 'common';
import { createContext, createEffect, createMemo, createSignal, onMount, ParentComponent, useContext } from 'solid-js';

import brand from '../../../../../site/brand.json';
import { LANGUAGE_PARAM } from '../../data';
import { getInitialLocale, parseLocale } from '../../utils/localeUtils';

const LOCALE_STORAGE_KEY = 'chinese-oss-landscape.locale';

const readStoredLocale = (): Locale | undefined => {
  try {
    return parseLocale(window.localStorage.getItem(LOCALE_STORAGE_KEY));
  } catch {
    return undefined;
  }
};

const writeStoredLocale = (locale: Locale): void => {
  try {
    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
  } catch {
    // Private browsing and blocked storage should not disable URL-based switching.
  }
};

const updateMeta = (selector: string, content: string): void => {
  const element = document.querySelector<HTMLMetaElement>(selector);
  if (element) element.content = content;
};

interface LocaleContextValue {
  locale: () => Locale;
  setLocale: (locale: Locale) => void;
}

const LocaleContext = createContext<LocaleContextValue>();

const useLocaleProvider = (): LocaleContextValue => {
  const location = useLocation();
  const navigate = useNavigate();
  const [storedLocale, setStoredLocale] = createSignal<Locale | undefined>(readStoredLocale());
  const locale = createMemo(() => getInitialLocale(location.search, storedLocale()));

  const setLocale = (nextLocale: Locale) => {
    setStoredLocale(nextLocale);
    writeStoredLocale(nextLocale);
    const params = new URLSearchParams(location.search);
    params.set(LANGUAGE_PARAM, nextLocale);
    const search = params.toString();
    navigate(`${location.pathname}${search ? `?${search}` : ''}${location.hash}`, {
      replace: true,
      scroll: false,
    });
  };

  createEffect(() => {
    const rawLocale = new URLSearchParams(location.search).get(LANGUAGE_PARAM);
    if (rawLocale !== null && !parseLocale(rawLocale)) {
      const params = new URLSearchParams(location.search);
      params.delete(LANGUAGE_PARAM);
      const search = params.toString();
      navigate(`${location.pathname}${search ? `?${search}` : ''}${location.hash}`, {
        replace: true,
        scroll: false,
      });
      return;
    }

    const currentLocale = locale();
    document.documentElement.lang = currentLocale;
    document.title = brand.title[currentLocale];
    updateMeta('meta[name="description"]', brand.description[currentLocale]);
    updateMeta('meta[property="og:locale"]', currentLocale === 'en' ? 'en_US' : 'zh_CN');
    updateMeta('meta[property="og:title"]', brand.title[currentLocale]);
    updateMeta('meta[property="og:description"]', brand.description[currentLocale]);
    updateMeta('meta[name="twitter:title"]', brand.title[currentLocale]);
    updateMeta('meta[name="twitter:description"]', brand.description[currentLocale]);
  });

  onMount(() => {
    document.documentElement.lang = locale();
  });

  return { locale, setLocale };
};

export const LocaleProvider: ParentComponent = (props) => {
  const value = useLocaleProvider();
  return (
    <LocaleContext.Provider value={value}>
      <I18nProvider locale={value.locale}>{props.children}</I18nProvider>
    </LocaleContext.Provider>
  );
};

export const useLocale = (): LocaleContextValue => {
  const context = useContext(LocaleContext);
  if (!context) throw new Error('useLocale must be used within a LocaleProvider');
  return context;
};

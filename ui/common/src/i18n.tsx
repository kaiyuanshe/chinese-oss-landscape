import { Accessor, createContext, ParentComponent, useContext } from 'solid-js';

export type Locale = 'zh-CN' | 'en';

export const DEFAULT_LOCALE: Locale = 'zh-CN';

export interface LocalizedText {
  'zh-CN': string;
  en?: string;
}

export interface LocalizedItemContent {
  name: LocalizedText;
  description?: LocalizedText;
  category?: LocalizedText;
  subcategory?: LocalizedText;
}

const translations: Record<Locale, Record<string, string>> = {
  'zh-CN': {
    'language.switchToEnglish': 'English',
    'language.switchToChinese': '中文',
    'navigation.explore': '探索',
    'navigation.github': '源码仓库',
    'navigation.menu': '打开菜单',
    'navigation.backToHome': '返回中国开源地图',
    'search.placeholder': '搜索项目',
    'search.keyboardHint': '输入 / 搜索项目',
    'search.clear': '清除搜索内容',
    'search.noResults': '没有找到匹配的项目。',
    'search.openItem': '打开项目信息',
    'filters.title': '筛选',
    'filters.applied': '已应用筛选条件',
    'filters.reset': '重置全部',
    'filters.remove': '移除筛选条件',
    'error.loadData': '无法加载地图数据。',
    'error.tryAgain': '重试',
    'error.pageNotFound': '错误 404 - 页面不存在',
    'error.pageNotFoundDetails': '你访问的页面不存在',
    'error.backHome': '返回首页',
    'item.category': '分类',
    'item.subcategory': '子分类',
    'item.endUser': '终端用户',
    'item.additionalCategories': '其他分类',
    'item.additionalTags': '其他标签',
    'item.repositories': '代码仓库',
    'item.primary': '主要',
    'item.securityAudits': '安全审计',
    'item.organization': '组织',
    'item.date': '日期',
    'item.type': '类型',
    'item.vendor': '供应商',
    'item.website': '网站',
    'item.repository': '代码仓库',
    'repository.stars': 'Stars',
    'repository.contributors': '贡献者',
    'repository.firstCommit': '首次提交',
    'repository.latestCommit': '最近提交',
    'repository.latestRelease': '最近发布',
    'repository.participation': '参与度统计',
    'repository.languages': '编程语言',
    'footer.poweredBy': '由',
  },
  en: {
    'language.switchToEnglish': 'English',
    'language.switchToChinese': '中文',
    'navigation.explore': 'Explore',
    'navigation.github': 'Source repository',
    'navigation.menu': 'Open menu',
    'navigation.backToHome': 'Back to Chinese Open Source Landscape',
    'search.placeholder': 'Search items',
    'search.keyboardHint': 'Type / to search items',
    'search.clear': 'Clear search',
    'search.noResults': "We couldn't find any matching items.",
    'search.openItem': 'Open item information',
    'filters.title': 'Filters',
    'filters.applied': 'Filters applied',
    'filters.reset': 'reset all',
    'filters.remove': 'Remove filter',
    'error.loadData': "We couldn't load the landscape data.",
    'error.tryAgain': 'Try again',
    'error.pageNotFound': 'Error 404 - Page Not Found',
    'error.pageNotFoundDetails': "The page you were looking for wasn't found",
    'error.backHome': 'Back Home',
    'item.category': 'Category',
    'item.subcategory': 'Subcategory',
    'item.endUser': 'End user',
    'item.additionalCategories': 'Additional categories',
    'item.additionalTags': 'Additional tags',
    'item.repositories': 'Repositories',
    'item.primary': 'Primary',
    'item.securityAudits': 'Security audits',
    'item.organization': 'Organization',
    'item.date': 'Date',
    'item.type': 'Type',
    'item.vendor': 'Vendor',
    'item.website': 'Website',
    'item.repository': 'Repository',
    'repository.stars': 'Stars',
    'repository.contributors': 'Contributors',
    'repository.firstCommit': 'First commit',
    'repository.latestCommit': 'Latest commit',
    'repository.latestRelease': 'Latest release',
    'repository.participation': 'Participation stats',
    'repository.languages': 'Languages',
    'footer.poweredBy': 'Powered by',
  },
};

export const resolveLocalizedText = (value: LocalizedText | undefined, locale: Locale): string | undefined => {
  if (!value) return undefined;
  if (locale === 'en' && value.en && value.en.trim() !== '') return value.en;
  return value['zh-CN'];
};

interface I18nContextValue {
  locale: Accessor<Locale>;
  t: (key: string) => string;
  text: (value: LocalizedText | undefined) => string | undefined;
}

const defaultValue: I18nContextValue = {
  locale: () => DEFAULT_LOCALE,
  t: (key) => translations[DEFAULT_LOCALE][key] || key,
  text: (value) => resolveLocalizedText(value, DEFAULT_LOCALE),
};

const I18nContext = createContext<I18nContextValue>(defaultValue);

interface Props {
  locale?: Locale;
}

export const I18nProvider: ParentComponent<Props> = (props) => {
  const locale = () => props.locale || DEFAULT_LOCALE;
  const t = (key: string) => translations[locale()][key] || translations[DEFAULT_LOCALE][key] || key;
  const text = (value: LocalizedText | undefined) => resolveLocalizedText(value, locale());

  return <I18nContext.Provider value={{ locale, t, text }}>{props.children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => useContext(I18nContext);

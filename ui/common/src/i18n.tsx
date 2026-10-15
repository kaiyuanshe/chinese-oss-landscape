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
    'results.items': '个条目',
    'filters.title': '筛选',
    'filters.applied': '已应用筛选条件',
    'filters.reset': '重置全部',
    'filters.remove': '移除筛选条件',
    'filters.kind': '对象类型',
    'filters.subcategory': '子分类',
    'filters.projectStatus': '维护状态',
    'filters.category': '分类',
    'filters.license': '许可证',
    'filters.tag': '标签',
    'filters.apply': '应用筛选',
    'filters.noAvailable': '当前数据没有可用筛选条件。',
    'filters.resetOne': '重置',
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
    'item.kind': '对象类型',
    'item.projectStatus': '维护状态',
    'item.publicationStatus': '发布状态',
    'item.needsReview': '待复核',
    'item.origin': '历史起源',
    'item.affiliation': '当前归属',
    'item.license': '适用许可证',
    'item.licenseStatus': '许可证状态',
    'item.standardPolicy': '标准实施与专利政策',
    'item.standardPolicyStatus': '政策状态',
    'item.sources': '官方入口',
    'item.evidence': '公开依据',
    'item.checkedAt': '核验日期',
    'item.maintainer': '当前维护者',
    'item.foundation': '当前基金会',
    'item.notApplicable': '不适用',
    'item.nonOpenSource': '非开源',
    'item.public': '公开',
    'item.login': '需登录',
    'item.approval': '需申请',
    'item.contract': '需签约',
    'item.kind.software': '软件',
    'item.kind.model_weights': '模型权重',
    'item.kind.dataset': '数据集',
    'item.kind.open_standard': '开放标准',
    'item.kind.community': '社区 / 组织',
    'item.status.active': '活跃',
    'item.status.archived': '已归档',
    'item.status.unknown': '未知',
    'item.licenseScope.source_code': '源代码',
    'item.licenseScope.model_weights': '模型权重',
    'item.licenseScope.dataset': '数据集',
    'item.licenseScope.standard_text': '标准正文',
    'item.licenseScope.standard_implementation': '标准实现',
    'item.licenseScope.organization': '组织身份',
    'item.entry.repository': '源代码仓库',
    'item.entry.weights': '权重发布',
    'item.entry.dataset': '数据发布',
    'item.entry.specification': '规范正文',
    'item.entry.official': '官方网站',
    'item.entry.documentation': '文档',
    'item.entry.community': '社区入口',
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
    'results.items': 'items',
    'filters.title': 'Filters',
    'filters.applied': 'Filters applied',
    'filters.reset': 'reset all',
    'filters.remove': 'Remove filter',
    'filters.kind': 'Object type',
    'filters.subcategory': 'Subcategory',
    'filters.projectStatus': 'Maintenance status',
    'filters.category': 'Category',
    'filters.license': 'License',
    'filters.tag': 'Tag',
    'filters.apply': 'Apply filters',
    'filters.noAvailable': 'No filters are available for the current data.',
    'filters.resetOne': 'reset',
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
    'item.kind': 'Object type',
    'item.projectStatus': 'Maintenance status',
    'item.publicationStatus': 'Publication status',
    'item.needsReview': 'Needs review',
    'item.origin': 'Historical origin',
    'item.affiliation': 'Current affiliation',
    'item.license': 'Applicable license',
    'item.licenseStatus': 'License status',
    'item.standardPolicy': 'Standard implementation and patent policy',
    'item.standardPolicyStatus': 'Policy status',
    'item.sources': 'Official entries',
    'item.evidence': 'Public evidence',
    'item.checkedAt': 'Checked',
    'item.maintainer': 'Current maintainer',
    'item.foundation': 'Current foundation',
    'item.notApplicable': 'Not applicable',
    'item.nonOpenSource': 'Non open source',
    'item.public': 'Public',
    'item.login': 'Login required',
    'item.approval': 'Approval required',
    'item.contract': 'Contract required',
    'item.kind.software': 'Software',
    'item.kind.model_weights': 'Model weights',
    'item.kind.dataset': 'Dataset',
    'item.kind.open_standard': 'Open standard',
    'item.kind.community': 'Community / organization',
    'item.status.active': 'Active',
    'item.status.archived': 'Archived',
    'item.status.unknown': 'Unknown',
    'item.licenseScope.source_code': 'Source code',
    'item.licenseScope.model_weights': 'Model weights',
    'item.licenseScope.dataset': 'Dataset',
    'item.licenseScope.standard_text': 'Standard text',
    'item.licenseScope.standard_implementation': 'Standard implementation',
    'item.licenseScope.organization': 'Organization identity',
    'item.entry.repository': 'Source repository',
    'item.entry.weights': 'Weights',
    'item.entry.dataset': 'Dataset',
    'item.entry.specification': 'Specification',
    'item.entry.official': 'Official website',
    'item.entry.documentation': 'Documentation',
    'item.entry.community': 'Community',
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
  locale?: Locale | Accessor<Locale>;
}

export const I18nProvider: ParentComponent<Props> = (props) => {
  const locale = () => (typeof props.locale === 'function' ? props.locale() : props.locale) || DEFAULT_LOCALE;
  const t = (key: string) => translations[locale()][key] || translations[DEFAULT_LOCALE][key] || key;
  const text = (value: LocalizedText | undefined) => resolveLocalizedText(value, locale());

  return <I18nContext.Provider value={{ locale, t, text }}>{props.children}</I18nContext.Provider>;
};

export const useI18n = (): I18nContextValue => useContext(I18nContext);

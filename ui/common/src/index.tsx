// Components
export { CodeBlock } from './components/CodeBlock';
export { ExternalLink } from './components/ExternalLink';
export { FoundationBadge } from './components/FoundationBadge';
export { Image } from './components/Image';
export { ItemModalContent } from './components/ItemModalContent';
export { ItemModalMobileContent } from './components/ItemModalMobileContent';
export { Loading } from './components/Loading';
export { MaturityBadge } from './components/MaturityBadge';
export { Modal } from './components/Modal';
export { NoData } from './components/NoData';
export { SiteMetadataSection } from './components/SiteMetadataSection';
export { SVGIcon } from './components/SVGIcon';

// Utils
export {
  capitalizeFirstLetter,
  cutString,
  formatProfitLabel,
  formatTAGName,
  getItemDescription,
  getItemName,
  getMainTag,
  prettifyNumber,
  sortObjectByValue,
} from './utils';

// Hooks
export { useBodyScroll, useBreakpointDetect, useModalFocus, useOutsideClick } from './hooks';

// Types
export type {
  GithubRepository,
  Item,
  Organization,
  Repository,
  SiteAffiliation,
  SiteEntry,
  SiteEvidence,
  SiteItemKind,
  SiteItemMetadata,
  SiteLicense,
  SiteOrigin,
  SiteProjectStatus,
} from './types/types';
export { SVGIconKind } from './types/types';

// Site integration
export { siteCapabilities } from './siteCapabilities';

// Internationalization
export type { Locale, LocalizedItemContent, LocalizedText } from './i18n';
export { DEFAULT_LOCALE, I18nProvider, resolveLocalizedText, useI18n } from './i18n';

import type { Accessor, JSXElement } from 'solid-js';

export { siteCapabilities } from '../../../common/src/siteCapabilities';
export { capitalizeFirstLetter } from '../../../common/src/utils/capitalizeFirstLetter';

export const useI18n = () => ({
  locale: () => 'zh-CN' as const,
  t: (key: string) =>
    ({
      'error.loadData': "We couldn't load the landscape data.",
      'error.tryAgain': 'Try again',
      'error.pageNotFound': "We couldn't find this item.",
      'error.pageNotFoundDetails': 'It may have been removed or the link may be incorrect.',
      'item.licenseStatus': 'License status',
      'item.publicationStatus': 'Publication status',
      'item.needsReview': 'Needs review',
      'item.standardPolicy': 'Standard implementation and patent policy',
      'item.standardPolicyStatus': 'Policy status',
    })[key] || key,
  text: (value: { 'zh-CN': string; en?: string } | undefined) => value?.['zh-CN'],
});
export const DEFAULT_LOCALE = 'zh-CN' as const;
export type Locale = 'zh-CN' | 'en';
export const I18nProvider = (props: { children: JSXElement; locale?: Locale | Accessor<Locale> }) => (
  <>{props.children}</>
);
export const resolveLocalizedText = (value: { 'zh-CN': string; en?: string } | undefined, locale: Locale = 'zh-CN') =>
  locale === 'en' && value?.en ? value.en : value?.['zh-CN'];
export const getItemName = (item: Item) => String(item.name || item.id);
export const getItemDescription = () => '';

export enum SVGIconKind {
  CSV = 'csv',
  Download = 'download',
  PDF = 'pdf',
  PNG = 'png',
  ToC = 'toc',
}

export interface Item {
  id: string;
  [key: string]: unknown;
}

export type SiteItemKind = 'software' | 'model_weights' | 'dataset' | 'open_standard' | 'community';
export type SiteProjectStatus = 'active' | 'archived' | 'unknown';
export interface SiteEntry {
  id: string;
  role: string;
  url: string;
  title?: string;
  primary: boolean;
  original: boolean;
  access: 'public' | 'login' | 'approval' | 'contract';
}
export interface SiteLicense {
  scope: string;
  applies_to_entry?: string;
  version?: string;
  identifier?: string;
  status: 'verified' | 'in_review' | 'unknown' | 'not_applicable';
  osi_approved?: boolean;
  checked_at?: string;
}
export interface SiteEvidence {
  id: string;
  title: string;
  url: string;
  publisher: string;
  claim: string;
  checked_at: string;
}
export interface SiteOrigin {
  regions: string[];
  statement: string;
  checked_at: string;
  evidence: SiteEvidence[];
}
export interface SiteAffiliation {
  current_maintainer?: { name: string; url?: string };
  current_foundation?: { name: string; url?: string };
  as_of: string;
}
export interface SiteItemMetadata {
  id: string;
  kind: SiteItemKind;
  canonical_name: string;
  aliases: string[];
  name: { 'zh-CN': string; en?: string };
  description?: { 'zh-CN': string; en?: string };
  tag_ids: string[];
  entries: SiteEntry[];
  licenses: SiteLicense[];
  origin?: SiteOrigin;
  affiliation?: SiteAffiliation;
  publication_status: 'draft' | 'in_review' | 'published' | 'needs_review' | 'withdrawn';
  project_status: SiteProjectStatus;
  status_checked_at?: string;
  status_evidence: SiteEvidence[];
  standard_policy?: {
    status: 'public' | 'restricted' | 'unknown' | 'not_applicable';
    evidence: SiteEvidence[];
  };
}

interface ChildrenProps {
  children: JSXElement;
}

interface ItemContentProps {
  basePath?: string;
  foundation: string;
  hideOrganizationSection?: boolean;
  item?: unknown;
  onClose?: () => void;
  parentInfo?: unknown;
}

interface ModalProps extends ChildrenProps {
  bodyClass?: string;
  id?: string;
  modalDialogClass?: string;
  onClose: () => void;
  open: boolean;
  size?: string;
  title: string;
}

export const ItemModalContent = (props: ItemContentProps) => {
  void props;
  return createTextElement('Item content');
};
export const ItemModalMobileContent = (props: ItemContentProps) => {
  void props;
  return createTextElement('Mobile item content');
};
export const SiteMetadataSection = (props: { metadata?: SiteItemMetadata }) => {
  void props;
  return createTextElement('Site metadata');
};
export const Loading = (props: { spinnerClass?: string; transparentBg?: boolean }) => {
  void props;
  return createTextElement('Loading...');
};
export const Modal = (props: ModalProps) => <>{props.children}</>;
export const NoData = (props: ChildrenProps) => <>{props.children}</>;
export const SVGIcon = (props: { class?: string; kind: SVGIconKind }) => {
  void props;
  return document.createElement('span');
};
export const useBreakpointDetect = () => ({ point: (() => undefined) as Accessor<undefined> });
export const useOutsideClick = (...arguments_: unknown[]) => {
  void arguments_;
};

const createTextElement = (text: string) => {
  const element = document.createElement('div');
  element.textContent = text;
  return element;
};

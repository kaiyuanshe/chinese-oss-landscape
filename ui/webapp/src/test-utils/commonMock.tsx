import type { Accessor, JSXElement } from 'solid-js';

export { siteCapabilities } from '../../../common/src/siteCapabilities';
export { capitalizeFirstLetter } from '../../../common/src/utils/capitalizeFirstLetter';

export const useI18n = () => ({
  locale: () => 'zh-CN' as const,
  t: (key: string) =>
    ({
      'error.loadData': "We couldn't load the landscape data.",
      'error.tryAgain': 'Try again',
    })[key] || key,
  text: (value: { 'zh-CN': string; en?: string } | undefined) => value?.['zh-CN'],
});
export const DEFAULT_LOCALE = 'zh-CN' as const;
export type Locale = 'zh-CN' | 'en';
export const I18nProvider = (props: { children: JSXElement; locale?: Locale }) => <>{props.children}</>;
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

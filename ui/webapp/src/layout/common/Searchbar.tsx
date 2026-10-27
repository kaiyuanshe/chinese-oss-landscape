import {
  FoundationBadge,
  getItemName,
  Image,
  MaturityBadge,
  SVGIcon,
  SVGIconKind,
  useI18n,
  useOutsideClick,
} from 'common';
import isNull from 'lodash/isNull';
import isUndefined from 'lodash/isUndefined';
import { SearchResult } from 'minisearch';
import { batch, createEffect, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';

import { BANNER_ID, FOUNDATION } from '../../data';
import { Item } from '../../types';
import itemsDataGetter from '../../utils/itemsDataGetter';
import searchEngine from '../../utils/search';
import { useUpdateActiveItemId } from '../stores/activeItem';
import { useLocale } from '../stores/locale';
import { useSiteLocalization } from '../stores/siteLocalization';
import HoverableItem from './HoverableItem';
import styles from './Searchbar.module.css';

interface Props {
  searchBarClass?: string;
  device: string;
}

const SEARCH_DELAY = 3 * 100; // 300ms
const MIN_CHARACTERS_SEARCH = 2;

const Searchbar = (props: Props) => {
  const updateActiveItemId = useUpdateActiveItemId();
  const { locale } = useLocale();
  const { t } = useI18n();
  const { categoryName, subcategoryName } = useSiteLocalization();
  const [inputEl, setInputEl] = createSignal<HTMLInputElement>();
  const [dropdownRef, setDropdownRef] = createSignal<HTMLInputElement>();
  const [value, setValue] = createSignal<string>('');
  const [itemsList, setItemsList] = createSignal<SearchResult[] | null>(null);
  const [visibleDropdown, setVisibleDropdown] = createSignal<boolean>(false);
  const [highlightedItem, setHighlightedItem] = createSignal<number | null>(null);
  const [dropdownTimeout, setDropdownTimeout] = createSignal<ReturnType<typeof setTimeout> | null>(null);
  const [error, setError] = createSignal<string | null>(null);

  useOutsideClick([dropdownRef], [BANNER_ID], visibleDropdown, () => {
    setValue('');
    cleanItemsSearch();
  });

  const onKeyDown = (e: KeyboardEvent): void => {
    switch (e.key) {
      case 'Escape':
        cleanItemsSearch();
        return;
      case 'ArrowDown':
        updateHighlightedItem('down');
        return;
      case 'ArrowUp':
        updateHighlightedItem('up');
        return;
      case 'Enter':
        e.preventDefault();
        if (!isNull(itemsList()) && !isNull(highlightedItem())) {
          if (highlightedItem() === itemsList()!.length) {
            search();
          } else {
            const selectedProject = itemsList()![highlightedItem()!];
            if (selectedProject) {
              openItemModal(selectedProject.id);
            }
          }
        } else {
          search();
        }
        return;
      default:
        return;
    }
  };

  const openItemModal = (itemId: string) => {
    updateActiveItemId(itemId);
    setValue('');
    cleanItemsSearch();
    forceBlur();
  };

  const forceBlur = (): void => {
    if (inputEl()) {
      inputEl()!.blur();
    }
  };

  const forceFocus = (): void => {
    if (inputEl()) {
      inputEl()!.focus();
    }
  };

  const onSearch = async (text: string) => {
    await searchEngine
      .searchTerm(text)
      .then((filteredItems) => {
        if (filteredItems.length > 0) {
          const isInputFocused = inputEl() === document.activeElement;
          // We have to be sure that input has focus to display results
          if (isInputFocused) {
            batch(() => {
              setError(null);
              setItemsList(filteredItems);
              setVisibleDropdown(true);
            });
          } else {
            cleanItemsSearch();
          }
        } else {
          batch(() => {
            setItemsList([]);
            setVisibleDropdown(true);
            setError(null);
          });
        }
      })
      .catch((error) => {
        setError(error);
        setItemsList([]);
        setVisibleDropdown(true);
      });
  };

  const search = () => {
    cleanTimeout();
    cleanItemsSearch();
    onSearch(value());
    forceBlur();
  };

  const cleanTimeout = () => {
    if (!isNull(dropdownTimeout())) {
      clearTimeout(dropdownTimeout()!);
      setDropdownTimeout(null);
    }
  };

  const cleanSearchValue = () => {
    setValue('');
    forceFocus();
  };

  const cleanItemsSearch = () => {
    setError(null);
    setItemsList(null);
    setVisibleDropdown(false);
    setHighlightedItem(null);
  };

  const updateHighlightedItem = (arrow: 'up' | 'down') => {
    if (!isNull(itemsList()) && visibleDropdown()) {
      if (!isNull(highlightedItem())) {
        let newIndex: number = arrow === 'up' ? highlightedItem()! - 1 : highlightedItem()! + 1;
        if (newIndex > itemsList()!.length) {
          newIndex = 0;
        }
        if (newIndex < 0) {
          newIndex = itemsList()!.length;
        }
        setHighlightedItem(newIndex);
        scrollToHighlightedItem(newIndex);
      } else {
        if (itemsList() && itemsList()!.length > 0) {
          const newIndex = arrow === 'up' ? itemsList()!.length - 1 : 0;
          setHighlightedItem(newIndex);
          scrollToHighlightedItem(newIndex);
        }
      }
    }
  };

  const scrollToHighlightedItem = (index: number) => {
    const element = document.getElementById(`sl-opt${index}`);
    if (element && !isUndefined(dropdownRef())) {
      element.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'start' });
    }
  };

  createEffect(
    on(value, () => {
      const isInputFocused = inputEl() === document.activeElement;
      if (isInputFocused) {
        if (value().length >= MIN_CHARACTERS_SEARCH) {
          cleanTimeout();
          setDropdownTimeout(
            setTimeout(() => {
              setHighlightedItem(null);
              onSearch(value());
            }, SEARCH_DELAY)
          );
        } else {
          cleanItemsSearch();
        }
      }
    })
  );

  // This function is used to focus the input when the user presses the '/' key
  const docKeyDown = (e: KeyboardEvent) => {
    // We check if the body is the active element to avoid focusing the input when the focus
    // is on a different element (e.g. a input, a select, etc.)
    const isBodyElementActive = document.body === document.activeElement;
    if (isBodyElementActive) {
      if (e.key === '/') {
        e.preventDefault();
        forceFocus();
      }
    }
  };

  onMount(() => {
    // We add the event listener to the document to listen to the '/' key only on desktop
    if (props.device === 'desktop') {
      document.addEventListener('keydown', docKeyDown, false);
    }
  });

  onCleanup(() => {
    if (!isNull(dropdownTimeout())) {
      clearTimeout(dropdownTimeout()!);
    }
    // We remove the event listener when the component is unmounted
    if (props.device === 'desktop') {
      document.removeEventListener('keydown', docKeyDown);
    }
  });

  return (
    <>
      <div
        class={`d-flex align-items-center overflow-hidden searchBar lh-base bg-white mx-0 mx-md-auto ${styles.searchBar} ${props.searchBarClass} search`}
      >
        <input
          id={`searchbar-${props.device}`}
          ref={setInputEl}
          class={`flex-grow-1 ps-2 ps-md-3 border-0 shadow-none bg-transparent lh-base ${styles.input}`}
          type="text"
          value={value()}
          autocomplete="off"
          autocorrect="off"
          autocapitalize="none"
          spellcheck={false}
          placeholder={props.device === 'desktop' ? '' : t('search.placeholder')}
          onKeyDown={onKeyDown}
          onInput={(e) => setValue(e.target.value)}
        />

        {props.device === 'desktop' && (
          <Show when={value() == ''}>
            <div class={`position-absolute d-flex align-items-center ${styles.desktopPlaceholder}`}>
              <Show when={locale() === 'zh-CN'} fallback={<>Type</>}>
                输入
              </Show>
              <small class={`rounded border mx-1 ${styles.desktopPlaceholderIcon}`}>/</small>
              {locale() === 'zh-CN' ? '搜索项目' : 'to search items'}
            </div>
          </Show>
        )}

        <Show when={value() !== ''}>
          <button
            title={t('search.clear')}
            aria-label={t('search.clear')}
            class={`btn btn-link text-muted lh-1 px-2 ${styles.btnIcon}`}
            onClick={cleanSearchValue}
          >
            <div class={styles.btnIcon}>
              <SVGIcon kind={SVGIconKind.Clear} />
            </div>
          </button>
          <div class={`vr ${styles.vr}`} />
        </Show>

        <div class={`px-2 py-1 ${styles.btnIcon} ${styles.iconWrapper}`}>
          <SVGIcon kind={SVGIconKind.Search} />
        </div>
      </div>

      <Show when={visibleDropdown() && !isNull(itemsList())}>
        <div
          ref={setDropdownRef}
          class={`dropdown-menu dropdown-menu-left p-0 w-100 rounded-0 show noFocus overflow-auto visibleScroll ${
            styles.dropdown
          } ${styles[`listLength-${itemsList()!.length}`]}`}
          role="listbox"
          id="search-list"
        >
          <Show
            when={itemsList()!.length > 0}
            fallback={
              <div class="p-4 text-center fst-italic text-muted">
                <small>{error() || t('search.noResults')}</small>
              </div>
            }
          >
            <HoverableItem onLeave={() => setHighlightedItem(null)}>
              <For each={itemsList()!}>
                {(item, index) => {
                  return (
                    <HoverableItem onHover={() => setHighlightedItem(index())} onLeave={() => setHighlightedItem(null)}>
                      <button
                        type="button"
                        class={`btn btn-link text-decoration-none text-black w-100 border-bottom rounded-0 d-flex flex-row align-items-stretch p-3 ${styles.btnProject}`}
                        classList={{
                          activeDropdownItem: index() === highlightedItem(),
                        }}
                        onClick={() => {
                          openItemModal(item.id);
                        }}
                        aria-label={`${t('search.openItem')}: ${item.name}`}
                        role="option"
                        aria-selected={index() === highlightedItem()}
                        id={`sl-opt${index()}`}
                      >
                        <div class="d-flex flex-row align-items-center w-100">
                          <div
                            class={`d-flex align-items-center justify-content-center me-3 ${styles.miniImageWrapper}`}
                          >
                            <Image name={item.name} class={`m-auto ${styles.logo}`} logo={item.logo} />
                          </div>
                          <div
                            class={`flex-grow-1 d-flex flex-column text-start justify-content-between h-100 ${styles.truncateWrapper}`}
                          >
                            <div class="d-flex flex-row align-items-baseline">
                              <span class={`text-truncate fw-semibold ${styles.title}`}>
                                {getItemName(
                                  itemsDataGetter.getItemById(item.id) || (item as unknown as Item),
                                  locale()
                                )}
                              </span>
                              <Show when={!isUndefined(item.maturity)}>
                                <div class={`d-flex flex-nowrap position-relative ${styles.badges}`}>
                                  <FoundationBadge
                                    foundation={FOUNDATION}
                                    class={`d-none d-xxl-flex ms-2 ${styles.badge}`}
                                  />
                                  <MaturityBadge level={item.maturity!} class={`ms-2 ${styles.badge}`} />
                                </div>
                              </Show>
                            </div>
                            <div class={`text-muted ${styles.legend}`}>
                              <span class="d-none d-md-block text-truncate">
                                {categoryName(item.category)} / {subcategoryName(item.category, item.subcategory)}
                              </span>
                              <span class="d-block d-md-none text-truncate">
                                {subcategoryName(item.category, item.subcategory)}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    </HoverableItem>
                  );
                }}
              </For>
            </HoverableItem>
          </Show>
        </div>
      </Show>
    </>
  );
};

export default Searchbar;

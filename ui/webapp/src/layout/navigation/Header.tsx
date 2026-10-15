import { useLocation, useNavigate } from '@solidjs/router';
import { ExternalLink, Image, siteCapabilities, SVGIcon, SVGIconKind, useI18n } from 'common';
import isUndefined from 'lodash/isUndefined';
import { createMemo, For, Show } from 'solid-js';

import { ALL_OPTION, DEFAULT_VIEW_MODE, EXPLORE_PATH, SCREENSHOTS_PATH } from '../../data';
import { siteFeatures } from '../../features';
import isExploreSection from '../../utils/isExploreSection';
import itemsDataGetter from '../../utils/itemsDataGetter';
import prepareLink from '../../utils/prepareLink';
import scrollToTop from '../../utils/scrollToTop';
import DownloadDropdown from '../common/DownloadDropdown';
import Searchbar from '../common/Searchbar';
import { useSetGroupActive } from '../stores/groupActive';
import { useSetViewMode } from '../stores/viewMode';
import EmbedModal from './EmbedModal';
import styles from './Header.module.css';
import LanguageSwitcher from './LanguageSwitcher';
import SiteIdentity from './SiteIdentity';

interface Props {
  statsVisible: boolean;
}

const Header = (props: Props) => {
  const location = useLocation();
  const navigate = useNavigate();
  const logo = () => (window.baseDS.header ? window.baseDS.header!.logo : undefined);
  const setViewMode = useSetViewMode();
  const setSelectedGroup = useSetGroupActive();
  const isExploreActive = createMemo(() => isExploreSection(location.pathname));
  const { t } = useI18n();

  const isActive = (path: string) => {
    return path === location.pathname;
  };

  const resetDefaultExploreValues = () => {
    const groups = itemsDataGetter.getGroups();
    setViewMode(DEFAULT_VIEW_MODE);
    setSelectedGroup(!isUndefined(groups) ? groups[0] : ALL_OPTION);
  };

  return (
    <header class={`d-none d-lg-flex navbar navbar-expand mb-2 border-bottom shadow-sm ${styles.navbar}`}>
      <div class="container-fluid d-flex flex-row align-items-center px-3 px-lg-4 mainPadding">
        <Show when={!isUndefined(logo())}>
          <div class={`d-flex flex-row justify-content-between align-items-center me-3 ${styles.logoWrapper}`}>
            <button
              class="btn btn-link text-decoration-none p-0 me-2"
              onClick={() => {
                resetDefaultExploreValues();
                navigate(prepareLink(EXPLORE_PATH), {
                  state: { from: 'logo-header' },
                });
                scrollToTop(false);
              }}
              aria-label={t('navigation.backToHome')}
            >
              <SiteIdentity logo={logo()!} />
            </button>
          </div>
        </Show>

        <Show
          when={location.pathname !== SCREENSHOTS_PATH}
          fallback={
            <Show when={!isUndefined(window.baseDS.qr_code)}>
              <Image class={styles.qr} logo={window.baseDS.qr_code!} name="QR code" />
            </Show>
          }
        >
          <div class="d-flex align-items-center">
            <button
              class={`btn btn-link position-relative text-uppercase fw-bold text-decoration-none p-0 ${styles.link}`}
              classList={{ activeLink: isExploreActive() }}
              onClick={() => {
                if (isExploreActive()) {
                  scrollToTop(false);
                } else {
                  resetDefaultExploreValues();
                  navigate(prepareLink(EXPLORE_PATH), {
                    state: { from: 'header' },
                  });
                  scrollToTop(false);
                }
              }}
              aria-label={t('navigation.explore')}
            >
              {t('navigation.explore')}
            </button>

            <For each={siteFeatures.navigation({ data: window.baseDS, statsVisible: props.statsVisible })}>
              {(entry) => (
                <button
                  class={`btn btn-link position-relative text-uppercase fw-bold text-decoration-none p-0 ${styles.link}`}
                  classList={{ activeLink: isActive(entry.path) }}
                  onClick={() => {
                    if (!isActive(entry.path)) {
                      navigate(prepareLink(entry.path), { state: { from: 'header' } });
                    }
                    scrollToTop(false);
                  }}
                  aria-label={`Go to "${entry.label}" page`}
                >
                  {entry.label}
                </button>
              )}
            </For>
          </div>

          <div class={`d-flex flex-row align-items-center ms-auto mt-0 ${styles.searchWrapper}`}>
            <div class="position-relative me-4 w-100">
              <Searchbar searchBarClass={`${styles.searchBar}`} device="desktop" />
            </div>

            <div class={`d-flex align-items-center ${styles.icons}`}>
              <LanguageSwitcher />
              <Show when={siteCapabilities.embed}>
                <EmbedModal />
              </Show>
              <Show when={siteCapabilities.downloads}>
                <DownloadDropdown />
              </Show>
              <Show
                when={
                  !isUndefined(window.baseDS.header) &&
                  !isUndefined(window.baseDS.header!.links) &&
                  !isUndefined(window.baseDS.header!.links!.github)
                }
              >
                <ExternalLink
                  class={`btn btn-md text-dark ms-3 px-0 ${styles.btnLink}`}
                  href={window.baseDS.header!.links!.github!}
                  label="中国开源地图源码仓库"
                >
                  <SVGIcon kind={SVGIconKind.GitHub} class={`position-relative ${styles.linkIcon}`} />
                </ExternalLink>
              </Show>
            </div>
          </div>
        </Show>
      </div>
    </header>
  );
};

export default Header;

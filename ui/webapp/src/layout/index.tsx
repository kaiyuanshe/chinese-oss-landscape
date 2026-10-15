import { NoData, useI18n } from 'common';
import isEmpty from 'lodash/isEmpty';
import { createSignal, JSXElement, onMount, Show } from 'solid-js';

import ItemModal from './common/itemModal';
import ZoomModal from './common/zoomModal';
import styles from './Layout.module.css';
import Header from './navigation/Header';
import MobileHeader from './navigation/MobileHeader';
import { ActiveItemProvider } from './stores/activeItem';
import { FinancesDataProvider } from './stores/financesData';
import { FullDataProvider, useFullDataStatus, useRetryFullData } from './stores/fullData';
import { GridWidthProvider } from './stores/gridWidth';
import { GroupActiveProvider } from './stores/groupActive';
import { GuideFileProvider } from './stores/guideFile';
import { LocaleProvider } from './stores/locale';
import { MobileTOCProvider } from './stores/mobileTOC';
import { SiteLocalizationProvider } from './stores/siteLocalization';
import { EventsProvider } from './stores/upcomingEventData';
import { ViewModeProvider } from './stores/viewMode';
import { VisibleZoomSectionProvider } from './stores/visibleZoomSection';
import { ZoomProvider } from './stores/zoom';
import UpcomingEvents from './upcomingEvents';

interface Props {
  children?: JSXElement;
}

const Layout = (props: Props) => {
  const [statsVisible, setStatsVisible] = createSignal<boolean>(true);

  onMount(() => {
    // Check if statsDS is empty, if so, hide the stats link
    if (isEmpty(window.statsDS)) {
      setStatsVisible(false);
    }
  });

  return (
    <LocaleProvider>
      <FullDataProvider>
        <SiteLocalizationProvider>
          <ActiveItemProvider>
            <ViewModeProvider>
              <GroupActiveProvider>
                <VisibleZoomSectionProvider>
                  <ZoomProvider>
                    <GridWidthProvider>
                      <MobileTOCProvider>
                        <GuideFileProvider>
                          <FinancesDataProvider>
                            <EventsProvider>
                              <div class={`d-flex flex-column ${styles.container}`}>
                                <MobileHeader statsVisible={statsVisible()} />
                                <Header statsVisible={statsVisible()} />
                                <FullDataContent>{props.children}</FullDataContent>
                              </div>
                              <FullDataModals />
                              <UpcomingEvents />
                            </EventsProvider>
                          </FinancesDataProvider>
                        </GuideFileProvider>
                      </MobileTOCProvider>
                    </GridWidthProvider>
                  </ZoomProvider>
                </VisibleZoomSectionProvider>
              </GroupActiveProvider>
            </ViewModeProvider>
          </ActiveItemProvider>
        </SiteLocalizationProvider>
      </FullDataProvider>
    </LocaleProvider>
  );
};

const FullDataModals = () => {
  const fullDataStatus = useFullDataStatus();

  return (
    <Show when={fullDataStatus() !== 'error'}>
      <ItemModal />
      <ZoomModal />
    </Show>
  );
};

export default Layout;

const FullDataContent = (props: Props) => {
  const fullDataStatus = useFullDataStatus();
  const retryFullData = useRetryFullData();
  const { t } = useI18n();

  return (
    <Show
      when={fullDataStatus() !== 'error'}
      fallback={
        <main class="container-fluid px-3 px-lg-4 py-5">
          <NoData>
            <div class="d-flex flex-column align-items-center">
              <div class="fs-5">{t('error.loadData')}</div>
              <button type="button" class="btn btn-secondary mt-3" onClick={retryFullData}>
                {t('error.tryAgain')}
              </button>
            </div>
          </NoData>
        </main>
      }
    >
      <div class="d-flex flex-column flex-grow-1">{props.children}</div>
    </Show>
  );
};

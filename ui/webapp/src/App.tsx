import { createWindowSize } from '@solid-primitives/resize-observer';
import { Route, Router, useNavigate } from '@solidjs/router';
import { siteCapabilities } from 'common';
import isUndefined from 'lodash/isUndefined';
import range from 'lodash/range';
import { createEffect, createMemo, createSignal, For, on, onCleanup, onMount, Show } from 'solid-js';

import styles from './App.module.css';
import { BASE_PATH, EMBED_SETUP_PATH, EXPLORE_PATH, SCREENSHOTS_PATH } from './data';
import { siteFeatures } from './features';
import { createGroupAliasRoutes } from './features/groupAliases';
import Layout from './layout';
import Explore from './layout/explore';
import NotFound from './layout/notFound';
import Screenshots from './layout/screenshots';
import { BaseData } from './types';
import itemsDataGetter from './utils/itemsDataGetter';
import updateAlphaInColor from './utils/updateAlphaInColor';

// Colors
let COLOR_1 = 'rgba(0, 107, 204, 1)';
let COLOR_1_HOVER = 'rgba(0, 107, 204, 0.75)';
let COLOR_2 = 'rgba(255, 0, 170, 1)';
let COLOR_3 = 'rgba(96, 149, 214, 1)';
let COLOR_4 = 'rgba(0, 42, 81, 0.7)';
let COLOR_5 = 'rgba(1, 107, 204, 0.7)';
let COLOR_6 = 'rgba(0, 42, 81, 0.7)';
let COLOR_7 = 'rgba(180, 219, 255, 1)';

const GroupAliasRedirect = (props: { target: string }) => {
  const navigate = useNavigate();
  onMount(() => {
    navigate(props.target, { replace: true });
  });
  return null;
};

const App = () => {
  const [data, setData] = createSignal<BaseData>();
  const [motdDismissed, setMotdDismissed] = createSignal(false);
  const size = createWindowSize();
  const height = () => size.height;
  const motdContent = () => data()?.header?.motd;
  const motdVisible = createMemo(() => !isUndefined(motdContent()) && !motdDismissed());
  let motdRef: HTMLDivElement | undefined;
  const groupAliasRoutes = createMemo(() =>
    createGroupAliasRoutes(
      data()?.groups,
      [...siteFeatures.reservedPaths, EMBED_SETUP_PATH, SCREENSHOTS_PATH],
      BASE_PATH
    )
  );

  const updateAppHeight = () => {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`);
  };

  const updateMotdHeight = () => {
    if (!motdVisible()) {
      document.documentElement.style.setProperty('--motd-height', '0px');
      return;
    }
    const elementHeight = motdRef?.offsetHeight ?? 0;
    document.documentElement.style.setProperty('--motd-height', `${elementHeight}px`);
  };

  const loadColors = () => {
    if (!isUndefined(window.baseDS) && !isUndefined(window.baseDS.colors)) {
      if (!isUndefined(window.baseDS.colors?.color1)) {
        COLOR_1 = window.baseDS.colors?.color1;
        COLOR_1_HOVER = updateAlphaInColor(COLOR_1, 0.75);
      }
      if (!isUndefined(window.baseDS.colors?.color2)) {
        COLOR_2 = window.baseDS.colors?.color2;
      }
      if (!isUndefined(window.baseDS.colors?.color3)) {
        COLOR_3 = window.baseDS.colors?.color3;
      }
      if (!isUndefined(window.baseDS.colors?.color4)) {
        COLOR_4 = window.baseDS.colors?.color4;
      }
      if (!isUndefined(window.baseDS.colors?.color5)) {
        COLOR_5 = window.baseDS.colors?.color5;
      }
      if (!isUndefined(window.baseDS.colors?.color6)) {
        COLOR_6 = window.baseDS.colors?.color6;
      }
      if (!isUndefined(window.baseDS.colors?.color7)) {
        COLOR_7 = window.baseDS.colors?.color7;
      }

      const colors = [COLOR_1, COLOR_2, COLOR_3, COLOR_4, COLOR_5, COLOR_6, COLOR_7];

      range(colors.length).forEach((i: number) => {
        document.documentElement.style.setProperty(`--color${i + 1}`, colors[i]);
      });
      document.documentElement.style.setProperty('--color1-hover', COLOR_1_HOVER);
    }
  };

  createEffect(on(height, updateAppHeight));

  createEffect(
    on(motdContent, () => {
      setMotdDismissed(false);
    })
  );

  createEffect(() => {
    if (motdVisible()) {
      document.body.classList.add('motd-visible');
      requestAnimationFrame(() => {
        updateMotdHeight();
      });
    } else {
      document.body.classList.remove('motd-visible');
      document.documentElement.style.setProperty('--motd-height', '0px');
    }
  });

  createEffect(() => {
    if (!motdVisible() || !motdRef || typeof ResizeObserver === 'undefined') {
      return;
    }
    updateMotdHeight();
    const observer = new ResizeObserver(() => {
      updateMotdHeight();
    });
    observer.observe(motdRef);
    onCleanup(() => {
      observer.disconnect();
    });
  });

  onMount(() => {
    itemsDataGetter.prepareGroups();
    setData(window.baseDS);
    itemsDataGetter.init();
    updateAppHeight();
    loadColors();

    if (window.Osano) {
      window.Osano.cm.addEventListener('osano-cm-initialized', () => {
        document.body.classList.add('osano-loaded');
      });
    }
  });

  return (
    <>
      {/* motd */}
      <Show when={motdVisible() && !isUndefined(motdContent())}>
        <div class={`position-fixed start-0 end-0 ${styles.alertWrapper}`} style={{ top: '0px' }}>
          <div
            ref={(element) => {
              motdRef = element;
            }}
            class={`alert w-100 d-flex align-items-center rounded-0 m-0 px-3 px-lg-4 py-2 lh-base ${styles.alert} ${styles.motd} ${styles.motdAlert}`}
          >
            {/* eslint-disable solid/no-innerhtml */}
            <div class={`flex-grow-1 text-center ${styles.motdMessage}`} innerHTML={motdContent()} />
            {/* eslint-enable solid/no-innerhtml */}
            <button
              type="button"
              class={`btn-close ${styles.motdClose}`}
              aria-label="Dismiss message"
              onClick={() => {
                setMotdDismissed(true);
              }}
            />
          </div>
        </div>
      </Show>
      <Show when={!isUndefined(data())}>
        <Router root={Layout}>
          <Route
            path={siteCapabilities.embed ? [EXPLORE_PATH, EMBED_SETUP_PATH] : EXPLORE_PATH}
            component={() => <Explore initialData={data()!} />}
          />
          <For each={siteFeatures.routes}>{(route) => <Route path={route.path} component={route.component} />}</For>
          <For each={groupAliasRoutes()}>
            {(route) => (
              <Route
                path={`${EXPLORE_PATH}${route.alias}`}
                component={() => (
                  <GroupAliasRedirect target={`${EXPLORE_PATH}?group=${encodeURIComponent(route.normalized)}`} />
                )}
              />
            )}
          </For>
          <Route path="*" component={NotFound} />
          <Show when={siteCapabilities.screenshots}>
            <Route path={SCREENSHOTS_PATH} component={() => <Screenshots initialData={data()!} />} />
          </Show>
        </Router>
      </Show>
    </>
  );
};

export default App;

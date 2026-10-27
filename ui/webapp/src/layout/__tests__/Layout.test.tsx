import { createSignal } from 'solid-js';
import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import Layout from '..';

const [mockFullDataStatus, mockSetFullDataStatus] = createSignal<'error' | 'loading' | 'ready'>('loading');

vi.mock('../common/itemModal', () => ({ __esModule: true, default: () => mockCreateElement('Item modal') }));
vi.mock('../common/zoomModal', () => ({ __esModule: true, default: () => mockCreateElement('Zoom modal') }));
vi.mock('../navigation/Header', () => ({ __esModule: true, default: () => mockCreateElement('Header') }));
vi.mock('../navigation/MobileHeader', () => ({
  __esModule: true,
  default: () => mockCreateElement('Mobile header'),
}));
vi.mock('../stores/activeItem', () => ({ ActiveItemProvider: mockProvider }));
vi.mock('../stores/financesData', () => ({ FinancesDataProvider: mockProvider }));
vi.mock('../stores/fullData', () => ({
  FullDataProvider: mockProvider,
  useFullDataStatus: () => mockFullDataStatus,
  useFullDataReady: () => mockFullDataStatus() === 'ready',
  useRetryFullData: () => vi.fn(),
}));
vi.mock('../stores/locale', () => ({
  LocaleProvider: mockProvider,
}));
vi.mock('../stores/siteLocalization', () => ({
  SiteLocalizationProvider: mockProvider,
}));
vi.mock('../stores/gridWidth', () => ({ GridWidthProvider: mockProvider }));
vi.mock('../stores/groupActive', () => ({ GroupActiveProvider: mockProvider }));
vi.mock('../stores/guideFile', () => ({ GuideFileProvider: mockProvider }));
vi.mock('../stores/mobileTOC', () => ({ MobileTOCProvider: mockProvider }));
vi.mock('../stores/upcomingEventData', () => ({ EventsProvider: mockProvider }));
vi.mock('../stores/viewMode', () => ({ ViewModeProvider: mockProvider }));
vi.mock('../stores/visibleZoomSection', () => ({ VisibleZoomSectionProvider: mockProvider }));
vi.mock('../stores/zoom', () => ({ ZoomProvider: mockProvider }));
vi.mock('../upcomingEvents', () => ({ __esModule: true, default: () => mockCreateElement('Upcoming events') }));

describe('Layout', () => {
  let container: HTMLDivElement;
  let dispose: (() => void) | undefined;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = undefined;
    window.statsDS = {};
    mockSetFullDataStatus('loading');
  });

  afterEach(() => {
    dispose?.();
    document.body.replaceChildren();
  });

  it('should hide full-data modals when loading fails', () => {
    dispose = render(
      () => (
        <Layout>
          <div>Route content</div>
        </Layout>
      ),
      container
    );

    expect(container.textContent).toContain('Route content');
    expect(container.textContent).toContain('Item modal');
    expect(container.textContent).toContain('Zoom modal');

    mockSetFullDataStatus('error');

    expect(container.textContent).toContain("We couldn't load the landscape data.");
    expect(container.textContent).not.toContain('Route content');
    expect(container.textContent).not.toContain('Item modal');
    expect(container.textContent).not.toContain('Zoom modal');
    expect(container.textContent).toContain('Header');
  });
});

function mockProvider(props: { children: unknown }) {
  return <>{props.children}</>;
}

function mockCreateElement(text: string) {
  const element = document.createElement('div');
  element.textContent = text;
  return element;
}

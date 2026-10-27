import { render } from 'solid-js/web';
import { afterEach, beforeEach, describe, expect, it, type MockedFunction, vi } from 'vitest';

import Guide from '..';

const mockNavigate = vi.fn();
const mockSetGuideContent = vi.fn();
const mockSetGuideToc = vi.fn();

vi.mock('@solidjs/router', () => ({
  useLocation: () => ({ hash: '', search: '', state: {} }),
  useNavigate: () => mockNavigate,
}));
vi.mock('../../../data', () => ({
  GUIDE_PATH: '/guide',
  SMALL_DEVICES_BREAKPOINTS: [],
}));
vi.mock('../../../utils/goToElement', () => ({ __esModule: true, default: vi.fn() }));
vi.mock('../../../utils/guideData', () => ({ getGuideUrl: () => './data/guide.json' }));
vi.mock('../../../utils/isElementInView', () => ({ __esModule: true, default: () => true }));
vi.mock('../../../utils/normalizeId', () => ({
  __esModule: true,
  default: ({ subtitle, title }: { subtitle?: string; title: string }) =>
    [title, subtitle].filter(Boolean).join('-').toLowerCase(),
}));
vi.mock('../../../utils/scrollToTop', () => ({ __esModule: true, default: vi.fn() }));
vi.mock('../../common/ButtonToTopScroll', () => ({ __esModule: true, default: () => createElement('Top') }));
vi.mock('../../common/Sidebar', () => ({ Sidebar: (props: { children: Node }) => <>{props.children}</> }));
vi.mock('../../navigation/Footer', () => ({ __esModule: true, default: () => createElement('Footer') }));
vi.mock('../../stores/guideFile', () => ({
  useGuideFileContent: () => () => undefined,
  useGuideTOC: () => () => [],
  useSetGuideFileContent: () => mockSetGuideContent,
  useSetGuideTOC: () => mockSetGuideToc,
}));
vi.mock('../../stores/mobileTOC', () => ({
  useMobileTOCStatus: () => () => false,
  useSetMobileTOCStatus: () => vi.fn(),
}));
vi.mock('../SubcategoryExtended', () => ({ __esModule: true, default: () => createElement('Extended') }));
vi.mock('../ToC', () => ({ __esModule: true, default: () => createElement('Contents') }));

describe('Guide', () => {
  const originalFetch = global.fetch;
  let container: HTMLDivElement;
  let dispose: (() => void) | undefined;
  let fetchMock: MockedFunction<typeof fetch>;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    dispose = undefined;
    fetchMock = vi.fn();
    global.fetch = fetchMock;
    window.guide = undefined;
    mockNavigate.mockReset();
    mockSetGuideContent.mockReset();
    mockSetGuideToc.mockReset();
  });

  afterEach(() => {
    dispose?.();
    global.fetch = originalFetch;
    document.body.replaceChildren();
  });

  it('should recover from a failed guide request', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 503 } as Response).mockResolvedValueOnce({
      json: vi.fn().mockResolvedValue({
        categories: [{ category: 'Overview', content: '<p>Guide content</p>', subcategories: [] }],
      }),
      ok: true,
    } as unknown as Response);
    dispose = render(() => <Guide />, container);

    await flushPromises();
    expect(container.textContent).toContain("We couldn't load the guide.");
    expect(container.textContent).not.toContain('Footer');

    getButtonByText(container, 'Try again')!.click();
    await flushPromises();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('Overview');
    expect(container.textContent).toContain('Guide content');
    expect(container.textContent).toContain('Footer');
    expect(mockSetGuideContent).toHaveBeenCalledTimes(1);
    expect(mockSetGuideToc).toHaveBeenCalledTimes(1);
  });
});

const createElement = (text: string) => {
  const element = document.createElement('div');
  element.textContent = text;
  return element;
};

const flushPromises = () => new Promise((resolve) => setTimeout(resolve, 0));

const getButtonByText = (container: HTMLElement, text: string) =>
  Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.trim() === text);

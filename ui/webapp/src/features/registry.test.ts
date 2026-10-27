import { describe, expect, it, vi } from 'vitest';

import { siteFeatures } from '.';
import { createGroupAliasRoutes } from './groupAliases';
import { createFeatureRegistry, FeatureContext, SiteFeature } from './registry';

vi.mock('../utils/getFoundationNameLabel', () => ({ __esModule: true, default: () => 'demo' }));

const context: FeatureContext = {
  data: { foundation: 'DEMO', finances_available: false, categories: [], items: [] },
  statsVisible: true,
};
const features: SiteFeature[] = [
  {
    id: 'example',
    routes: [{ path: ['/example', '/alias'], component: () => null }],
    navigation: { path: '/example', label: 'Example', visible: () => true },
  },
  {
    id: 'stats',
    routes: [{ path: '/stats', component: () => null }],
    navigation: { path: '/stats', label: 'Stats', visible: ({ statsVisible }) => statsVisible },
  },
];

describe('site feature composition', () => {
  it('removes disabled modules from routes and navigation together', () => {
    const registry = createFeatureRegistry(features, ['example']);
    expect(registry.routes.map((route) => route.path)).toEqual([['/example', '/alias']]);
    expect(registry.navigation(context).map((entry) => entry.id)).toEqual(['example']);
  });

  it('keeps a page accessible when its data-dependent navigation is hidden', () => {
    const registry = createFeatureRegistry(features);
    expect(registry.routes).toHaveLength(2);
    expect(registry.navigation({ ...context, statsVisible: false }).map((entry) => entry.id)).toEqual(['example']);
  });

  it('rejects unknown modules and conflicting routes before rendering', () => {
    expect(() => createFeatureRegistry(features, ['missing'])).toThrow('Unknown feature');
    expect(() => createFeatureRegistry([features[0], features[0]])).toThrow('Duplicate feature');
    expect(() =>
      createFeatureRegistry([...features, { id: 'collision', routes: [{ path: '/alias', component: () => null }] }])
    ).toThrow('Duplicate feature route');
  });

  it('keeps only Guide available in the first-release registry', () => {
    expect(siteFeatures.routes.map((route) => route.path)).toEqual(['/guide']);
    expect(
      siteFeatures
        .navigation({ ...context, data: { ...context.data, guide_summary: { category: ['subcategory'] } } })
        .map((entry) => entry.id)
    ).toEqual(['guide']);
    expect(siteFeatures.reservedPaths).toEqual(
      expect.arrayContaining(['/stats', '/finances', '/funding', '/acquisitions', '/projects-summary', '/summary'])
    );
  });

  it('does not let group aliases reopen disabled pages or their aliases under a base path', () => {
    const reservedPaths = [
      ...siteFeatures.reservedPaths.map((path) => `/map${path}`),
      '/map/embed-setup',
      '/screenshot',
    ];
    const aliases = [
      'stats',
      'Stats',
      '%73tats',
      '%2573tats',
      'stats/nested',
      'funding',
      'acquisitions',
      'summary',
      'projects-summary',
      'logos-preview',
      'embed-setup',
      'screenshot',
      'guide',
      '*',
      ':name',
      'team/../stats',
      '%',
      'cloud',
      '/cloud/',
      'Cloud',
      '数据库',
    ];
    expect(
      createGroupAliasRoutes(
        aliases.map((alias) => ({ alias, normalized_name: 'group' })),
        reservedPaths,
        '/map'
      )
    ).toEqual([
      { alias: 'cloud', normalized: 'group' },
      { alias: '数据库', normalized: 'group' },
    ]);
  });
});

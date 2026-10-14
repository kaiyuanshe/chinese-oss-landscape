import { createFeatureRegistry, FeatureContext, SiteFeature } from './registry';

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
});

import { buildSiteLocalization, getLocalizedItemContent } from './siteCatalog';

describe('site catalog localization', () => {
  it('maps stable item content and legacy category labels', () => {
    const localization = buildSiteLocalization({
      id_map: { engine_to_stable: { 'application-development--rpc--demo': 'demo' } },
      taxonomy: {
        categories: [
          {
            id: 'application-development',
            name: { 'zh-CN': '应用开发', en: 'Application development' },
            subcategories: [{ id: 'rpc', name: { 'zh-CN': 'RPC 与服务框架', en: 'RPC and service frameworks' } }],
          },
        ],
      },
      items: [
        {
          id: 'demo',
          name: { 'zh-CN': '示例项目', en: 'Demo project' },
          description: { 'zh-CN': '中文简介', en: 'English description' },
          placements: [
            {
              category_id: 'application-development',
              subcategory_id: 'rpc',
              primary: true,
              engine_id: 'application-development--rpc--demo',
            },
          ],
        },
      ],
    });

    expect(getLocalizedItemContent(localization, { id: 'legacy', annotations: { 'site-id': 'demo' } })).toEqual({
      name: { 'zh-CN': '示例项目', en: 'Demo project' },
      description: { 'zh-CN': '中文简介', en: 'English description' },
      category: { 'zh-CN': '应用开发', en: 'Application development' },
      subcategory: { 'zh-CN': 'RPC 与服务框架', en: 'RPC and service frameworks' },
    });
    expect(localization.categories['application-development'].en).toBe('Application development');
    expect(localization.subcategories['application-development:rpc'].en).toBe('RPC and service frameworks');
  });
});

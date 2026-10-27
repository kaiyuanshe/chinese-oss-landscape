import { describe, expect, it } from 'vitest';

import { buildSiteLocalization, getLocalizedItemContent, getSiteItemMetadata, getSiteStableId } from './siteCatalog';

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

  it('maps site metadata, evidence and legacy IDs without changing the stable identity', () => {
    const localization = buildSiteLocalization({
      id_map: { legacy_to_stable: { 'old-demo': 'demo' } },
      evidence: [
        {
          id: 'origin-demo',
          title: 'Origin evidence',
          url: 'https://example.com/origin',
          publisher: 'Example',
          claim: 'The project originated in mainland China.',
          checked_at: '2026-10-15',
        },
      ],
      items: [
        {
          id: 'demo',
          kind: 'dataset',
          canonical_name: 'Demo Dataset',
          aliases: ['Old Demo'],
          name: { 'zh-CN': '示例数据集', en: 'Demo Dataset' },
          tag_ids: ['data-processing'],
          entries: [
            {
              id: 'dataset',
              role: 'dataset',
              url: 'https://example.com/data',
              primary: true,
              original: true,
              access: 'public',
            },
          ],
          licenses: [
            {
              scope: 'dataset',
              identifier: 'CC-BY-4.0',
              status: 'verified',
              evidence_ids: ['origin-demo'],
            },
          ],
          origin: {
            regions: ['mainland'],
            statement: 'The project originated in mainland China.',
            evidence_ids: ['origin-demo'],
            checked_at: '2026-10-15',
          },
          publication_status: 'published',
          project_status: 'active',
          status_evidence_ids: ['origin-demo'],
        },
      ],
    });

    expect(getSiteStableId(localization, { id: 'old-demo' })).toBe('demo');
    expect(getSiteItemMetadata(localization, { id: 'old-demo' })).toMatchObject({
      kind: 'dataset',
      aliases: ['Old Demo'],
      origin: { regions: ['mainland'], evidence: [{ id: 'origin-demo' }] },
      status_evidence: [{ id: 'origin-demo' }],
    });
  });
});

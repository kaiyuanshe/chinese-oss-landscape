import { describe, expect, it } from 'vitest';

import type { BaseData, Group } from '../types';
import sortCategoriesByGroupOrder from './sortCategoriesByGroupOrder';

const createGroup = (overrides: Partial<Group> = {}): Group => ({
  name: 'AI Native',
  normalized_name: 'ai-native',
  categories: ['AI Agent', 'Inference', 'Training', 'Data', 'AI Native Infra'],
  ...overrides,
});

const createBaseData = (overrides: Partial<BaseData> = {}): BaseData => ({
  finances_available: false,
  foundation: '',
  categories: [
    { name: '应用开发', normalized_name: '应用开发', subcategories: [] },
    { name: '系统软件', normalized_name: '系统软件', subcategories: [] },
    { name: '人工智能', normalized_name: '人工智能', subcategories: [] },
  ],
  items: [],
  ...overrides,
});

describe('sortCategoriesByGroupOrder', () => {
  it('should follow the configured group category order', () => {
    window.baseDS = createBaseData({
      categories: ['Data', 'Training', 'Inference', 'AI Agent'].map((name) => ({
        name,
        normalized_name: name,
        subcategories: [],
      })),
      groups: [createGroup()],
    });

    expect(sortCategoriesByGroupOrder(['AI Agent', 'Training', 'Data', 'Inference'], 'ai-native')).toEqual([
      'AI Agent',
      'Inference',
      'Training',
      'Data',
    ]);
  });

  it.each([undefined, [createGroup({ categories: ['人工智能', '应用开发', '系统软件'] })]])(
    'should use taxonomy order for all regardless of configured groups (%j)',
    (groups) => {
      window.baseDS = createBaseData({ groups });
      const categories = ['应用开发', '人工智能', '系统软件'];

      expect(sortCategoriesByGroupOrder(categories, 'all')).toEqual(['应用开发', '系统软件', '人工智能']);
      expect(categories).toEqual(['应用开发', '人工智能', '系统软件']);
    }
  );

  it('should omit filtered categories and retain unknown categories at the end', () => {
    window.baseDS = createBaseData();

    expect(sortCategoriesByGroupOrder(['新增分类', '人工智能', '另一分类', '系统软件'], 'all')).toEqual([
      '系统软件',
      '人工智能',
      '新增分类',
      '另一分类',
    ]);
  });

  it('should keep categories unchanged when no taxonomy order is available', () => {
    window.baseDS = createBaseData({
      categories: [],
      groups: [createGroup()],
    });

    expect(sortCategoriesByGroupOrder(['AI Agent', 'Training', 'Data', 'Inference'], 'all')).toEqual([
      'AI Agent',
      'Training',
      'Data',
      'Inference',
    ]);
  });

  it('should preserve the existing order for an unknown group', () => {
    window.baseDS = createBaseData({ groups: [createGroup()] });

    expect(sortCategoriesByGroupOrder(['人工智能', '系统软件'], 'missing')).toEqual(['人工智能', '系统软件']);
  });
});

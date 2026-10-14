import { Item, SortDirection, SortOption } from '../types';
import { ItemsDataGetter } from './itemsDataGetter';
import { getSiteSortState } from './siteSort';

jest.mock('./getFoundationNameLabel', () => ({ __esModule: true, default: () => 'demo' }));
jest.mock('./search', () => ({ __esModule: true, default: { init: jest.fn() } }));

describe('site sorting policy', () => {
  it('offers only name sorting even when legacy project data has dates, repositories and funding', () => {
    const item: Item = {
      id: 'example',
      name: 'Example',
      category: 'Tools',
      subcategory: 'Development',
      logo: 'example.svg',
      repositories: [{ url: 'https://github.com/example/project', primary: true }],
      accepted_at: '2026-01-01',
      crunchbase_data: { funding: 100 } as Item['crunchbase_data'],
    };
    window.baseDS = { foundation: 'DEMO', finances_available: true, categories: [], items: [item] };
    const getter = new ItemsDataGetter();
    getter.init({ categories: [], items: [item] });

    expect(getter.getClassifyAndSortOptions().all.sort).toEqual([SortOption.Name]);
  });

  it.each(Object.values(SortOption).filter((option) => option !== SortOption.Name))(
    'normalizes a legacy %s URL while preserving its other state',
    (option) => {
      const next = getSiteSortState(`?sort-by=${option}&sort-direction=desc&item=example&group=tools`);
      expect(next.sort).toBe(SortOption.Name);
      expect(next.direction).toBe(SortDirection.Asc);
      expect(new URLSearchParams(next.query).get('sort-by')).toBe('name');
      expect(new URLSearchParams(next.query).get('sort-direction')).toBe('asc');
      expect(new URLSearchParams(next.query).get('item')).toBe('example');
      expect(new URLSearchParams(next.query).get('group')).toBe('tools');
    }
  );

  it('keeps valid name ordering and does not add defaults to a clean URL', () => {
    expect(getSiteSortState('?sort-by=name&sort-direction=desc').direction).toBe(SortDirection.Desc);
    expect(getSiteSortState('?item=example').query).toBe('item=example');
  });

  it('keeps a valid direction when the sort field is omitted', () => {
    expect(getSiteSortState('?sort-direction=desc')).toEqual({
      sort: SortOption.Name,
      direction: SortDirection.Desc,
      query: 'sort-direction=desc',
    });
  });
});

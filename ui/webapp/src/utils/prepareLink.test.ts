import { describe, expect, it } from 'vitest';

import prepareLink from './prepareLink';

describe('prepareLink', () => {
  it.each([
    ['/', 'item=example', '/?item=example'],
    ['/chinese-oss-landscape/', 'group=database', '/chinese-oss-landscape/?group=database'],
    ['/chinese-oss-landscape/guide', 'page=introduction', '/chinese-oss-landscape/guide/?page=introduction'],
  ])('preserves routes and query strings for %s', (path, query, expected) => {
    expect(prepareLink(path, query)).toBe(expected);
  });

  it('keeps the route unchanged when there is no query', () => {
    expect(prepareLink('/guide')).toBe('/guide');
  });
});

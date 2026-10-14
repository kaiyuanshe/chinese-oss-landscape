import { siteCapabilities } from 'common';

import { SORT_BY_PARAM, SORT_DIRECTION_PARAM } from '../data';
import { SortDirection, SortOption } from '../types';

export const getSiteSortOptions = (options: SortOption[]): SortOption[] =>
  siteCapabilities.extendedSorting ? options : [SortOption.Name];

/** Apply the same sorting policy to shared links, initial state and navigation. */
export const getSiteSortState = (search: string) => {
  const params = new URLSearchParams(search);
  const requestedSort = params.get(SORT_BY_PARAM) ?? SortOption.Name;
  const requestedDirection = params.get(SORT_DIRECTION_PARAM);
  const validSort = getSiteSortOptions(Object.values(SortOption)).includes(requestedSort as SortOption);
  const validDirection = Object.values(SortDirection).includes(requestedDirection as SortDirection);
  const sort = validSort ? (requestedSort as SortOption) : SortOption.Name;
  const direction = validSort && validDirection ? (requestedDirection as SortDirection) : SortDirection.Asc;

  if (!validSort) params.set(SORT_BY_PARAM, sort);
  if (requestedDirection !== null && (!validSort || !validDirection)) params.set(SORT_DIRECTION_PARAM, direction);

  return { sort, direction, query: params.toString() };
};

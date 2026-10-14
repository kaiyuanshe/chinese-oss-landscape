import type { Group } from '../types';

/** Keep data-defined redirects away from application routes and router patterns. */
export const createGroupAliasRoutes = (
  groups: Pick<Group, 'alias' | 'normalized_name'>[] = [],
  reservedPaths: string[],
  basePath = ''
) => {
  const normalize = (path: string) =>
    decodeURIComponent(path)
      .replace(/^\/+|\/+$/g, '')
      .toLowerCase();
  const normalizedBase = normalize(basePath);
  const reserved = new Set(
    reservedPaths.map((path) => {
      const normalized = normalize(path);
      return normalizedBase && normalized.startsWith(`${normalizedBase}/`)
        ? normalized.slice(normalizedBase.length + 1)
        : normalized;
    })
  );
  const used = new Set<string>();

  return groups.reduce<{ alias: string; normalized: string }[]>((routes, group) => {
    let alias: string;
    try {
      alias = decodeURIComponent(group.alias?.trim() || '').replace(/^\/+|\/+$/g, '');
    } catch {
      return routes;
    }
    const normalized = alias.toLowerCase();
    if (
      !alias ||
      /[:*?#%\\]/.test(alias) ||
      alias.split('/').some((segment) => !segment || segment === '.' || segment === '..') ||
      used.has(normalized) ||
      [...reserved].some((path) => normalized === path || normalized.startsWith(`${path}/`))
    ) {
      return routes;
    }
    used.add(normalized);
    routes.push({ alias, normalized: group.normalized_name });
    return routes;
  }, []);
};

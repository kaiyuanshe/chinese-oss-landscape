import type { Component } from 'solid-js';

import type { BaseData } from '../types';

export interface FeatureContext {
  data: BaseData;
  statsVisible: boolean;
}

export interface FeatureRoute {
  path: string | string[];
  component: Component;
}

export interface SiteFeature {
  id: string;
  routes: FeatureRoute[];
  navigation?: {
    path: string;
    label: string;
    visible: (context: FeatureContext) => boolean;
  };
}

/** Compose optional pages and both navigation menus at one integration boundary. */
export const createFeatureRegistry = (features: SiteFeature[], enabledIds = features.map((feature) => feature.id)) => {
  const ids = new Set<string>();
  const paths = new Set<string>();
  for (const feature of features) {
    if (ids.has(feature.id)) throw new Error(`Duplicate feature: ${feature.id}`);
    ids.add(feature.id);
  }
  for (const id of enabledIds) {
    if (!ids.has(id)) throw new Error(`Unknown feature: ${id}`);
  }
  const enabled = features.filter((feature) => enabledIds.includes(feature.id));
  const routes = enabled.flatMap((feature) => feature.routes);
  for (const route of routes) {
    for (const path of Array.isArray(route.path) ? route.path : [route.path]) {
      if (paths.has(path)) throw new Error(`Duplicate feature route: ${path}`);
      paths.add(path);
    }
  }
  return {
    routes,
    // Disabled page paths remain reserved, so a group alias cannot reopen them.
    reservedPaths: features.flatMap((feature) => feature.routes.flatMap((route) => route.path)),
    navigation: (context: FeatureContext) =>
      enabled.flatMap((feature) =>
        feature.navigation?.visible(context) ? [{ id: feature.id, ...feature.navigation }] : []
      ),
  };
};

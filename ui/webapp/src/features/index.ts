import { siteCapabilities } from 'common';
import { lazy } from 'solid-js';

import {
  ACQUISITIONS_PATH,
  FINANCES_PATH,
  FUNDING_PATH,
  GUIDE_PATH,
  LOGOS_PREVIEW_PATH,
  PROJECTS_PATH,
  STATS_PATH,
  SUMMARY_PATH,
} from '../data';
import { createFeatureRegistry, SiteFeature } from './registry';

// Keep optional implementations available without registering disabled routes.
const features: SiteFeature[] = [
  {
    id: 'guide',
    routes: [{ path: GUIDE_PATH, component: lazy(() => import('../layout/guide')) }],
    navigation: {
      path: GUIDE_PATH,
      label: 'Guide',
      visible: ({ data }) => Object.keys(data.guide_summary || {}).length > 0,
    },
  },
  {
    id: 'stats',
    routes: [{ path: STATS_PATH, component: lazy(() => import('../layout/stats')) }],
    navigation: { path: STATS_PATH, label: 'Stats', visible: ({ statsVisible }) => statsVisible },
  },
  {
    id: 'finances',
    routes: [
      { path: [FINANCES_PATH, FUNDING_PATH, ACQUISITIONS_PATH], component: lazy(() => import('../layout/finances')) },
    ],
  },
  {
    id: 'projects',
    routes: [{ path: [PROJECTS_PATH, SUMMARY_PATH], component: lazy(() => import('../layout/projects')) }],
  },
  {
    id: 'logos',
    routes: [{ path: LOGOS_PREVIEW_PATH, component: lazy(() => import('../layout/logos')) }],
  },
];

export const siteFeatures = createFeatureRegistry(
  features,
  Object.entries(siteCapabilities.pages)
    .filter(([, enabled]) => enabled)
    .map(([id]) => id)
);

/** Static capabilities of this site's first release, shared by all UI packages. */
export const siteCapabilities = Object.freeze({
  pages: Object.freeze({
    guide: true,
    stats: false,
    finances: false,
    projects: false,
    logos: false,
  }),
  downloads: false,
  embed: false,
  screenshots: false,
  projectBadges: false,
  repositoryBadges: false,
  extendedSorting: false,
});

/**
 * The public navigation map, kept out of the client menu module so the server header can
 * read the same list. The menu and the bar therefore cannot drift apart.
 */
export const SITE_NAV_LINKS = [
  { href: "/subjects", label: "Subjects" },
  { href: "/search", label: "Search" },
] as const;

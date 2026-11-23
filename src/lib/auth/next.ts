/**
 * The `next` return path (`USER_FLOWS.md` §6): the CTA that sent a visitor to sign-in is
 * preserved, but only an internal path is ever accepted. A value that is not a path on this
 * origin is dropped, which removes the open-redirect class of bug rather than filtering
 * known-bad values.
 */

const AUTH_PATHS = ["/sign-in", "/sign-up", "/verify", "/reset-password"];

export function safeNextPath(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;

  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//")) return null;
  if (path.includes("\\") || path.includes("://")) return null;
  // Control characters would be stripped by a browser into a different path.
  if (/[\u0000-\u001f\u007f]/.test(path)) return null;

  // The root is where sign-in lands anyway, and another auth screen is a loop, not a
  // destination.
  const pathname = path.split("?")[0] ?? "";
  if (pathname === "/" || AUTH_PATHS.includes(pathname)) return null;

  return path;
}

/** `/sign-up` → `/sign-up?next=%2F…` when a valid return path is in play. */
export function withNext(path: string, next: string | null): string {
  if (!next) return path;

  const separator = path.includes("?") ? "&" : "?";
  return `${path}${separator}next=${encodeURIComponent(next)}`;
}

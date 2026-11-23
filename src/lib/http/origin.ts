/**
 * The same-origin rule for mutating requests (`SECURITY_AND_PERMISSIONS.md` §8,
 * `API_CONTRACTS.md` §2): a browser always sends `Origin` on a cross-origin POST, so a
 * foreign origin is refused before anything is read or written.
 *
 * A request with no `Origin` is allowed: that is a same-origin fetch from a client that
 * omits it, or a server-to-server call authenticated another way. `Sec-Fetch-Site` is
 * checked as well when it is present, because it cannot be spoofed from a page.
 */
export function isSameOriginRequest(request: Request): boolean {
  const site = request.headers.get("sec-fetch-site");
  if (site === "cross-site") return false;

  const origin = request.headers.get("origin");
  if (!origin) return true;

  try {
    return new URL(origin).origin === new URL(request.url).origin;
  } catch {
    return false;
  }
}

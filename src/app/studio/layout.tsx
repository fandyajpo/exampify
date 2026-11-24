/**
 * Studio shell (`INFORMATION_ARCHITECTURE.md` §4.3): staff only and `noindex`.
 *
 * The guard runs here, once, for every studio screen: no session redirects to sign-in with
 * `/studio` as the return path, and a signed-in account without `content:read:studio` gets a
 * `404` — the studio's existence is not confirmed to a student (`SEC §3.1`).
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { getActor } from "@/lib/auth/actor";
import { withNext } from "@/lib/auth/next";
import { can } from "@/lib/rbac";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: { default: "Studio", template: "%s | Exampify Studio" },
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/studio", label: "Overview" },
  { href: "/studio/subjects", label: "Subjects" },
  { href: "/studio/media", label: "Media" },
  { href: "/studio/audit", label: "Audit" },
] as const;

export default async function StudioLayout({
  children,
}: {
  children: React.ReactNode;
}): Promise<React.JSX.Element> {
  const actor = await getActor();
  if (!actor) redirect(withNext("/sign-in", "/studio"));
  if (!can(actor, "content:read:studio")) notFound();

  return (
    <div className="flex min-h-screen flex-col bg-paper-sunk">
      <header className="border-b border-line bg-paper-raised">
        <div className="mx-auto flex h-16 w-full max-w-[1240px] items-center gap-6 px-4 md:px-6 lg:px-8">
          <Link href="/studio" className="font-display text-lg font-semibold tracking-tight text-ink">
            Exampify<span className="text-cobalt">.</span>{" "}
            <span className="font-sans text-sm font-medium tracking-normal text-ink-3">Studio</span>
          </Link>

          <nav aria-label="Studio">
            <ul className="flex items-center gap-1">
              {NAV.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex h-11 items-center rounded-sm px-3 text-sm font-medium text-ink-2 transition-colors hover:text-ink"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="ml-auto flex items-center gap-4 text-sm">
            <span className="hidden text-ink-3 sm:inline">{actor.role}</span>
            <Link href="/" className="text-ink-2 underline-offset-4 hover:text-ink hover:underline">
              View site
            </Link>
          </div>
        </div>
      </header>

      <main id="main" className="mx-auto w-full max-w-[1240px] flex-1 px-4 py-10 md:px-6 md:py-12 lg:px-8">
        {children}
      </main>
    </div>
  );
}

import type { ReactNode } from "react";

/**
 * The auth card: one centred column, one `h1`, no navigation (`UI_UX_GUIDELINES.md` §3,
 * §6). Auth screens are deliberately quieter than the public site — nothing competes with
 * the single task on the page.
 */
export function AuthCard({
  title,
  description,
  children,
  footer,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
  footer: ReactNode;
}): React.JSX.Element {
  return (
    <div className="rounded-md border border-line bg-paper-raised p-6 shadow-sm md:p-8">
      <h1 className="font-display text-2xl font-semibold tracking-[-0.02em] md:text-3xl">
        {title}
      </h1>
      <p className="mt-2 text-ink-2">{description}</p>

      <div className="mt-6">{children}</div>

      <div className="mt-6 border-t border-line pt-5 text-sm text-ink-2">{footer}</div>
    </div>
  );
}

/**
 * The icon set (DESIGN_SYSTEM.md §6): one stroke family, 1.75 px stroke, `currentColor`,
 * `aria-hidden` because every icon in this app is paired with visible text.
 *
 * Subject keys come from the fixed registry in DESIGN_SYSTEM.md §6; an unknown key falls
 * back to `book-open`, which is why `SUBJECT_ICONS` is a lookup with a default rather than
 * a required map.
 */
import type { ReactNode, SVGProps } from "react";
import { cn } from "@/lib/utils";

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, className, ...props }: IconProps & { children: ReactNode }): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={cn("size-6 shrink-0", className)}
      {...props}
    >
      {children}
    </svg>
  );
}

export function IconArrowRight(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 12h15M13 6l6 6-6 6" />
    </Icon>
  );
}

export function IconSearch(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4.5 4.5" />
    </Icon>
  );
}

export function IconMenu(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Icon>
  );
}

export function IconBookOpen(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M12 6.5C10.5 5 8 4.5 4 4.5v13c4 0 6.5.5 8 2 1.5-1.5 4-2 8-2v-13c-4 0-6.5.5-8 2Z" />
      <path d="M12 6.5v13" />
    </Icon>
  );
}

export function IconLeaf(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M4.5 19.5C4.5 11 10.5 4.5 20 4c0 9.5-6 15.5-15.5 15.5Z" />
      <path d="m4.5 19.5 7-7" />
    </Icon>
  );
}

export function IconFlask(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M9 3h6M10 3v5.5L5.6 18a2 2 0 0 0 1.8 3h9.2a2 2 0 0 0 1.8-3L14 8.5V3" />
      <path d="M8 14h8" />
    </Icon>
  );
}

export function IconSigma(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="M18 5H6l6 7-6 7h12" />
    </Icon>
  );
}

export function IconAtom(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="2" fill="currentColor" stroke="none" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4.2" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(60 12 12)" />
      <ellipse cx="12" cy="12" rx="9.5" ry="4.2" transform="rotate(120 12 12)" />
    </Icon>
  );
}

export function IconLayers(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="m12 3 9 5-9 5-9-5 9-5Z" />
      <path d="m3 13 9 5 9-5" />
      <path d="m3 17 9 5 9-5" />
    </Icon>
  );
}

export function IconTimer(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <circle cx="12" cy="13" r="8" />
      <path d="M12 9v4l2.5 2.5M9 2h6" />
    </Icon>
  );
}

export function IconCheck(props: IconProps): React.JSX.Element {
  return (
    <Icon {...props}>
      <path d="m4 12.5 5 5 11-11" />
    </Icon>
  );
}

export const SUBJECT_ICONS = {
  atom: IconAtom,
  flask: IconFlask,
  leaf: IconLeaf,
  sigma: IconSigma,
  "book-open": IconBookOpen,
} as const;

export type SubjectIconKey = keyof typeof SUBJECT_ICONS;

export function SubjectIcon({ iconKey, className }: { iconKey: string; className?: string }): React.JSX.Element {
  const Glyph = SUBJECT_ICONS[iconKey as SubjectIconKey] ?? IconBookOpen;
  return <Glyph className={className} />;
}

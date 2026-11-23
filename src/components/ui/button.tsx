/**
 * Button (DESIGN_SYSTEM.md §9.1), refined: hairline edge, neutral elevation, and a press
 * that moves 1 px instead of the neo-brutalist 2 px slap. Focus comes from the global
 * `:focus-visible` rule in `globals.css`.
 */
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "sunbeam";
type ButtonSize = "sm" | "md" | "lg";

// `lift` is the documented press (`DESIGN_SYSTEM.md` §5/§7): −1 px on hover, +2 px on
// active, and no transform at all under `prefers-reduced-motion`.
const BASE =
  "lift inline-flex items-center justify-center gap-2 rounded-md border font-medium hover:shadow-md disabled:border-line-soft disabled:bg-paper-sunk disabled:text-ink-3 disabled:shadow-none disabled:transform-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "border-cobalt bg-cobalt text-white shadow-sm hover:bg-cobalt/90",
  secondary: "border-line-strong bg-paper-raised text-ink shadow-sm hover:border-ink/40 hover:bg-paper",
  sunbeam: "border-line-strong bg-paper-accent text-ink shadow-sm hover:bg-sunbeam/40",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-3 text-sm",
  md: "h-11 px-4 text-base",
  lg: "h-13 px-6 text-lg",
};

type ButtonStyleProps = { variant?: ButtonVariant; size?: ButtonSize };

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: ComponentProps<"button"> & ButtonStyleProps): React.JSX.Element {
  return (
    <button type={type} className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />
  );
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  ...props
}: ComponentProps<typeof Link> & ButtonStyleProps): React.JSX.Element {
  return <Link className={cn(BASE, VARIANTS[variant], SIZES[size], className)} {...props} />;
}

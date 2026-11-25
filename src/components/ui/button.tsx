/**
 * Button (DESIGN_SYSTEM.md §9.1): a continuous pill, one vivid action blue, and a press
 * that scales down on contact for immediate feedback. Focus comes from the global
 * `:focus-visible` rule in `globals.css`.
 */
import Link from "next/link";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "sunbeam";
type ButtonSize = "sm" | "md" | "lg";

// `press` is the documented response (`DESIGN_SYSTEM.md` §7): scale to 0.97 on pointer-down,
// no transform at all under `prefers-reduced-motion`.
const BASE =
  "press inline-flex items-center justify-center gap-2 rounded-full font-medium whitespace-nowrap disabled:border-transparent disabled:bg-paper-sunk disabled:text-ink-3 disabled:shadow-none disabled:transform-none";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-cobalt text-white shadow-sm hover:brightness-110",
  secondary: "bg-paper-sunk text-ink hover:bg-paper-accent",
  sunbeam: "bg-sunbeam/30 text-ink hover:bg-sunbeam/45",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-base",
  lg: "h-13 px-7 text-base",
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

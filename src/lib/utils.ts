/**
 * Class-name composition for conditional styles (TECHNICAL_STANDARDS.md §13).
 *
 * `clsx` resolves conditionals and `tailwind-merge` lets a caller override a component's
 * default utility without relying on declaration order in the stylesheet.
 */
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

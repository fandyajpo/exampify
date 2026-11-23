/**
 * The closed set of subject identity tokens (`DESIGN_SYSTEM.md` §3.3). It lives in `lib`
 * because both the database read path and the UI need the same union — a component must
 * not be the place a token set is defined.
 */
export const SUBJECT_COLORS = [
  "cobalt",
  "lilac",
  "leaf",
  "lime",
  "blush",
  "amber",
  "sky",
  "plum",
  "sunbeam",
  "mauve",
] as const;

export type SubjectColor = (typeof SUBJECT_COLORS)[number];

/** Narrows a stored `color_token`; an unknown token falls back to the brand cobalt. */
export function toSubjectColor(value: string): SubjectColor {
  return (SUBJECT_COLORS as readonly string[]).includes(value)
    ? (value as SubjectColor)
    : "cobalt";
}

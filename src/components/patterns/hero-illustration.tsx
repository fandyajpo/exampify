/**
 * Homepage hero illustration (DESIGN_SYSTEM.md §6): flat line art in ink-grey with a single
 * accent, now at a 2 px stroke so it reads as a drawn diagram rather than a cartoon.
 * Decorative, so it is `aria-hidden` and all real text lives in the DOM.
 */
export function HeroIllustration(): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 440 400"
      aria-hidden="true"
      focusable="false"
      className="mx-auto h-auto w-full max-w-[400px]"
    >
      {/* Study page */}
      <g stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="34" y="26" width="248" height="300" rx="16" fill="var(--paper-raised)" />
        <rect x="58" y="54" width="120" height="14" rx="7" fill="var(--ink-2)" stroke="none" />
        <rect x="58" y="84" width="196" height="8" rx="4" fill="var(--line)" stroke="none" />
        <rect x="58" y="101" width="150" height="8" rx="4" fill="var(--line)" stroke="none" />
        <circle cx="108" cy="176" r="32" fill="var(--paper)" />
        <circle cx="108" cy="176" r="10" fill="var(--sunbeam)" stroke="none" />
        <path d="M152 176h40m0 0-10-10m10 10-10 10" />
        <rect x="58" y="238" width="150" height="7" rx="3.5" fill="var(--line)" stroke="none" />
        <rect x="58" y="256" width="126" height="7" rx="3.5" fill="var(--line)" stroke="none" />
        <rect x="58" y="274" width="138" height="7" rx="3.5" fill="var(--line)" stroke="none" />
      </g>

      {/* Practice card, lifted by a soft offset instead of an ink block */}
      <rect x="224" y="212" width="196" height="166" rx="14" fill="var(--shadow-color)" />
      <g stroke="var(--line-strong)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="216" y="204" width="196" height="166" rx="14" fill="var(--paper-raised)" />
        <rect x="238" y="244" width="152" height="30" rx="8" fill="var(--paper-accent)" />
        <path d="m247 258 5 5 9-11" stroke="var(--leaf)" />
        <rect x="238" y="284" width="152" height="30" rx="8" fill="var(--paper)" />
        <rect x="238" y="324" width="152" height="30" rx="8" fill="var(--paper)" />
      </g>
    </svg>
  );
}

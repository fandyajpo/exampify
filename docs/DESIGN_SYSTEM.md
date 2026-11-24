# Design System — Exampify

| Field | Value |
|-------|-------|
| Version | 1.2 |
| Status | Normative — §4.2, §5.1, §5.5, §5.4, §7 and §9.7/§9.9 describe the shipped layout system |
| Changelog | 1.2 — reconciles §2, §3.1, §5.3, §5.4, §8, §9 and §11 with `globals.css`: 1 px warm hairlines and soft neutral elevation replace 2 px ink borders and hard-offset shadows, and the unused `--border-base` / `--border-bold` tokens are removed. 1.1 — records the adaptive layout revamp: fluid type scale and gutters, layout tokens (`--gutter`, `--section-y`, `--shell-max`, `--studio-max`, `--sidebar-w`), the 264 px studio sidebar and its mobile sheet, the 768 px table→card switch, and pointer-only hover lift |
| Supersedes | Version 0.1 (materials/tutorials vocabulary, no format or search components) |
| Depends on | [PRODUCT_REQUIREMENTS.md](./PRODUCT_REQUIREMENTS.md) (§3 design direction) |
| Referenced by | [UI_UX_GUIDELINES.md](./UI_UX_GUIDELINES.md), [MVP_ROADMAP.md](./MVP_ROADMAP.md) |

---

## 1. Purpose and scope

A concrete, implementable design system for **soft neo-brutalism**: warm paper surfaces, hairline structure, confident editorial type, soft neutral elevation and colourful subject identities — balanced with generous whitespace, controlled radii and a restrained accent palette so it reads as an art-directed education product rather than a novelty poster.

**In scope:** foundations (colour, type, spacing, radius, border, shadow, iconography, illustrations, motion), token names and values, component inventory with anatomy and variants, accessibility constraints, and implementation guidance (CSS variables + Tailwind theme mapping).

**Out of scope:** page composition and per-screen layouts ([UI_UX_GUIDELINES.md](./UI_UX_GUIDELINES.md)), content taxonomy ([CONTENT_MODEL.md](./CONTENT_MODEL.md)).

**Non-goals:** a component library for reuse outside this product, dark mode (deferred, see `OQ-DS1`), and any third-party UI kit as the base.

---

## 2. Design principles

| Principle | What it means in practice | Anti-pattern it prevents |
|---|---|---|
| **Paper, not glass** | Warm off-white surfaces; elevation is a soft neutral shadow, never a coloured glow | Frosted-glass cards, gradient meshes, hard offset shadows |
| **Ink outlines** | 1 px warm hairlines define structure; the darker `--line-strong` hairline marks interactive edges | Borderless floating cards that lose hierarchy |
| **Editorial hierarchy** | One display heading per viewport; body text sized for reading (17–18 px) with 1.6 line height | Uniform 14 px text everywhere |
| **Colour is a label, not decoration** | Each subject owns one token; callouts use five semantic kinds; nothing is coloured "because it looks nice" | Rainbow gradients, coloured text on coloured fills |
| **Soft brutalism** | Hairline structure and soft elevation, but 10–16 px radii, real whitespace, and no clipped or rotated elements | Random stickers, tape, torn paper, rotations |
| **Motion explains** | Motion shows a state change (save, reveal, advance); nothing loops or bounces for effect | Scroll-jacking, parallax, infinite marquees |
| **Accessible by construction** | Every colour pair is documented with its contrast; focus is always visible | Low-contrast pastels on cream |

---

## 3. Colour

### 3.1 Neutral foundation

| Token | Hex | Use | Contrast notes |
|---|---|---|---|
| `--paper` | `#FBF7F0` | Page background | Base |
| `--paper-raised` | `#FFFFFF` | Cards, inputs, popovers | vs ink 17.8:1 |
| `--paper-sunk` | `#F4EDE0` | Section bands, table headers, inset areas | subtle step down |
| `--paper-accent` | `#F1E4CC` | Hero panels, editorial blocks | |
| `--ink` | `#141210` | Text, icons, the 3 px state rules | 17.8:1 on paper |
| `--ink-2` | `#4A423A` | Secondary text | ~9.5:1 on paper |
| `--ink-3` | `#6B6257` | Muted labels, placeholders (use ≥ 14 px medium) | 5.6:1 on paper, 4.8:1 on `--paper-accent` — passes AA on both, do not go lighter |
| `--line` | `#E4DACB` | Card and table edges, dividers, page-section rules | — |
| `--line-strong` | `#C9BCAA` | Inputs, secondary buttons, table-header rule, section rules | — |
| `--line-soft` | `#ECE3D6` | Disabled controls, faint separators | decorative only |

### 3.2 Accents

| Token | Fill | Text on fill | Use |
|---|---|---|---|
| `--cobalt` | `#2B4EFF` | `#FFFFFF` (5.7:1) | Primary actions, links, focus ring |
| `--sunbeam` | `#FFC53D` | `--ink` (11.4:1) | Highlights, "exam tip" callouts, streaks |
| `--leaf` | `#2F7A4F` | `#FFFFFF` (4.9:1) | Success, correct answers |
| `--mint` | `#B7E4C7` | `--ink` | Success surfaces, correct-answer tint |
| `--coral` | `#E23A2B` | `--ink` for ≥ 18 px bold only | Error surfaces, incorrect markers |
| `--coral-ink` | `#A81E14` | — | Error **text** on paper (6.4:1) |
| `--lilac` | `#C9B8FF` | `--ink` | Physics identity, secondary accent |
| `--sky` | `#A9DCF0` | `--ink` | Geography identity, info surfaces |
| `--blush` | `#FFC2D4` | `--ink` | English identity, playful accents |

**Rule:** fills are always paired with `--ink` or white text as documented. Never place `--ink-3` text on a coloured fill. Never use coral for large text blocks.

### 3.3 Subject identity tokens

Each subject gets one identity colour, assigned at creation and unique within an education level (`CONTENT_MODEL.md` §4.3). Cards, chapter chips, topic headers and progress bars inherit it via a CSS variable (`--subject`), so a subject's pages feel branded without hard-coded per-subject CSS.

| Token | Hex | Default assignment |
|---|---|---|
| `--subject-cobalt` | `#2B4EFF` | Maths |
| `--subject-lilac` | `#7C5CFF` | Physics |
| `--subject-leaf` | `#2F7A4F` | Chemistry |
| `--subject-lime` | `#6F9E1F` | Biology (text-safe dark variant of `#8CC63F`) |
| `--subject-blush` | `#C9426A` | English (text-safe dark variant of `#FFC2D4`) |
| `--subject-amber` | `#B4651A` | History |
| `--subject-sky` | `#1F7A9C` | Geography |
| `--subject-plum` | `#6D28D9` | Computer Science |
| `--subject-sunbeam` | `#8A6000` | Economics (text-safe dark variant) |
| `--subject-mauve` | `#8B3FA8` | Psychology |

**Pairing rule:** each token has a `-fill` (a 14 % tint over paper) and a `-ink` (the value above). Badges use `-fill` background + `-ink` text. Large areas use `-fill` only; `-ink` is for text and 1 px accents.

### 3.4 Semantic mapping

| Meaning | Colour | Never |
|---|---|---|
| Primary action | `--cobalt` fill, white text | Cobalt text on cobalt fill |
| Correct answer | `--mint` fill, `--leaf` border, ✓ icon | Green alone (icon + label required) |
| Incorrect answer | `--blush` fill, `--coral` border, ✗ icon | Red text on blush at < 18 px |
| Selected (neutral) | `--sunbeam` fill, `--ink` border | Cobalt for selection (reserved for actions) |
| Disabled | `--paper-sunk` fill, `--ink-3` text, `--line-soft` border | Opacity-only disabling |
| Focus | 3 px `--cobalt` outline, 2 px offset | Removing outlines |

### 3.5 Dark mode

Not in MVP (`OQ-DS1`). Tokens are defined as CSS custom properties on `:root` specifically so a `[data-theme="dark"]` block can be added without touching components.

---

## 4. Typography

### 4.1 Families

| Role | Family | Fallback | Why |
|---|---|---|---|
| Display | **Bricolage Grotesque** (variable, 400–800) | `ui-sans-serif, system-ui` | Tight, slightly quirky grotesque with editorial personality; distinct from default SaaS Inter |
| Body | **Inter** (variable, 400–700) | `ui-sans-serif, system-ui` | Reliable at 17 px, excellent numerals for scores |
| Editorial | **Instrument Serif** (400, italic) | `ui-serif, Georgia` | Pull quotes, topic intros, "why this matters" blocks |
| Mono | **JetBrains Mono** (400–600) | `ui-monospace` | Code, formulas, answer keys in the studio |

Loaded with `next/font` (self-hosted, `display: swap`, subset latin). No Google Fonts CDN request at runtime.

### 4.2 Scale

The three text tokens above `text-xl` are **fluid**: they interpolate with `clamp()` between a phone floor and a desktop cap, so a 390 px phone and a 1440 px laptop both get a deliberate size instead of the same 48 px heading. `text-xs`–`text-xl` stay fixed, because UI chrome, badges and card titles must not shrink on narrow screens.

| Token | Phone floor | Desktop cap | `clamp()` value | Line height | Track/use |
|---|---|---|---|---|---|
| `text-xs` | 12 | 12 | `0.75rem` | 1.4 | +0.01em · badges, meta |
| `text-sm` | 14 | 14 | `0.875rem` | 1.45 | 0 · captions, table cells, helper text |
| `text-base` | 17 | 17 | `1.0625rem` | 1.6 | 0 · **reading body** |
| `text-lg` | 20 | 20 | `1.25rem` | 1.55 | −0.005em · lead paragraphs, card titles |
| `text-xl` | 24 | 24 | `1.5rem` | 1.35 | −0.01em · card titles |
| `text-2xl` | 24 | 30 | `clamp(1.5rem, 1.35rem + 0.65vw, 1.875rem)` | 1.2 | −0.015em · section headings |
| `text-3xl` | 32 | 38 | `clamp(2rem, 1.55rem + 1.9vw, 2.375rem)` | 1.1 | −0.02em · page titles |
| `text-4xl` | 38 | 48 | `clamp(2.375rem, 1.6rem + 3.4vw, 3rem)` | 1.02 | −0.025em · topic/programme titles |
| `text-5xl` | 44 | 64 | `clamp(2.75rem, 1.6rem + 4.6vw, 4rem)` | 0.98 | −0.03em · hero only, one per page |

Display headings use Bricolage at 600–800 with tight tracking. Body never goes below 17 px on content pages (14 px only in UI chrome). The clamping happens in tokens, never in a component: no `text-[2.7vw]` or per-page media queries for type.

### 4.3 Rules

- Maximum line length on content pages: **68 characters** (`max-w-[68ch]`).
- One `text-5xl` per page, in the hero only; content pages start at `text-4xl`.
- No all-caps body text; uppercase is reserved for badges (≤ 3 words) with `+0.06em` tracking.
- Numbers in scores use `font-variant-numeric: tabular-nums`.
- Never centre long-form body text; centre only short CTAs and empty states.

---

## 5. Space, radius, border, elevation

### 5.1 Spacing (4 px base)

`space-1` 4 · `space-2` 8 · `space-3` 12 · `space-4` 16 · `space-5` 20 · `space-6` 24 · `space-8` 32 · `space-10` 40 · `space-12` 48 · `space-16` 64 · `space-20` 80 · `space-24` 96 · `space-32` 128.

Rhythm: inside a component 4–12; between components 16–24; between sections 64–96 (mobile 48–64).

Page gutters and section rhythm are **fluid tokens**, not breakpoint steps (§5.5):

| Token | Value | Actual range | Use |
|---|---|---|---|
| `--gutter` | `clamp(1rem, 0.4rem + 2.4vw, 2rem)` | 16 px at ≤ 400 px, 32 px at ≥ ~1066 px | Inline padding of every shell |
| `--section-y` | `clamp(3rem, 2rem + 4vw, 5rem)` | 48 px at ≤ 400 px, 80 px at ≥ 1200 px | Vertical rhythm between page bands |

A page that needs a different gutter is a page with a layout bug, not a new padding value.

### 5.2 Radius

| Token | Value | Use |
|---|---|---|
| `radius-xs` | 6 px | Badges, chips |
| `radius-sm` | 10 px | Inputs, small buttons |
| `radius-md` | 12 px | **Default**: cards, buttons, question options |
| `radius-lg` | 16 px | Panels, modals, hero cards |
| `radius-xl` | 24 px | Large editorial blocks (one per page max) |
| `radius-full` | 9999 px | Pills, avatars, step dots |

Nothing above 24 px except pills. A page with more than two `radius-xl` surfaces looks like a toy.

### 5.3 Border

Structure is a **1 px warm hairline**. There is no 2 px border token: a heavier rule is a state marker, not a surface edge.

| Token | Use |
|---|---|
| `--line` 1 px | Cards, tables, dividers, sheet edges, page-section rules |
| `--line-strong` 1 px | Inputs, secondary buttons, table-header rule, section rules |
| `--line-soft` 1 px | Disabled controls, faint separators |

Two rules:

- An interactive edge uses `--line-strong`, never `--line`: a control must read as a control at rest, without depending on its shadow.
- 3 px rules are state only — the active tab underline and the studio's active-item inset rule — and the 4 px callout rule is the one decorative left edge. Never draw a 2 px ink border.

The codebase has no `--border-base` / `--border-bold` tokens; do not add them back.

### 5.4 Elevation

Elevation is **soft and neutral**: a wide, low-opacity ink shadow that sits under the surface — never a hard offset and never a coloured glow.

| Token | Value | Use |
|---|---|---|
| `shadow-sm` | `0 1px 2px rgb(20 18 16 / 0.06)` | Cards at rest, badges, the table shell |
| `shadow-md` | `0 1px 3px rgb(20 18 16 / 0.07), 0 10px 24px -16px rgb(20 18 16 / 0.25)` | **Default raised**: hovered cards, sheets, skip links |
| `shadow-lg` | `0 2px 6px rgb(20 18 16 / 0.06), 0 20px 40px -24px rgb(20 18 16 / 0.3)` | Modals and dropdowns |

There is no `shadow-subject`: a subject card carries its identity in the colour band and tint, and uses the same neutral elevation as every other card.

**Interaction convention (important for consistency):**

- Rest: `shadow-sm`, `translate(0,0)`
- Hover: `translate(-1px,-1px)`, `shadow-sm` → `shadow-md` — **pointer-only** (see below)
- Active: `translate(2px,2px)`; the shadow stays as it was
- Disabled: `shadow-none`, `transform-none`, muted fill

One shared `.lift` utility carries this convention for every interactive surface (buttons, card links, subject cards). It is defined in two media blocks:

1. `@media (prefers-reduced-motion: no-preference)` — the 120 ms transition and the `:active` press (`translate(2px,2px)`).
2. `@media (prefers-reduced-motion: no-preference) and (hover: hover) and (pointer: fine)` — the `:hover` lift (`translate(-1px,-1px)`).

**Hover lift is a pointer-only affordance.** On a touch screen `:hover` sticks after a tap, so a tapped row or card stays raised, shifts its neighbours and looks selected. The lift therefore never fires on coarse pointers; `:active` press feedback still fires everywhere, and colour/border/shadow state changes remain on every device. Never re-introduce an ungated `:hover` transform, and never gate it on `@media (hover: none)` as a workaround — gate on the positive capability query.

---

### 5.5 Responsive layout system

The layout is **CSS-first**: fluid tokens do the continuous work, and breakpoints only switch *structure* (sidebar vs sheet, table vs card list) where one form genuinely cannot serve both. No user-agent or touch sniffing, no JS viewport measurement, no breakpoint chosen for a device brand.

#### 5.5.1 Layout tokens

| Token | Value | Use |
|---|---|---|
| `--gutter` | `clamp(1rem, 0.4rem + 2.4vw, 2rem)` | Inline padding for `.shell` and `.shell-narrow` |
| `--section-y` | `clamp(3rem, 2rem + 4vw, 5rem)` | `.section-y` vertical rhythm |
| `--shell-max` | `1240px`, `1360px` at ≥ 1536 px | Public content shell |
| `--studio-max` | `1120px`, `1180px` at ≥ 1536 px | Studio content column beside the sidebar |
| `--sidebar-w` | `264px` | Studio sidebar track |

Layout utilities, used instead of per-page padding classes:

- `.shell` — `max-width: var(--shell-max)`, centred, `padding-inline: var(--gutter)`. Every public page and header/footer uses it.
- `.shell-narrow` — the same padding at an 820 px measure, for auth screens and readers.
- `.section-y` — `padding-block: var(--section-y)`.
- `.card-grid` — `repeat(auto-fit, minmax(min(100%, 17rem), 1fr))` with fluid gap: intrinsic column count, so the same list is right in a wide shell and in the studio's narrower column. `min(100%, …)` guarantees one column never overflows its container.
- `.table-shell` / `.data-table` — §9.9.
- `.subject-card` — container query, §5.5.3.

**Wide screens get more measure, not more margin.** At ≥ 1536 px both shells grow (1240 → 1360, 1120 → 1180) because there is room for a fourth card at its natural width; a 1920 px display must not render a 1240 px page with 340 px of empty paper on each side.

#### 5.5.2 Breakpoint rationale

Breakpoints are content thresholds, not framework defaults that happened to fit. Tailwind v4 defaults are retained so the codebase has one set of names.

| Width | Name | What changes | Why there |
|---|---|---|---|
| 320 px | — | Floor: single column, 16 px gutters, no horizontal scroll, cards stack, studio gets the top bar + sheet | Smallest viewport the product supports |
| 400 px | — | `--gutter` starts growing past 16 px | Below this, 16 px is already the right proportion |
| 640 px (`sm`) | small | Card padding steps 20 → 24 px; two-up grids become possible | Enough width for a card to breathe |
| 768 px (`md`) | medium | **Every studio table becomes a card list**; studio main padding steps up | A real six-column table can no longer fit a legible row |
| 1024 px (`lg`) | large | **Studio sidebar (264 px) appears and the mobile sheet disappears**; table cell padding widens; studio content gets the two-column grid | Sidebar + a ≥ 740 px content column, both usable |
| 1280 px (`xl`) | extra large | Question **Type** column appears in the table | First width where the extra column does not crowd the title |
| 1536 px | wide | `--shell-max` and `--studio-max` grow | Room for a fourth card without shrinking the others |

Nothing switches at a width because a device is expected there; each rule above is tied to the content that must fit.

#### 5.5.3 Container queries

`SubjectCard` is the one component that must look right at two very different widths in the same viewport (three-up on the homepage shell, two-up inside the studio column). It therefore sets `container-type: inline-size` and responds to **its own** width: at ≤ 18 rem the body padding drops 24 → 16 px, the gap 20 → 14 px, and the title 20 → 17 px. The rule lives in `@layer components` because a Tailwind utility outside that layer would silently override it.

Use a container query, not a media query, whenever a component's correct layout depends on the space it is given rather than on the screen width.

---

## 6. Iconography and illustration

**Icons:** one set only (Lucide or equivalent stroke set), 1.75 px stroke, 20/24 px sizes, `currentColor`. Icons never carry meaning alone — always paired with text or an `aria-label`.

**Subject icons:** a fixed registry of 16 icons (`atom`, `flask`, `leaf`, `sigma`, `book-open`, `landmark`, `globe`, `terminal`, `chart-line`, `brain`, `music`, `language`, `calculator`, `microscope`, `briefcase`, `palette`). Referenced by `icon_key`; an unknown key falls back to `book-open`.

**Illustrations:** flat, two-colour, thick-outline line art with the palette above (one accent + ink + paper). Deliberately hand-drawn-feeling geometry: circles, arrows, diagrams, notebooks, particles, graphs. Rules:

- Max one hero illustration per page.
- Illustration text must be real text in the DOM, not baked into the image.
- Decorative illustrations are `aria-hidden="true"`; functional diagrams have alt text.
- No 3D renders, no gradients, no stock photos, no generic "diverse students around a laptop".

Empty states use a small illustration (≤ 160 px) plus a sentence and one action.

---

## 7. Motion

Library: **Motion** (`motion/react`), used client-side only where a state change needs explaining.

| Interaction | Spec |
|---|---|
| Answer select | Scale 1 → 0.98 → 1 over 140 ms; border colour change |
| Option reveal (review) | Height/opacity 180 ms, `ease-out` |
| Question advance | 160 ms opacity + 8 px x-translate; no 3D flip |
| Progress fill | Width 240 ms `ease-out` |
| Toast | 180 ms in, 120 ms out |
| Dialog | 160 ms scale 0.98→1 + opacity |
| Hover lift | 120 ms, 1 px translate + shadow step — pointer-only (`hover: hover` + `pointer: fine`) |

Rules:
- Durations: 120 ms (micro), 180 ms (standard), 240 ms (emphasis). No transition above 320 ms.
- Easing: `cubic-bezier(0.2, 0.6, 0.2, 1)`. No bounce, no spring overshoot, no elastic.
- `prefers-reduced-motion: reduce` removes transforms and reduces all durations to 0.01 ms while keeping state changes instant and visible.
- Never animate layout properties that cause reflow on long lists; use opacity/transform only.
- No animation on page load beyond the hero's 240 ms fade+rise, which must not delay LCP text.

---

## 8. Tokens in code

```css
/* app/globals.css — source of truth for token values */
:root {
  --paper: #FBF7F0;
  --paper-raised: #FFFFFF;
  --paper-sunk: #F4EDE0;
  --paper-accent: #F1E4CC;

  --ink: #141210;
  --ink-2: #4A423A;
  --ink-3: #6B6257;
  --line: #E4DACB;
  --line-strong: #C9BCAA;
  --line-soft: #ECE3D6;
  --shadow-color: #E8DFD1; /* flat fill behind hero line art (§6) */

  --cobalt: #2B4EFF;
  --sunbeam: #FFC53D;
  --leaf: #2F7A4F;
  --mint: #B7E4C7;
  --coral: #E23A2B;
  --coral-ink: #A81E14;
  --lilac: #C9B8FF;
  --sky: #A9DCF0;
  --blush: #FFC2D4;

  --radius-xs: 6px;
  --radius-sm: 10px;
  --radius-md: 12px;
  --radius-lg: 16px;
  --radius-xl: 24px;

  --shadow-sm: 0 1px 2px rgb(20 18 16 / 0.06);
  --shadow-md:
    0 1px 3px rgb(20 18 16 / 0.07), 0 10px 24px -16px rgb(20 18 16 / 0.25);
  --shadow-lg:
    0 2px 6px rgb(20 18 16 / 0.06), 0 20px 40px -24px rgb(20 18 16 / 0.3);

  /* No --border-* tokens: structure is a 1 px hairline (§5.3). */

  /* Adaptive layout (§5.5). Fluid by default; breakpoints only change structure. */
  --gutter: clamp(1rem, 0.4rem + 2.4vw, 2rem);
  --section-y: clamp(3rem, 2rem + 4vw, 5rem);
  --shell-max: 1240px;
  --studio-max: 1120px;
  --sidebar-w: 264px;
}

/* Wide displays get more measure, not more margin (§5.5.1). */
@media (min-width: 1536px) {
  :root {
    --shell-max: 1360px;
    --studio-max: 1180px;
  }
}

/* Fluid display type (§4.2): the clamp lives in the token, never in a component. */
@theme inline {
  --text-2xl: clamp(1.5rem, 1.35rem + 0.65vw, 1.875rem);
  --text-3xl: clamp(2rem, 1.55rem + 1.9vw, 2.375rem);
  --text-4xl: clamp(2.375rem, 1.6rem + 3.4vw, 3rem);
  --text-5xl: clamp(2.75rem, 1.6rem + 4.6vw, 4rem);
}
```

Tailwind theme mapping (Tailwind v4 `@theme` or v3 `theme.extend`):

```ts
// tailwind.config.ts (excerpt)
theme: {
  extend: {
    colors: {
      paper: { DEFAULT: 'var(--paper)', raised: 'var(--paper-raised)', sunk: 'var(--paper-sunk)', accent: 'var(--paper-accent)' },
      ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
      line: { DEFAULT: 'var(--line)', strong: 'var(--line-strong)', soft: 'var(--line-soft)' },
      cobalt: 'var(--cobalt)', sunbeam: 'var(--sunbeam)', leaf: 'var(--leaf)',
      mint: 'var(--mint)', coral: 'var(--coral)', lilac: 'var(--lilac)', sky: 'var(--sky)', blush: 'var(--blush)',
    },
    borderRadius: { xs: '6px', sm: '10px', md: '12px', lg: '16px', xl: '24px' },
    boxShadow: {
      sm: '0 1px 2px rgb(20 18 16 / 0.06)',
      md: '0 1px 3px rgb(20 18 16 / 0.07), 0 10px 24px -16px rgb(20 18 16 / 0.25)',
      lg: '0 2px 6px rgb(20 18 16 / 0.06), 0 20px 40px -24px rgb(20 18 16 / 0.3)',
    },
    fontFamily: {
      display: ['var(--font-bricolage)', 'ui-sans-serif'],
      sans: ['var(--font-inter)', 'ui-sans-serif'],
      editorial: ['var(--font-instrument)', 'ui-serif'],
      mono: ['var(--font-jetbrains)', 'ui-monospace'],
    },
  },
}
```

**Rules:** components consume tokens, never raw hex. A hex value inside a component is a review-blocking defect. Subject colours are applied by setting `--subject-ink` / `--subject-fill` on a wrapper from `color_token`.

---

## 9. Component inventory

Each component lists anatomy, variants and constraints. Implementations live in `components/ui` (primitives) and `components/patterns` (composed).

### 9.1 Button

- **Anatomy:** label (required), optional leading icon, optional trailing icon.
- **Variants:** `primary` (cobalt fill, white text), `secondary` (paper-raised fill, ink border, ink text), `sunbeam` (highlight CTA, ink text), `ghost` (no border until hover), `danger` (paper-raised fill, coral border + coral-ink text).
- **Sizes:** `sm` (h 36, px 12, text-sm), `md` (h 44, px 16, text-base), `lg` (h 52, px 24, text-lg).
- **States:** rest / hover / active / focus-visible / disabled / loading (spinner replaces the leading icon, label becomes "Saving…" or stays — never both a spinner and an unchanged label).
- **Rules:** one `primary` per viewport region; icon-only buttons require `aria-label`; loading disables the button and prevents double submit.

### 9.2 Answer option (the signature component)

- **Anatomy:** option label badge (A/B/C…), content, optional result icon, optional feedback.
- **Variants:** `choice` (radio semantics), `multi` (checkbox semantics), `short-answer` (textarea), `review-correct`, `review-incorrect`, `review-missed` (the correct option the student did not pick).
- **Spec:** `radius-md`, 1 px `--line` edge, `shadow-sm` at rest; selected = sunbeam fill; correct = mint fill + leaf border + ✓; incorrect = blush fill + coral border + ✗. Min height 64 px, full width, content left-aligned, generous 16 px padding, no truncation.
- **Accessibility:** the group is a `fieldset` with a `legend` (the question stem); options are real `input[type=radio|checkbox]` visually hidden but focusable, with a visible focus ring on the card. Keyboard: arrows move within the group, space/enter selects.
- **Anti-pattern:** cards that only change border colour on hover, or that animate on scroll.

### 9.3 Badge / Pill

- `Badge`: uppercase, `text-xs`, `radius-xs`, 1 px border in a tint of its fill, ink text. Variants: `status-draft` (paper-sunk), `status-review` (sunbeam), `status-published` (mint), `status-archived` (line-soft), `difficulty-easy|medium|hard|very-hard` (leaf → sunbeam → coral tint ramp), `subject` (subject tint), `type` (paper-raised), and the three **format** variants below.
- `FormatBadge`: the one component allowed to describe content shape. `format-study` (paper-raised, book icon, "Study material"), `format-lesson` (sunbeam fill, ink border, layered icon, "Lesson + practice"), `format-test` (cobalt tint, timer icon, "Practice test"). Never colour-only: each has a distinct icon and label. A page must not invent a fourth label.
- Max 3 words. Never a badge without text.

### 9.4 Card

- `SubjectCard`: subject colour band (8 px) on the top edge, icon, name, level label, chapter/topic counts, hover lift. Whole card is a link with a single accessible name.
- `ChapterRow`: number, title, summary, topic count, availability dots, chevron.
- `TopicCard`: title, summary, format badges, estimated minutes, resource/assessment counts.
- `ResourceCard`: title, subtitle, `FormatBadge`, reading minutes, difficulty dot, chevron.
- `AssessmentCard`: title, `FormatBadge`, question count, duration (or "instant feedback"), mode icon.
- `StatCard`: big number (tabular), label, optional delta — used on the dashboard only.
- Spec: paper-raised fill, 1 px `--line` edge, `radius-md`, `shadow-sm` at rest and `shadow-md` on hover; padding 20–24 px; no nested cards (use paper-sunk insets instead).

### 9.5 Callout

Five semantic kinds mapping to `CONTENT_MODEL.md` §5.1: `tip` (sunbeam), `warning` (coral tint + coral-ink heading), `example` (paper-accent + ink), `examtip` (cobalt tint + cobalt heading), `definition` (mint). Always: icon + label text ("Exam tip") + body. Left border 4 px in the kind colour, paper-raised fill, `radius-sm`.

### 9.6 Form controls

- `TextInput` / `Textarea` / `Select`: paper-raised, 1 px `--line-strong` edge, `radius-sm`, h 44 (textarea auto-grow), 12 px padding. Focus: cobalt 3 px outline offset 2 px. Error: coral border + icon + message below, `aria-describedby` linked.
- `FormField`: label (always visible, never placeholder-only), optional hint, error slot, required marker.
- `Checkbox` / `Radio` / `Switch`: 20 px box with an ink hairline edge; checked = cobalt fill + white tick.
- Rule: validation messages appear **below** the field and are announced via `aria-live="polite"`.

### 9.7 Navigation

- `Header`: 72 px tall (64 mobile), paper background with a 1 px `--line` bottom rule, logo left, nav centre-left, search + account right. Sticky with a shadow that appears only after 8 px of scroll.
- `Breadcrumbs`: `text-sm`, `ink-2`, `/` separators (not `>`), current page in `ink` with `aria-current`.
- `Tabs`: underline-style with a 3 px ink underline on the active tab; used for topic hub sections and studio editors.
- `Sidebar` (studio): **264 px** (`--sidebar-w`), paper surface, 1 px right rule, grouped links (Content / Library / Governance), active item = paper-sunk fill + 3 px inset ink rule + `aria-current="page"`. It is persistent — sticky, full viewport height, independently scrolling — from **1024 px** (`lg`) up. It never shrinks into an icon rail: below 1024 px it is replaced by a sheet.
- `StudioMobileMenu` (the studio sheet, below 1024 px): a sticky 64 px top bar with the wordmark and a 44 × 44 menu button, opening a full-width sheet docked under the bar (`max-height: calc(100dvh − 4rem)`, scrollable, `shadow-md`) over an ink-tinted scrim. It is a native `<details>` with Escape, outside-click and route-change dismissal, so it works without JavaScript. No focus trap is claimed for it; it is a disclosure, not a modal dialog.
- `QuestionPalette`: numbered grid, states: current (ink border + cobalt), answered (sunbeam), unanswered (paper), flagged (dashed). Shown as a bottom sheet under 768 px.

### 9.8 Feedback

- `ProgressBar`: 10 px tall, `paper-sunk` track, `radius-full` fill in the subject colour, `role="progressbar"` with `aria-valuenow/min/max` and an accessible label.
- `Toast`: bottom-right (desktop) / top (mobile), `shadow-lg`, 4 s auto-dismiss, dismiss button, `role="status"`.
- `Dialog`: paper-raised, 1 px `--line` edge, `radius-lg`, `shadow-lg`, focus trapped, `Esc` closes, returns focus to the trigger.
- `EmptyState`: illustration ≤ 160 px, heading, one sentence, primary action, optional secondary link.
- `Skeleton`: paper-sunk blocks matching the final layout footprint exactly (no shift on load).

### 9.9 Data table (studio)

- Header band: `paper-sunk`, `text-xs` uppercase. It is deliberately **not** sticky — the table's only scroll container is the wrapper's `overflow-x`, so a sticky header would never travel with the page; a real sticky header would need a vertical scroll container, which no studio table has.
- Column types: text, badge, date (relative + absolute on hover), user, actions (icon buttons).
- Sort indicators on sortable headers; pagination is cursor-based with "Load more" (not numbered pages).
- **Table → card switch at 768 px (`md`).** Below it every studio table is replaced by a `ul` card list (`md:hidden` list + `hidden md:block` table shell): one card per row, the record's primary line, its metadata as label/value pairs, and the row actions as full-size buttons. Above it the real `<table>` renders inside `.table-shell` (rounded, 1 px border, `overflow-x: auto` with `overscroll-behavior-x: contain`). Both representations are always in the DOM; the CSS decides which is visible, so nothing depends on JavaScript measuring the viewport.
- Neither representation may cause horizontal scrolling for primary content. Column count is reduced before scrolling is allowed: the question **Type** column is hidden until `xl` (1280 px), and cell padding tightens below `lg` (1 rem inline at ≥ 1024 px, 0.75 rem below). The stretched table must fit its card at 768 px and at 1024 px — measured `scrollWidth === clientWidth`.
- Never render the same row twice visibly, and never duplicate interactive controls inside both representations without unique labels: the hidden one must be truly hidden (`display: none`), so it is out of the accessibility tree and tab order.

### 9.10 Studio editors

- Split-pane markdown editor (desktop 50/50, toggle on mobile), monospace source with a light toolbar (heading, bold, list, table, callout, image).
- Save state line: `Saving… • Saved 12:04 • Unsaved changes • Offline`.
- Publish checklist panel: blocking items (coral), warnings (sunbeam), passing (leaf), each with a jump link.
- Question editor: the type selector is a segmented control at the top; changing it warns that answer fields will reset.
- Block editor: a vertical block list with a drag handle, a per-block inline toolbar, and an "insert block" control between blocks (`text`, `heading`, `image`, `formula`, `table`, `callout`, `video`, `download`, `question section`, `related material`). Blocks are cards on `paper-raised` with 1 px `--line` separators; the selected block gets a cobalt left rule. No free-form canvas, no nested blocks.
- Assessment composer: ordered item list with points override, mode segmented control, duration field that appears only for `test`/`mock`, and a live scope warning when a question is outside the topic.

### 9.11 Search and autocomplete

- `SearchField`: 44 px, paper-raised, 1 px `--line-strong` edge, magnifier icon, `⌘K`/`Ctrl K` hint on desktop, clear button when non-empty.
- `SuggestList`: paper-raised, `shadow-md`, max 8 rows, 44 px each; each row = icon + display term + muted subject name; active row = sunbeam fill + ink border; keyboard hint footer (↑↓ to move, ↵ to open, esc to close).
- Highlighting: matched prefix wrapped in a `mark` with sunbeam tint (never bold-only).
- `SearchResults`: grouped sections with sticky group labels, each row showing `FormatBadge` + breadcrumb. "Did you mean …?" appears above results as a bordered chip, never as a modal.
- Degraded state: a small inline note "Fewer results than usual — showing text matches only", `role="status"`.
- Empty query state: recent searches (if any) + popular subjects; no blank panel.

---

## 10. Accessibility requirements (normative)

| Requirement | Value |
|---|---|
| Body text contrast | ≥ 4.5:1 (all pairs documented in §3) |
| Large text (≥ 24 px / 19 px bold) | ≥ 3:1 |
| Non-text UI (borders of inputs, icons) | ≥ 3:1 against adjacent colour |
| Focus indicator | 3 px cobalt outline, 2 px offset, never removed |
| Touch targets | ≥ 44 × 44 px, ≥ 8 px spacing |
| Text resize | Usable at 200 % zoom and 150 % text-only |
| Motion | Respect `prefers-reduced-motion`; no parallax |
| Colour independence | Every state also has an icon and/or text label |
| Keyboard | Every interactive element reachable; modal focus trap; skip-link to main |
| Screen reader | Landmarks (`header/nav/main/footer`), one `h1` per page, ordered headings, `aria-live` for async status |

Contrast is verified at implementation time with an automated check, but the **pairs in §3 are the contract**; a component that uses an undocumented pair is unverified.

---

## 11. Do / Don't

| Do | Don't |
|---|---|
| One bold display heading, then quiet body text | Three competing headline styles |
| 1 px hairlines, weighted `--line` → `--line-strong` for controls | Borders on every row of text |
| Soft neutral shadows on 1–2 levels | Glows, coloured shadows, glass panels |
| One accent colour per section plus subject colour | Multiple accent gradients |
| 12 px card radius with 20–24 px padding | 32 px radius with 8 px padding |
| Illustrations that explain the topic | Generic decorative blobs and floating shapes |
| Motion that shows a state change | Entrance animations on every section |
| Whitespace between sections (64–96 px) | Dense edge-to-edge content walls |
| Sentence case everywhere | Title Case In Every Label |
| Icons with labels | Icon-only navigation |

---

## 12. Dependencies

- Consumed by every UI phase; Phase 1 must ship tokens + primitives before content pages.
- Subject `color_token` values come from `subjects.color_token` (`DATABASE_SCHEMA.md` §5.4) and must match the token registry keys exactly.
- Callout kinds must match `CONTENT_MODEL.md` §5.1.
- Badge difficulty ramp must match the `difficulty` enum.

---

## 13. Edge cases

| # | Case | Behaviour |
|---|---|---|
| DS-01 | Subject has no `color_token` (legacy row) | Fallback `--subject-cobalt`; studio flags it for repair |
| DS-02 | Two subjects in a level pick the same colour | Blocked at save; the picker disables taken colours |
| DS-03 | Very long subject name in a card | 2-line clamp with ellipsis; the full name is in the link's `title` and accessible name |
| DS-04 | User forces dark mode at OS level | App stays light (MVP); no `prefers-color-scheme` override, so no half-styled screens |
| DS-05 | Reduced motion | Transforms removed; state changes still marked by colour + icon + text |
| DS-06 | Windows high-contrast | Borders remain visible because they are real borders, not shadows |
| DS-07 | Print a material page | Print stylesheet: hide nav/CTAs, black text on white, borders simplified to 1 px |
| DS-08 | 320 px viewport | Single column, 16 px gutters, no horizontal scroll; palette becomes a sheet |
| DS-09 | Zoom 200 % | No fixed heights on text containers; header collapses to a menu |
| DS-10 | Missing font (offline/blocked) | Fallback stacks keep hierarchy via weight and size |

---

## 14. Acceptance criteria

1. Tokens exist as CSS custom properties and are mapped into the Tailwind theme; no component contains a raw hex value.
2. Every colour pair used in a component appears in §3 with a documented ratio; an automated contrast check passes for text and UI borders.
3. The button, answer option, input, card, badge, callout, dialog and progress bar primitives exist with the documented variants and states.
4. Every interactive element has a visible focus style at 3 px cobalt with 2 px offset.
5. Answer options are keyboard-operable with radio/checkbox semantics and pass a screen-reader smoke test.
6. Motion respects `prefers-reduced-motion` and no animation exceeds 320 ms.
7. The reduced-motion and 200 % zoom builds remain usable with no clipped text.
8. A subject card renders in its subject colour purely from `--subject-*` variables, with no per-subject CSS.
9. The print stylesheet produces a readable material page.
10. A visual review against §2's principles rejects any gradient, glass panel, coloured glow, hard offset shadow or rotation.
11. Every page's horizontal padding comes from `--gutter` and its vertical rhythm from `--section-y`; no page hard-codes `px-4`, `py-24` or a similar fixed value at the shell level.
12. `documentElement.scrollWidth − clientWidth` is 0 at 320, 360, 390, 414, 480, 768, 1024, 1280, 1440 and 1920 px on `/`, `/subjects`, the studio library and the studio editor.
13. Below 768 px no studio table is visible and its card list is; above 768 px the reverse. The visible representation fits its container without horizontal scrolling.
14. Display type uses the clamped `text-2xl`–`text-5xl` tokens; no component sets a viewport-relative font size or a per-page type media query.
15. No `:hover` transform applies on a coarse pointer: the lift is inside `(hover: hover) and (pointer: fine)`, and `:active` press feedback still applies on touch.
16. The studio sidebar is exactly `--sidebar-w` (264 px), persists from 1024 px, and is replaced below that by the sheet menu — never by a collapsed icon rail.

---

## 15. Open questions

| # | Question | Impact |
|---|---|---|
| OQ-DS1 | Is dark mode required within 12 months? | Token structure already supports it; QA effort not scheduled — **Open — needs:** decide whether dark mode ships within 12 months; **blocks Phase 7**. |
| OQ-DS2 | Do we license Bricolage Grotesque / Instrument Serif, or substitute open alternates (e.g. Archivo, Fraunces)? | Licensing & brand feel — **Open — needs:** confirm font licences or choose open alternates; **blocks Phase 1**. |
| OQ-DS3 | Is a custom illustration set commissioned, or do we start with two-colour generated line art? | Phase 1 asset plan — **Open — needs:** decide commissioned vs generated illustration set; **blocks Phase 1**. |
| OQ-DS4 | Should subject colour assignment be editorial or automatic round-robin? | Currently: chosen at creation, unique per level — **Open — needs:** decide editorial vs automatic subject colours; this also settles the `color_token` uniqueness conflict; **blocks Phase 2**. |
| OQ-DS5 | Is a marketing-specific hero treatment (larger type, more illustration) needed beyond the content design system? | Homepage design scope — **Open — needs:** decide whether the homepage needs a marketing hero beyond the design system; **blocks Phase 1**. |

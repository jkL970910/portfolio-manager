# Interface Design System

## Purpose

This file is the persistent design memory for Loo国的财富宝库.

Use it before building or changing any product UI. The goal is consistency, not novelty.

## Product Fit

- Product type: portfolio decision support application
- Domain: personal investing, portfolio analysis, spending visibility
- Brand name: Loo??????
- Tone: warm, reassuring, analytical, premium, softly playful
- Avoid: generic budgeting-app aesthetics, childish cartoon UI, dark-mode-first styling

## Core Direction

- Visual direction: iOS-16-inspired liquid glass layered over a pastel wealth dashboard
- Layout style: dense but readable dashboards, clear visual grouping, low-noise surfaces
- Interaction style: explicit, calm, low motion, polished transitions
- Mascot strategy: use an original Loo companion presence in branding, onboarding, empty states, and summaries; do not insert mascot noise into dense analytical tables
- Reuse bias: extend existing components before creating new ones

## Tokens

### Colors

- `--background`: `#f7f4fb`
- `--foreground`: `#2a2239`
- `--muted-foreground`: `#6e6782`
- `--card`: `rgba(255,255,255,0.58)`
- `--card-muted`: `rgba(255,255,255,0.42)`
- `--border`: `rgba(255,255,255,0.58)`
- `--ring`: `#8ba8ff`
- `--primary`: `#f08fb2`
- `--primary-soft`: `rgba(240,143,178,0.18)`
- `--secondary`: `#6f8df6`
- `--success`: `#3aa47a`
- `--warning`: `#d4933d`
- `--danger`: `#d56578`

### Radius

- Primary card radius: `28px`
- Header shell radius: `32px`
- Pill/button radius: `9999px`
- Input radius: `20px` to `24px`

### Shadows

- `--shadow-soft`: floating shell, large glass surfaces
- `--shadow-card`: normal cards, pills, active toggles
- Depth comes from blur + contrast + edge light, not heavy dark shadows

### Typography

- Font family: Nunito Sans
- Page title: `32px`, semibold
- Section title: `24px`, semibold
- Card title: `18px`, semibold
- Body copy: `14px` to `16px`
- Supporting copy: muted foreground, comfortable line-height

## Layout Rules

- Primary max width: `1440px`
- Page shell uses a floating top header plus a content column below
- Dashboard and portfolio pages favor 2-column and 4-card analytical layouts
- Avoid full-width uncontrolled content blocks inside the main shell
- Use `space-y-*` and grid gaps consistently; prefer `4`, `5`, `6`

## Surface Rules

- Default surface: translucent glass card with blur, border light, soft shadow
- Secondary surface: lighter frosted treatment for grouped content and inline explanation
- Header/nav surface: pastel glass shell with internal color bloom, not a solid dark slab
- Popovers: floating white glass, medium blur, short copy only

## Component Rules

### Button

- Always use `components/ui/button.tsx` first
- Primary action: pink-blue gradient pill
- Secondary action: frosted neutral glass
- Ghost action: text-first with soft hover wash
- Do not invent page-specific one-off button styles unless the pattern is promoted back into the shared button

### Card

- Always start from `components/ui/card.tsx`
- Header padding: `px-6 pt-6`
- Content padding: `px-6 pb-6 pt-4`
- Keep card interiors structured; avoid dumping unrelated sections into a single card

### Badge

- Use for compact status only
- Variants already available: `primary`, `success`, `warning`, `neutral`
- Do not use badges as decorative noise

### Navigation

- Use pill navigation with clear active state
- Global display-currency explanation belongs in the toggle popover, not repeated in page bodies
- Header remains sticky and slightly compresses on scroll

### Finance-Specific UI

- Money values must respect display currency rules
- If a value is fixed to planning-base CAD, label it explicitly
- If a value is a global display amount, do not append hard-coded CAD copy
- Native currency and display currency are different concerns; do not blur them in labels

## Reuse Policy

Before creating a new component:

1. Check `components/ui`
2. Check domain-specific folders under `components/`
3. If an existing component is 80% correct, extend it instead of cloning it
4. If a new shared pattern is needed, add it to the component library docs

## Anti-Patterns

- Do not reintroduce repeated FX explanation cards inside page bodies
- Do not create duplicate versions of cards, buttons, or badges for one page
- Do not hard-code `CAD` into user-facing labels unless the field is genuinely CAD-based
- Do not use decorative gradients, glows, or motion that reduce data clarity
- Do not mix surface depths randomly

## New Component Checklist

Before adding a new reusable component:

1. Define its purpose in one sentence
2. Decide whether it belongs in `ui`, `navigation`, `charts`, or a domain folder
3. Reuse existing tokens only
4. Keep props minimal
5. Add it to `docs/ui/component-library.md`
6. Add or update its entry in `docs/ui/component-inventory.md`


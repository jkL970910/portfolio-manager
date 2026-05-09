# Flutter Component Inventory Direction

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-05-08

## Purpose

This inventory is no longer a long-term catalog of web React components. It now defines the Flutter component categories that should absorb the existing product behavior during migration.

The current React component tree remains useful as a behavior reference, not as the final UI target.

The active v2 visual/component source is
`docs/ui/mobile-ui-v2-figma-plan.md` and the Figma design file
`https://www.figma.com/design/aYsiPJ8eybrWa6BcY1peIn`.

## Core Flutter Component Groups

### App Shell

- bottom navigation shell
- page header pattern
- floating action / primary CTA pattern
- modal / bottom sheet pattern
- theme mode controller (`system` / `light` / `dark`)
- global floating AI 大臣 entry

### Data Display

- metric card
- decision card
- compact status badge
- info row
- stat block
- empty state panel
- quote provenance row
- key-value table
- dense tappable list row

### Charts

- trend chart card
- donut / allocation chart
- health radar chart
- compact mini-trend

### Portfolio

- account summary tile
- account detail hero
- holdings list row
- unified symbol detail scaffold
- watchlist toggle
- candidate score panel
- maintenance action sheet
- research cockpit decision surface

### Recommendations

- recommendation summary card
- recommendation detail card
- scenario compare card
- recommendation run trigger

### Import

- workflow option card
- import stepper
- mapping review row
- validation issue card
- correction action card

### Settings and Identity

- preference summary card
- allocation editor
- watchlist editor
- citizen archive card
- Loo皇 identity approval modal
- AI provider settings card
- FX/source/provider status card
- worker status card

## UI v2 Component Rules

- Build shared Flutter components before rewriting page-specific layouts.
- Tappable account/holding/watchlist rows should use the full row/card as the
  hit target.
- Do not add small detail arrows when the whole card is tappable.
- Avoid intrusive row badges such as `已更新` / `未持有`; use subtle metadata or
  move status into detail pages.
- Do not use internal words such as `cache`, `provider`, `fallback`, `DTO`, or
  raw worker labels in primary user-facing components.
- Charts and radar cards must reserve enough label space on narrow phones.
- Components must support both `Rose Treasury` dark and `Rose Day` light theme
  tokens.

## Migration Rule

When porting a web component:

1. preserve product behavior
2. redesign the interaction for mobile if needed
3. do not preserve desktop layout assumptions by default
4. keep Chinese-only copy and Loo皇 tone

## Design Reference Rule

`awesome-design-md` may inform the Flutter visual direction, but the resulting component system still needs to serve:

- compact mobile reading
- financial information clarity
- strong branded identity
- staged disclosure for dense portfolio data

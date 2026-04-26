# Flutter Component Inventory Direction

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-04-25

## Purpose

This inventory is no longer a long-term catalog of web React components. It now defines the Flutter component categories that should absorb the existing product behavior during migration.

The current React component tree remains useful as a behavior reference, not as the final UI target.

## Core Flutter Component Groups

### App Shell

- bottom navigation shell
- page header pattern
- floating action / primary CTA pattern
- modal / bottom sheet pattern

### Data Display

- metric card
- status badge
- info row
- stat block
- empty state panel
- quote provenance row

### Charts

- trend chart card
- donut / allocation chart
- radar preview
- compact mini-trend

### Portfolio

- account summary tile
- account detail hero
- holdings list row
- unified symbol detail scaffold
- watchlist toggle
- candidate score panel
- maintenance action sheet

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

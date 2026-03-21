---
name: interface-design-codex
description: Use when extending or refactoring Portfolio Manager UI and you need to preserve design consistency, reuse the in-repo component library, apply the project's saved interface system, and avoid creating one-off components or drifting design decisions across sessions.
---

# Interface Design Codex

This skill governs UI work for Portfolio Manager.

Use it for:
- new pages
- page redesigns
- component extraction
- design system cleanup
- UI consistency reviews

Do not use it for backend-only work.

## Workflow

1. Read `.interface-design/system.md`
2. Read `docs/ui/component-library.md`
3. Read `docs/ui/component-inventory.md`
4. Inspect the nearest existing component before creating anything new
5. Reuse or extend an existing component if possible
6. If a new shared component is introduced, update both UI docs before finishing

## Rules

- Default to the current in-repo design system, not generic Tailwind output
- Do not create page-specific clones of shared primitives
- Prefer extracting repeated inline patterns into shared components
- Preserve the product's current tone: analytical, trustworthy, calm, enterprise-fintech
- Keep display-currency logic and planning-base currency language precise

## Component Decision Rule

Before creating a new component, explicitly decide which of these is true:

1. Existing shared component already fits
2. Existing shared component can be extended safely
3. A new domain component is needed
4. A new shared component is justified

Bias toward `1` or `2`.

## Update Rule

Whenever you add a new shared component or materially change a shared pattern:

1. Update `docs/ui/component-library.md`
2. Update `docs/ui/component-inventory.md`
3. If the design rule changed, update `.interface-design/system.md`

## Portfolio Manager Specific Guidance

- Dashboard, Portfolio, Recommendations, Spending, Import, and Settings should feel like one system
- Finance-specific patterns belong in domain folders until they are reused enough to extract
- Sticky header, display-currency control, and shared card surfaces are part of the global language
- Avoid repeating explanatory FX cards inside page bodies when the navigation-level control already owns that explanation

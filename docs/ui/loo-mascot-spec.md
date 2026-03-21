# Loo Mascot Spec

## Goal

Create an original mascot for Loo国的财富宝库 that keeps a soft pink, slightly cheeky emotional tone without reproducing an existing IP silhouette.

## Character Role

- Name: `Loo`
- Role: treasure-vault guide, onboarding helper, soft nudge companion
- Product purpose:
  - reduce intimidation during setup and import
  - give the dashboard a memorable emotional anchor
  - appear in summaries, empty states, and success feedback
  - stay out of dense analytical tables

## Shape Rules

- Use a head-and-body unified droplet silhouette, not a round-copy cartoon beaver body
- Keep the ears small and low-contrast
- Use a compact jewel-like nose, not a large vertical oval nose
- Keep only one small buck tooth
- Treat the tail like a stylized treasure-stamp tail, not a literal flat beaver tail
- Cheeks should read as soft blush puffs, not oversized identical cheek pads

## Expression Rules

- Main emotional space:
  - calm guide
  - sly smirk
  - side-eye review
  - proud success
- Eyebrows do most of the attitude work
- Mouth expressions should stay compact and readable at small sizes
- Avoid exaggerated anime reactions

## Color Rules

- Primary body pink: soft gradient pink, not a flat saturated toy pink
- Belly: warm pale blush / ivory
- Nose: berry-plum
- Outline strategy: mostly outline-free body, with dark facial features only
- Tail: slightly deeper mauve-pink than the body

## Usage Rules

Use Loo in:
- login and register hero sections
- dashboard welcome / summary areas
- import entry and empty states
- success and review cards

Avoid Loo in:
- holdings tables
- diagnostic tables
- dense portfolio analytics surfaces
- recommendation ranking rows

## Current Component

- Reusable SVG component:
  - [loo-mascot.tsx](E:\Projects\Portfolio%20Manager\components\brand\loo-mascot.tsx)
- User-supplied static asset wrapper:
  - [mascot-asset.tsx](E:\Projects\Portfolio%20Manager\components\brand\mascot-asset.tsx)
- Preview route:
  - [app/brand/loo/page.tsx](E:\Projects\Portfolio%20Manager\app\brand\loo\page.tsx)
- Asset drop folder:
  - [public/mascot](E:\Projects\Portfolio%20Manager\public\mascot)

## Mood Variants

- `guide`
- `smirk`
- `side-eye`
- `proud`

## Current Usage

Integrated in:

1. login hero
2. dashboard welcome card
3. import hero

## User-Supplied Sticker Mapping

- `dashboard-smirk-hero.png`
  - emotion: calm smug welcome
  - placement: dashboard hero, login hero
- `alert-run.png`
  - emotion: run / act now
  - placement: validation errors, urgent review cards
- `review-pointing.png`
  - emotion: direct prompt
  - placement: import review confirm, recommendation confirm
- `side-eye-review.png`
  - emotion: skeptical review
  - placement: symbol audit, stale quote review
- `success-smirk.png`
  - emotion: proud success
  - placement: import success, recommendation summary
- `mini-sticker.png`
  - emotion: neutral mini sticker
  - placement: empty states, helper corners

## Next Integration Targets

1. register hero
2. recommendation summary sidebar
3. empty states across portfolio and spending

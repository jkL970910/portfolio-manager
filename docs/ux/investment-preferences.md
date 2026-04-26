# Investment Preferences UX Decisions

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.


Last updated: 2026-03-17

## Goal

Let users define the strategy that powers recommendations without forcing beginners to manually set a target allocation from scratch.

## Setup Modes

### Guided Allocation Setup

Audience:
- beginners
- users unsure how to set an allocation

Behavior:
- short questionnaire
- generate a suggested starting allocation
- explain why the mix was suggested
- show assumptions
- allow editing before save

Required output:
- suggested allocation by asset class
- explanation
- assumptions
- edit before save
- `Use this allocation`
- `Save as draft`

### Manual Configuration

Audience:
- experienced users

Behavior:
- direct editing of all strategy fields

Required fields:
- risk tolerance
- investment horizon
- target asset allocation
- account funding priorities
- tax-aware placement preferences
- cash buffer target
- recommendation strategy
- rebalancing tolerance
- current-holdings transition preference

## Current-Holdings Transition Preference

The user should be able to choose how recommendations move from the current portfolio toward the target:

- Stay close to current holdings
- Gradually transition to target
- Move more directly toward target

## Account Funding Priorities

This section must look editable, not static.

Preferred interaction:
- drag and drop
- or explicit move up/down controls

## Tax-Aware Placement

Beginner-safe behavior:
- main toggle visible by default
- advanced tax settings collapsed by default

Advanced settings may include:
- province
- marginal tax bracket

## Copy Rules

Preferred language:
- suggested starting allocation
- based on your goals and preferences
- editable before saving
- generally suitable for
- commonly preferred for

Avoid:
- best portfolio for you
- optimal allocation guaranteed
- AI decides your allocation
- certain tax outcome wording

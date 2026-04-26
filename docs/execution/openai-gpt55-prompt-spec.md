# OpenAI GPT-5.5 Prompt Spec

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-04-26

## Objective

Define the first project-level prompt specification for future OpenAI-backed features in Loo国的财富宝库.

This spec exists because the project does not yet have a live OpenAI integration to "upgrade". Instead, it needs a GPT-5.5-native prompt layer ready for the first real AI feature.

## Official Direction

Use:

- model: `gpt-5.5`
- API: Responses API
- starting reasoning posture: `medium`

Why:

- OpenAI's latest-model guidance points to `gpt-5.5` as the default starting point for new builds.
- The project needs high-quality structured reasoning around portfolio, recommendation, and candidate-security explanation, but it does not need the slower and more expensive `gpt-5.5-pro` by default.

Official references:

- `https://developers.openai.com/api/docs/guides/latest-model`
- `https://developers.openai.com/api/docs/guides/prompt-guidance`

## Prompt Layers

### 1. System prompt

Owns:

- role
- tone
- hard safety boundaries
- language policy
- fact vs inference discipline

Project rules:

- Chinese only
- Loo皇 / Loo国 tone allowed, but do not let roleplay hide financial meaning
- never invent holdings, prices, recommendation runs, or user preferences
- clearly distinguish:
  - imported facts
  - computed backend facts
  - model inference
  - suggestion / recommendation

### 2. Analysis policy block

Owns:

- financial reasoning rules
- market-data and freshness handling
- quote provenance handling
- uncertainty handling

Project rules:

- treat backend portfolio data as the source of truth
- do not overwrite native security identity assumptions
- never pretend delayed or stale quotes are live quotes
- when data is incomplete, say what is missing instead of filling the gap

### 3. Task prompt templates

Initial template families:

- portfolio analysis summary
- candidate security explanation
- recommendation explanation

These should stay separate so later features can tune output style without destabilizing every AI surface at once.

## Recommended First AI Use Cases

### Use case 1: Portfolio analysis summary

Goal:

- summarize current portfolio posture in clear Chinese
- highlight concentration, drift, and freshness issues
- keep the explanation tied to known backend facts

### Use case 2: Candidate security explanation

Goal:

- explain why a candidate scored well or poorly
- map the explanation to account fit, tax fit, exposure fit, and watchlist context

### Use case 3: Recommendation explanation

Goal:

- explain why a recommendation run selected a given account and security path
- surface assumptions and trade-offs in cleaner language than a raw engine dump

## Output Rules

- Chinese only
- concise first, then expandable detail
- no unsupported certainty
- no fabricated price targets
- no fabricated macro claims
- no generic "consult a professional" filler unless legally required by the product surface

For structured outputs, require sections such as:

- 结论
- 事实依据
- 推断
- 风险与不确定性
- 下一步建议

## Prompt Design Rules For This Repo

1. Keep prompts close to the actual feature.
2. Keep system prompt small and stable.
3. Put product-specific reasoning rules into reusable policy blocks.
4. Do not bake raw UI text into the system prompt when the backend can supply context.
5. Prefer backend-generated facts plus model explanation over model-generated calculations.

## Initial Compatibility Decision

Current status:

- no live OpenAI usage site exists yet
- therefore no literal model-string migration is possible today
- this prompt spec is the required pre-work for the first real integration

## Next Implementation Step

When the first AI feature is chosen:

1. create a small OpenAI client wrapper around Responses API
2. use `gpt-5.5`
3. keep `reasoning.effort=medium` as the starting default
4. attach the relevant prompt template only for that feature

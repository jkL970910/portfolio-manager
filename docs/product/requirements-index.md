# Loo国 Requirements Index

Last updated: 2026-05-07

## Purpose

Use this index to decide which document to update when product direction,
architecture, execution priority, or QA coverage changes.

## Source Of Truth Order

1. Current product requirements:
   `docs/product/current-product-spec.md`
2. Current execution priorities:
   `docs/execution/backlog.md`
3. AI / decision engine architecture:
   `docs/execution/ai-portfolio-analyzer.md`
4. Cloud / worker / deployment architecture:
   `docs/execution/cloud-deployment-strategy.md`
   `docs/execution/cloud-deployment-runbook.md`
5. Manual mobile QA:
   `docs/guides/mobile-manual-qa-sop.md`
6. Historical baseline:
   `docs/source/brd.md`
   `docs/source/prd.v1.md`
   `docs/source/information_arch.md`

When documents conflict, prefer the highest item in this list unless the user
explicitly says to revive an older requirement.

## When To Update Each Document

### `docs/product/current-product-spec.md`

Update when:

- user changes product scope
- a major feature becomes accepted product direction
- AI 大臣, quick scan, recommendation, import, data, or cloud behavior changes in
  a way users should rely on
- a P0/P1 priority changes at product level

Do not use it for:

- low-level implementation notes
- temporary debugging notes
- command transcripts

### `docs/execution/backlog.md`

Update when:

- a task starts, completes, is deferred, or changes priority
- Gemini/signoff changes the implementation order
- current P0/P1 lists change

### `docs/execution/ai-portfolio-analyzer.md`

Update when:

- AI 大臣 architecture changes
- quick scan DTO/contract/rendering changes
- GPT enhancement or provider boundary changes
- security decision, guardrail, portfolio fit, evidence, or context-pack logic
  changes

### Cloud And Data Docs

Use:

- `docs/execution/cloud-deployment-strategy.md` for target architecture
- `docs/execution/cloud-deployment-runbook.md` for setup/deploy/test steps
- `docs/execution/market-data-provider-strategy.md` for provider policy
- `docs/execution/database-strategy.md` for Postgres/Neon strategy

Update when:

- worker schedule, provider, quota, cache, TTL, deployment, or DB strategy
  changes

### `docs/guides/mobile-manual-qa-sop.md`

Update after every major feature that changes mobile behavior.

Each QA addition should include:

- feature area
- concrete phone steps
- expected result
- identity/freshness/provider boundaries when relevant
- known non-goals or limitations

### Historical Source Docs

`docs/source/brd.md`, `docs/source/prd.v1.md`, and
`docs/source/information_arch.md` are historical baseline documents.

Only update them when:

- adding a short historical-status banner
- preserving a major original requirement for traceability
- explicitly requested by the user

Do not use them as the active P0/P1 planning surface.

## Current Open Product Themes

- Trustworthy security identity and market data.
- Decision-first Security Detail through `Loo国研究台`.
- Deterministic quick scan as the decision source of truth.
- AI 大臣 as cross-page project/user-context assistant.
- Worker/cache/quota boundary before live external data.
- Mobile UI/IA overhaul after data and AI foundations are stable.
- AlphaPick screenshot ingestion as P1 reviewed OCR/import pipeline.

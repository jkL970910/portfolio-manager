# AGENTS.md

## Project Overview

Project: portfolio-manager — a Flutter-first personal portfolio manager for a Canadian investor, with a Next.js backend/API host, PostgreSQL storage, portfolio health scoring, mobile recommendations, manual import, market-data identity handling, and planned AI analysis.

Target user: a small personal/family user base, currently under 10 accounts, focused on Canadian investing, CAD/USD holdings, registered accounts, and mobile-first usage.

User skill level: intermediate. Explain tradeoffs clearly, but default to implementing scoped changes rather than giving generic tutorials.

Stack:

- Next.js 15, React 19, TypeScript
- NextAuth, PostgreSQL, Drizzle ORM
- Flutter mobile app under `apps/mobile`
- Backend tests through Node test runner + `tsx`
- Tailwind/Recharts remain in the legacy web/reference surface

## Product Direction

- Flutter-first, mobile-friendly development is the primary direction.
- Android and Flutter Web are P0 targets.
- iPhone access should work through URL/Flutter Web; APK-only delivery is not enough.
- Chinese-only product UI is the current target.
- Preserve the Loo皇 / Loo国 theme and tone.
- The legacy Next.js web app remains a reference implementation and temporary API host, not the main client.
- The project should stay cost-conscious and suitable for low-traffic personal use.

## Core Domain Rules

- Security identity is not just `symbol`.
- Treat `symbol + exchange/listing market + trading currency` as the fixed identity whenever available.
- Never collapse US common shares, CAD-listed versions, CDRs, CAD-hedged ETFs, and special/manual holdings by ticker alone.
- Quote refresh should preserve each holding's native trading currency and convert only at portfolio/display aggregation time.
- Mobile import should keep the current manual/guided flow. Do not add mobile CSV import unless explicitly requested.
- Recommendation Constraints v2 is active: excluded/preferred securities, asset-class bands, account type rules, and security-type rules should remain backend-owned and validated.
- The uploaded `portfolio-analyzer.skill` is P0 product direction, but it must be converted into backend-owned AI analysis contracts and JSON outputs. Do not directly use it as a runtime prompt, React artifact generator, or Flutter parser input.

## Commands

Install:

```bash
npm install
cd apps/mobile && flutter pub get
```

Dev:

```bash
npm run dev
npm run dev:host
npm run mobile:dev:web
```

Remote/mobile preview:

```bash
npm run remote:stack:start
npm run remote:stack:status
npm run mobile:preview:proxy
npm run preview:tunnel:cloudflare -- 3010
```

Build:

```bash
npm run build
cd apps/mobile && flutter build web --release
cd apps/mobile && flutter build apk --debug
```

Test:

```bash
npm run test:backend
npm run typecheck
cd apps/mobile && flutter analyze
cd apps/mobile && flutter test
```

Lint:

```bash
npm run lint
```

Note: if `npm run lint` fails because ESLint 9 expects flat config, do not treat that as proof the feature is broken. Record the tooling issue and use `npm run typecheck`, `npm run test:backend`, `flutter analyze`, and `flutter test` as the primary checks until lint config is fixed.

## Do

- Read existing code and docs before modifying anything.
- Match existing patterns, naming, and style.
- Keep changes small and scoped to the requested task.
- Prefer backend contracts and typed DTOs over page-shaped `Map<String, dynamic>` parsing.
- Handle errors gracefully with visible user-facing messages. No silent failures.
- Add or update docs after every completed development step that changes project direction, priority, API contract, or mobile behavior.
- Add at least one relevant test for new backend logic.
- Preserve backward compatibility for existing preference/profile payloads unless explicitly changing a contract.
- Keep mobile UI Chinese-only unless explicitly asked otherwise.
- Keep AI/analysis outputs structured, source-aware, and disclaimer-aware.
- Gate expensive AI, news, forum, quote-history, or research work behind explicit user action, caching, or future worker jobs.
- Run the relevant checks before committing or pushing.

## Don't

- Do not install new dependencies without permission unless the user has clearly asked for a change that requires them.
- Do not delete or overwrite files without confirmation.
- Do not hardcode secrets, API keys, credentials, tokens, or personal financial data.
- Do not rewrite working code unless explicitly asked or needed for the scoped task.
- Do not push, deploy, or force-push without explicit user permission.
- Never force push.
- Do not make changes outside the request scope.
- Do not add mobile CSV import unless explicitly requested.
- Do not turn the uploaded `portfolio-analyzer.skill` directly into app runtime code.
- Do not run live Reddit/news/forum research on normal page load.
- Do not use ticker-only matching when exchange or currency is available.

## When Stuck

- If a task is large, break it into steps and confirm the plan first.
- If an error cannot be fixed after two focused attempts, stop and explain the blocker, what was tried, and the safest next option.
- If docs and code disagree, treat code as current behavior and docs as intent. Update docs or code so they match.
- If a change would affect database schema, auth, deployment, or external APIs, state the migration/operational risk before proceeding.

## Testing

- Run existing tests after any non-trivial change.
- Add backend tests for new backend rules, validators, DTOs, scoring logic, and AI analyzer contract behavior.
- Prefer invariant tests over brittle exact score snapshots.
- Never skip, weaken, or delete tests just to make checks pass.
- For Flutter UI changes, run `flutter analyze` and `flutter test`.
- For backend/API changes, run `npm run test:backend` and `npm run typecheck`.
- Use `git diff --check` before committing.

## Manual QA For Major Features

- After every new major feature, add or update the matching manual QA cases in `docs/guides/mobile-manual-qa-sop.md`.
- The manual QA update must cover the new user-facing flow, important edge cases, expected results, and any known non-goals or limitations.
- In the final chat response for that feature, include a concise test flow the user can run on their phone, with concrete steps and expected results.
- If the feature touches security identity, import, quotes, recommendations, or AI analysis, include at least one manual test that verifies `symbol + exchange + currency` is preserved.
- Do not mark a major feature complete unless automated checks and the manual QA update are both addressed, or the reason for deferring QA is explicitly stated.

## Git

- Keep commits focused and descriptive.
- Do not amend commits unless explicitly requested.
- Do not push without explicit user permission.
- Do not force push.
- Before committing, inspect `git status -sb` and make sure no unrelated files are staged.
- Commit docs updates together with the code that changes the documented behavior.

## Response Style

- Respond in the user's language by default.
- Be clear and concise.
- Use simple wording when explaining tradeoffs.
- Avoid long paragraphs.
- State what changed, how it was verified, and what remains.
- Do not over-explain routine command output.

## Current Priority Order

1. Apply/verify migration `0004_portfolio_analysis_runs` in the target dev DB before relying on persistent analyzer cache.
2. Manual mobile QA for AI quick scans and current Flutter mobile features, using `docs/guides/mobile-manual-qa-sop.md` as the source of truth.
3. Commit/push the analyzer cache boundary after validation and user approval.
4. Cached external research must wait for explicit cache/worker policy and should not call live external sources by default.
5. Holding-level deeper AI analysis and chart-heavy UX come after the core analyzer flow is stable.

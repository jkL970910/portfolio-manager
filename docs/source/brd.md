# Loo国的财富宝库 Business Requirements Document

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Version: 2.0  
Status: Active  
Last Updated: 2026-04-25

## 1. Executive Summary

Loo国的财富宝库 is a Flutter-first mobile decision-support product for self-directed investors.

The product helps one primary user:

- consolidate portfolio data
- understand allocation and concentration
- configure long-term investment preferences
- decide where new capital should go

The project no longer treats web-first development as the long-term product direction. Existing web code remains the implementation baseline and backend host during migration, but the future product experience is mobile-first.

## 2. Product Vision

Create a Chinese-only, Loo皇-themed mobile wealth workspace that allows a self-directed investor to:

1. understand current portfolio structure
2. inspect accounts and holdings in detail
3. connect spending context to investable cash
4. configure an investment strategy
5. receive transparent recommendation and candidate-security guidance

## 3. Target User

Primary user profile:

- individual investor
- based in Canada
- uses self-directed brokerage accounts
- holds ETFs plus selected stocks
- manages multiple account types such as TFSA, RRSP, FHSA, and non-registered
- wants mobile access rather than a desktop-first dashboard

## 4. Product Objectives

### Objective 1

Provide a unified mobile portfolio and wealth overview.

### Objective 2

Provide portfolio intelligence that remains understandable on a phone-sized surface.

### Objective 3

Answer the key question:

`下一笔钱应该投到哪里？`

### Objective 4

Preserve current product progress while migrating the primary UX to Flutter.

## 5. Scope

### In Scope

- multi-account asset aggregation
- net-worth and portfolio overview
- portfolio workspace
- funding recommendation engine
- investment preferences
- guided allocation setup
- watchlist and candidate-security analysis
- basic spending visibility
- import workflows
- Chinese-only branded identity layer

### Out of Scope

- automated trading
- social investing
- ongoing English-mode support
- desktop-first web expansion as the primary path
- full budgeting parity

## 6. Platform Decision

The product platform is now defined as:

- client: Flutter
- backend baseline: current Next.js route handlers and service layer
- persistence: PostgreSQL
- migration approach: preserve domain logic, replace the primary UX surface

## 7. Core Feature Modules

### 7.1 Dashboard

Purpose:
- quick mobile overview of wealth, portfolio health, alerts, and recommendation state

### 7.2 Portfolio Workspace

Purpose:
- account-first and holding-aware portfolio inspection on mobile

Required capabilities:
- account list
- account detail
- unified symbol detail
- holding inspection
- concentration and drift review
- repair entry points for account and holding structure

### 7.3 Investment Preferences

Purpose:
- capture target allocation and strategy rules that power recommendation and health analysis

### 7.4 Recommendation Engine

Purpose:
- recommend where new capital should go
- explain trade-offs transparently
- support both current-holding guidance and candidate-security scoring

### 7.5 Spending Support

Purpose:
- keep spending as a supporting workflow for investable-cash decisions

### 7.6 Import

Purpose:
- ingest portfolio and spending data through CSV, guided setup, and manual entry

### 7.7 Discovery and Watchlist

Purpose:
- search arbitrary securities
- maintain a watchlist
- evaluate candidate securities against the current portfolio

## 8. Experience Requirements

- Chinese only
- Loo皇 theme always on
- mobile-first interaction model
- compact drill-down flows
- staged detail reveal rather than desktop-style dense surfaces
- preserve recommendation transparency even when the UI becomes more compact

## 9. Migration Requirement

The project must not restart from zero.

Required migration rule:

- keep current feature scope
- keep current roadmap sequencing
- keep backend domain behavior where practical
- move read-heavy high-frequency flows first
- move complex import and setup flows after the mobile shell is stable

## 10. Success Criteria

1. The mobile client can replace the web client for daily review and recommendation use.
2. Existing core features remain available during migration.
3. Product docs, architecture, and backlog all point to the same Flutter-first direction.
4. The user no longer needs English-mode support or desktop-first product assumptions.

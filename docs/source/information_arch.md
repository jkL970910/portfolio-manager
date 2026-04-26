# Loo国的财富宝库 Information Architecture

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-04-25

## 1. Overview

This document defines the mobile-first information architecture for the Flutter migration.

Primary rule:

- mobile first
- Chinese only
- one primary brand voice
- drill-down flows instead of desktop-style simultaneous density

## 2. Primary Navigation

Bottom navigation:

- 总览
- 组合
- 推荐
- 导入
- 设置

Secondary routes:

- 发现
- 账户详情
- 标的详情
- 支出

## 3. Page Hierarchy

App

- 总览
  - 财富总览
  - 组合摘要
  - 推荐摘要
  - 价格刷新提醒
  - 支出摘要
- 组合
  - 账户列表
  - 账户详情
  - 标的详情
  - 持仓明细
  - 健康度 / 漂移 / 集中度
- 推荐
  - 当前建议
  - 账户适配
  - 标的建议
  - 原因说明
  - 情景比较
- 导入
  - 导入入口
  - 账户与持仓导入
  - 支出导入
  - 映射与校验
- 设置
  - 偏好设置
  - 指导式配置
  - 观察列表
  - 公民档案
- 发现
  - 标的搜索
  - 观察列表操作
  - 候选标的评分

## 4. Mobile Reading Order

### 总览

1. 当前是否需要行动
2. 总资产与组合摘要
3. 价格刷新状态
4. 推荐摘要
5. 支出上下文

### 组合

1. 账户
2. 账户内持仓
3. 具体标的
4. 风险与漂移解释

### 推荐

1. 本次建议结论
2. 原因
3. 账户放置
4. 备选标的
5. 风险提示

## 5. Navigation Rules

- account-first before holding-table overload
- one primary CTA per screen
- long explanations should collapse by default
- quote provenance and timestamp should stay visible near valuation
- editing and maintenance flows should sit behind explicit actions, not dominate first paint

## 6. Legacy Web Note

The existing Next.js routes still define much of the current domain behavior, but they are no longer the long-term IA target. Flutter navigation wins when mobile ergonomics conflict with old web layout assumptions.

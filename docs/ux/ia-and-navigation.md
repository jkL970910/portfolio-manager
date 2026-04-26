# Loo国的财富宝库 IA and Navigation

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-04-25

## Primary Navigation

Bottom tabs:

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

## Navigation Rules

- keep top-level tabs short and stable
- move deep detail into drill-down routes
- avoid desktop-style multi-panel overload on first paint
- prefer one main action per screen
- keep destructive maintenance behind explicit entry points

## Route Priorities

### 总览

First-fold priorities:

1. 当前是否需要行动
2. 总资产 / 组合摘要
3. 推荐摘要
4. 价格刷新状态
5. 支出摘要

### 组合

First-fold priorities:

1. 账户列表
2. 当前选中账户的摘要
3. 标的入口
4. 风险和漂移解释

### 推荐

First-fold priorities:

1. 本次建议结论
2. 账户适配
3. 核心原因
4. 备选标的

### 导入

First-fold priorities:

1. 选择导入工作流
2. 账户 / 持仓导入
3. 支出导入
4. 校验与修正

### 设置

First-fold priorities:

1. 偏好摘要
2. 指导式配置入口
3. 观察列表
4. 公民档案

## Detail Surface Rules

- account detail is the main drill-down from account lists
- unified symbol detail is the main drill-down from holdings, recommendations, and discovery
- explanation panels should collapse by default on smaller screens
- quote source and timestamp should stay near the valuation block

## Language and Theme Rules

- Chinese only
- no English-mode branching
- all product-facing copy may use Loo皇 tone where appropriate
- avoid splitting the IA into “Chinese mode” and “English mode”; there is now only one product experience

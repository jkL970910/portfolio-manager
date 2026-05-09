# Loo国的财富宝库 IA and Navigation

> [!IMPORTANT]
> As of 2026-04-25, this project is now Flutter-first, mobile-first, Chinese-only, and Loo皇-themed. When this document conflicts with `docs/execution/flutter-mobile-migration-plan.md`, follow the migration plan first.

Last updated: 2026-05-08

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
- 持仓详情
- 标的详情
- Health / 健康巡查
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

1. 总资产、走势和新鲜度
2. 当前是否需要行动
3. 账户入口完整覆盖
4. 推荐 / Health 摘要
5. Loo国今日秘闻摘要

### 组合

First-fold priorities:

1. 组合结构和账户分布
2. 全部账户入口
3. 全部持仓 / 观察标的入口
4. 风险、漂移和 Health 摘要
5. 筛选、搜索和展开，而不是静默截断

### 推荐

First-fold priorities:

1. 本次建议结论
2. 账户适配
3. 核心原因
4. 备选标的

### 导入

First-fold priorities:

1. `手动同步` 与 `券商同步` 两个主入口
2. 手动添加账户 / 手动添加持仓作为 `手动同步` 的二级入口
3. IBKR / Wealthsimple 等 provider 作为 `券商同步` 的二级流程
4. 校验、预览、冲突处理和确认

### 设置

First-fold priorities:

1. 偏好摘要
2. 指导式配置入口
3. 主题模式、AI Provider、FX/数据源和后台任务
4. 观察列表和公民档案

## UI v2 Information Architecture Rules

The approved UI v2 direction is documented in
`docs/ui/mobile-ui-v2-figma-plan.md` and the Figma file
`https://www.figma.com/design/aYsiPJ8eybrWa6BcY1peIn`.

Rules:

- First fold should answer the page's main user question before showing source
  details.
- Use progressive disclosure: default view shows conclusion, numbers, charts,
  and actions; explanations move into expanders, bottom sheets, AI 大臣, or
  detail pages.
- Overview and Portfolio must not hide valid accounts or holdings behind
  hard-coded `take(3)` / `take(12)` style shortcuts.
- List rows/cards should be tappable as a whole. Do not rely on small arrow
  icons for detail entry.
- Intrusive row badges such as `已更新` and `未持有` should move to subtle
  metadata or detail pages.
- Settings owns technical surfaces: FX policy, provider status, worker status,
  API/GPT setup, and advanced data-quality tools.
- Full `Loo国今日秘闻` belongs on Overview. Recommendation and Security Detail
  may show compact, identity-filtered related intelligence only.

## Detail Surface Rules

- account detail is the main drill-down from account lists
- holding detail is allowed when the user needs account-specific holding facts
- unified symbol detail is the main drill-down from holdings, recommendations, and discovery
- explanation panels should collapse by default on smaller screens
- quote source and timestamp should stay near the valuation block

## Language and Theme Rules

- Chinese only
- no English-mode branching
- all product-facing copy may use Loo皇 tone where appropriate
- avoid splitting the IA into “Chinese mode” and “English mode”; there is now only one product experience

import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../app/mobile_routes.dart";
import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../../shared/data/loo_minister_context_models.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "../../shared/presentation/loo_minister_scope.dart";
import "account_type_portfolio_page.dart";
import "ai_analysis_card.dart";
import "detail_state_widgets.dart";

class HealthScorePage extends StatefulWidget {
  const HealthScorePage({
    required this.apiClient,
    this.accountId,
    this.fallbackTitle = "健康巡查",
    super.key,
  });

  final LooApiClient apiClient;
  final String? accountId;
  final String fallbackTitle;

  @override
  State<HealthScorePage> createState() => _HealthScorePageState();
}

class _HealthScorePageState extends State<HealthScorePage> {
  late Future<MobileHealthSnapshot> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  Future<MobileHealthSnapshot> _loadSnapshot() async {
    final response =
        await widget.apiClient.getPortfolioHealth(accountId: widget.accountId);
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("健康评分格式不正确。");
    }

    final snapshot = MobileHealthSnapshot.fromJson(data);
    if (mounted) {
      LooMinisterScope.report(
        context,
        snapshot.toMinisterContext(
          accountId: widget.accountId,
          asOf: DateTime.now().toUtc().toIso8601String(),
        ),
      );
    }
    return snapshot;
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.fallbackTitle)),
      body: LooPageGradient(
        child: FutureBuilder<MobileHealthSnapshot>(
          future: _snapshot,
          builder: (context, snapshot) {
            if (snapshot.connectionState == ConnectionState.waiting) {
              return const Center(child: CircularProgressIndicator());
            }

            if (snapshot.hasError) {
              return DetailErrorState(
                title: "健康巡查暂时打不开",
                message: snapshot.error.toString(),
                onRetry: _refresh,
              );
            }

            if (!snapshot.hasData) {
              return DetailNotFoundState(
                title: "没有健康评分",
                message: "Loo国还没有足够的组合数据来生成健康巡查。",
                onRetry: _refresh,
              );
            }

            final data = snapshot.data!;
            return RefreshIndicator(
              onRefresh: () async => _refresh(),
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                children: [
                  _SummaryCard(data),
                  if (data.isAccountScope) ...[
                    const SizedBox(height: 12),
                    const _AccountScopeExplanationCard(),
                  ],
                  const SizedBox(height: 12),
                  AiAnalysisCard(
                    apiClient: widget.apiClient,
                    title: widget.accountId == null ? "智能组合快扫" : "智能账户快扫",
                    description: widget.accountId == null
                        ? "先用组合健康、投资偏好和已保存资料生成确定性判断；GPT 增强需手动点击。"
                        : "先用当前账户持仓、账户类型和偏好生成确定性判断；GPT 增强需手动点击。",
                    payload: {
                      "scope":
                          widget.accountId == null ? "portfolio" : "account",
                      "mode": "quick",
                      if (widget.accountId != null)
                        "accountId": widget.accountId,
                    },
                  ),
                  if (data.highlights.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const _SectionTitle("Loo皇批注"),
                    const SizedBox(height: 8),
                    _BulletCard(data.highlights),
                  ],
                  if (data.actionQueue.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const _SectionTitle("优先行动"),
                    const SizedBox(height: 8),
                    _BulletCard(data.actionQueue, prefix: "行动"),
                  ],
                  if (data.radar.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const _SectionTitle("雷达维度"),
                    const SizedBox(height: 8),
                    _RadarCard(data.radar),
                  ],
                  if (data.dimensions.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const _SectionTitle("健康维度"),
                    const SizedBox(height: 8),
                    ...data.dimensions.map(_DimensionCard.new),
                  ],
                  if (data.accountDrilldown.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const _SectionTitle("账户巡查"),
                    const SizedBox(height: 8),
                    ...data.accountDrilldown.map(
                      (item) => _DrilldownCard(
                        item,
                        onTap: () => _openAccountTypePortfolio(item),
                      ),
                    ),
                  ],
                  if (data.holdingDrilldown.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const _SectionTitle("持仓巡查"),
                    const SizedBox(height: 8),
                    ...data.holdingDrilldown.map(
                      (item) => _DrilldownCard(
                        item,
                        onTap: () => _openHoldingDetail(item),
                      ),
                    ),
                  ],
                ],
              ),
            );
          },
        ),
      ),
    );
  }

  void _openHoldingDetail(MobileHealthDrilldownItem item) {
    if (item.id.isEmpty) {
      return;
    }
    final symbol = item.symbol?.trim();
    if (symbol == null || symbol.isEmpty) {
      context.push(MobileRoutes.holdingDetail(item.id));
      return;
    }
    context.push(
      MobileRoutes.securityDetail(
        symbol: symbol,
        securityId: item.securityId,
        exchange: item.exchange,
        currency: item.currency,
        holdingId: item.id,
      ),
    );
  }

  void _openAccountTypePortfolio(MobileHealthDrilldownItem item) {
    if (item.id.isEmpty) {
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AccountTypePortfolioPage(
          apiClient: widget.apiClient,
          accountType: item.id,
          title: "${item.label}巡查",
        ),
      ),
    );
  }
}

class MobileHealthSnapshot {
  const MobileHealthSnapshot({
    required this.scopeName,
    required this.scopeLabel,
    required this.scopeDetail,
    required this.isAccountScope,
    required this.score,
    required this.status,
    required this.strongestDimension,
    required this.weakestDimension,
    required this.highlights,
    required this.actionQueue,
    required this.radar,
    required this.dimensions,
    required this.accountDrilldown,
    required this.holdingDrilldown,
  });

  final String scopeName;
  final String scopeLabel;
  final String scopeDetail;
  final bool isAccountScope;
  final String score;
  final String status;
  final MobileHealthDimensionPair strongestDimension;
  final MobileHealthDimensionPair weakestDimension;
  final List<String> highlights;
  final List<String> actionQueue;
  final List<MobileHealthRadarPoint> radar;
  final List<MobileHealthDimension> dimensions;
  final List<MobileHealthDrilldownItem> accountDrilldown;
  final List<MobileHealthDrilldownItem> holdingDrilldown;

  LooMinisterPageContext toMinisterContext({
    required String? accountId,
    required String asOf,
  }) {
    return LooMinisterPageContext(
      page: "portfolio-health",
      title: scopeName,
      asOf: asOf,
      subject: LooMinisterSubject(accountId: accountId),
      facts: [
        LooMinisterFact(
          id: "health-score",
          label: "健康分",
          value: score,
          detail: status,
          source: "analysis-cache",
        ),
        LooMinisterFact(
          id: "health-scope",
          label: "评分口径",
          value: scopeLabel,
          detail: scopeDetail,
          source: "analysis-cache",
        ),
        LooMinisterFact(
          id: "strongest-dimension",
          label: "最强维度",
          value: "${strongestDimension.label} · ${strongestDimension.value}",
          source: "analysis-cache",
        ),
        LooMinisterFact(
          id: "weakest-dimension",
          label: "最弱维度",
          value: "${weakestDimension.label} · ${weakestDimension.value}",
          source: "analysis-cache",
        ),
        ...radar.take(6).map(
              (point) => LooMinisterFact(
                id: "radar-${_slug(point.dimension)}",
                label: "雷达 ${point.dimension}",
                value: "${point.value.round()} 分",
                source: "analysis-cache",
              ),
            ),
        ...dimensions.take(6).map(
              (dimension) => LooMinisterFact(
                id: "dimension-${_slug(dimension.label)}",
                label: dimension.label,
                value: dimension.score,
                detail: dimension.summary,
                source: "analysis-cache",
              ),
            ),
      ],
      warnings: [
        ...highlights.take(5),
        ...actionQueue.take(5),
        ...dimensions.expand((dimension) => dimension.actions.take(2)).take(6),
      ],
      allowedActions: [
        LooMinisterSuggestedAction(
          id: isAccountScope
              ? "run-account-analysis"
              : "run-portfolio-analysis",
          label: isAccountScope ? "运行智能账户快扫" : "运行智能组合快扫",
          actionType: "run-analysis",
          target: {
            "scope": isAccountScope ? "account" : "portfolio",
            if (accountId != null && accountId.isNotEmpty)
              "accountId": accountId,
          },
          requiresConfirmation: true,
        ),
      ],
    );
  }

  factory MobileHealthSnapshot.fromJson(Map<String, dynamic> json) {
    final scope = json["scope"];
    final health = json["health"];
    final scopeData =
        scope is Map<String, dynamic> ? scope : const <String, dynamic>{};
    final healthData =
        health is Map<String, dynamic> ? health : const <String, dynamic>{};

    return MobileHealthSnapshot(
      scopeName: scopeData["name"] as String? ?? "组合健康",
      scopeLabel: healthData["scopeLabel"] as String? ??
          (scopeData["type"] == "account" ? "账户内适配 + 全组合目标参考" : "全组合健康"),
      scopeDetail: healthData["scopeDetail"] as String? ??
          (scopeData["type"] == "account"
              ? "账户级评分不要求单个账户复制全组合目标。"
              : "全组合评分按总目标配置、账户效率、集中度和风险平衡判断。"),
      isAccountScope: scopeData["type"] == "account",
      score: "${healthData["score"] ?? "--"} 分",
      status: healthData["status"] as String? ?? "待评估",
      strongestDimension:
          MobileHealthDimensionPair.fromJson(healthData["strongestDimension"]),
      weakestDimension:
          MobileHealthDimensionPair.fromJson(healthData["weakestDimension"]),
      highlights:
          (healthData["highlights"] as List?)?.whereType<String>().toList() ??
              const [],
      actionQueue:
          (healthData["actionQueue"] as List?)?.whereType<String>().toList() ??
              const [],
      radar: readJsonList(healthData, "radar")
          .map(MobileHealthRadarPoint.fromJson)
          .toList(),
      dimensions: readJsonList(healthData, "dimensions")
          .map(MobileHealthDimension.fromJson)
          .toList(),
      accountDrilldown: readJsonList(healthData, "accountDrilldown")
          .map(MobileHealthDrilldownItem.fromJson)
          .toList(),
      holdingDrilldown: readJsonList(healthData, "holdingDrilldown")
          .map(MobileHealthDrilldownItem.fromJson)
          .toList(),
    );
  }
}

class MobileHealthDimensionPair {
  const MobileHealthDimensionPair({required this.label, required this.value});

  final String label;
  final String value;

  factory MobileHealthDimensionPair.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    final rawValue = json["value"];
    return MobileHealthDimensionPair(
      label: json["label"] as String? ?? "待评估",
      value: rawValue is num ? "${rawValue.round()} 分" : "--",
    );
  }
}

class MobileHealthRadarPoint {
  const MobileHealthRadarPoint({required this.dimension, required this.value});

  final String dimension;
  final double value;

  factory MobileHealthRadarPoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];
    return MobileHealthRadarPoint(
      dimension: json["dimension"] as String? ?? "未知维度",
      value: rawValue is num ? rawValue.toDouble().clamp(0, 100) : 0,
    );
  }
}

class MobileHealthDimension {
  const MobileHealthDimension({
    required this.label,
    required this.score,
    required this.status,
    required this.summary,
    required this.drivers,
    required this.consequences,
    required this.actions,
  });

  final String label;
  final String score;
  final String status;
  final String summary;
  final List<String> drivers;
  final List<String> consequences;
  final List<String> actions;

  factory MobileHealthDimension.fromJson(Map<String, dynamic> json) {
    return MobileHealthDimension(
      label: json["label"] as String? ?? "未知维度",
      score: "${json["score"] ?? "--"} 分",
      status: json["status"] as String? ?? "待评估",
      summary: json["summary"] as String? ?? "",
      drivers:
          (json["drivers"] as List?)?.whereType<String>().toList() ?? const [],
      consequences:
          (json["consequences"] as List?)?.whereType<String>().toList() ??
              const [],
      actions:
          (json["actions"] as List?)?.whereType<String>().toList() ?? const [],
    );
  }
}

class MobileHealthDrilldownItem {
  const MobileHealthDrilldownItem({
    required this.id,
    required this.label,
    required this.score,
    required this.status,
    required this.summary,
    required this.drivers,
    required this.actions,
    this.securityId,
    this.symbol,
    this.exchange,
    this.currency,
  });

  final String id;
  final String label;
  final String score;
  final String status;
  final String summary;
  final List<String> drivers;
  final List<String> actions;
  final String? securityId;
  final String? symbol;
  final String? exchange;
  final String? currency;

  factory MobileHealthDrilldownItem.fromJson(Map<String, dynamic> json) {
    return MobileHealthDrilldownItem(
      id: json["id"] as String? ?? "",
      label: json["label"] as String? ?? "未知对象",
      score: "${json["score"] ?? "--"} 分",
      status: json["status"] as String? ?? "待评估",
      summary: json["summary"] as String? ?? "",
      drivers:
          (json["drivers"] as List?)?.whereType<String>().toList() ?? const [],
      actions:
          (json["actions"] as List?)?.whereType<String>().toList() ?? const [],
      securityId: json["securityId"] as String?,
      symbol: json["symbol"] as String?,
      exchange: json["exchange"] as String?,
      currency: json["currency"] as String?,
    );
  }
}

String _slug(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r"[^a-z0-9\u4e00-\u9fa5]+"), "-")
      .replaceAll(RegExp(r"^-+|-+$"), "");
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard(this.data);

  final MobileHealthSnapshot data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    return LooGlassCard(
      isHero: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(data.scopeName, style: theme.textTheme.headlineMedium),
          const SizedBox(height: 10),
          _ScopePill(data.scopeLabel),
          const SizedBox(height: 8),
          Text(
            data.scopeDetail,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: tokens.mutedText,
            ),
          ),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.end,
            children: [
              Text(data.score, style: theme.textTheme.displaySmall),
              const Spacer(),
              Text(data.status, style: theme.textTheme.titleMedium),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoPill(
                "最强：${data.strongestDimension.label} · ${data.strongestDimension.value}",
              ),
              _InfoPill(
                "最弱：${data.weakestDimension.label} · ${data.weakestDimension.value}",
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _AccountScopeExplanationCard extends StatelessWidget {
  const _AccountScopeExplanationCard();

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("评分口径", style: theme.textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            "账户 Health 分成两个层级，不要求单个账户复制全组合目标。",
            style: theme.textTheme.bodySmall?.copyWith(
              color: context.looTokens.mutedText,
            ),
          ),
          const SizedBox(height: 10),
          const Text("• 账户内适配：看账户类型、税务和持仓是否放得顺。"),
          const SizedBox(height: 6),
          const Text("• 全组合目标参考：看这个账户对总组合目标的贡献。"),
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title);

  final String title;

  @override
  Widget build(BuildContext context) {
    return Text(title, style: Theme.of(context).textTheme.titleLarge);
  }
}

class _ScopePill extends StatelessWidget {
  const _ScopePill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.34),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: context.looTokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: Text(label, style: Theme.of(context).textTheme.bodySmall),
      ),
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.34),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: context.looTokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(label, style: Theme.of(context).textTheme.labelMedium),
      ),
    );
  }
}

class _BulletCard extends StatelessWidget {
  const _BulletCard(this.items, {this.prefix});

  final List<String> items;
  final String? prefix;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: items
            .take(6)
            .map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(prefix == null ? "• $item" : "$prefix：$item"),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _RadarTile extends StatelessWidget {
  const _RadarTile(this.point);

  final MobileHealthRadarPoint point;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final progress = point.value / 100;
    return Padding(
      padding: const EdgeInsets.only(top: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(point.dimension)),
              Text("${point.value.round()} 分",
                  style: theme.textTheme.titleMedium),
            ],
          ),
          const SizedBox(height: 8),
          _TargetProgressBar(value: progress),
        ],
      ),
    );
  }
}

class _TargetProgressBar extends StatelessWidget {
  const _TargetProgressBar({required this.value});

  final double value;

  @override
  Widget build(BuildContext context) {
    final colorScheme = Theme.of(context).colorScheme;
    final clampedValue = value.clamp(0.0, 1.0);
    const clampedTarget = 0.9;
    return SizedBox(
      height: 14,
      child: LayoutBuilder(
        builder: (context, constraints) {
          final width = constraints.maxWidth;
          return Stack(
            clipBehavior: Clip.none,
            children: [
              Positioned.fill(
                top: 4,
                bottom: 4,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: colorScheme.surfaceContainerHighest,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              Positioned(
                left: 0,
                top: 4,
                bottom: 4,
                width: width * clampedValue,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    color: colorScheme.primary,
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
              Positioned(
                left: (width * clampedTarget - 1).clamp(0.0, width - 2),
                top: 0,
                child: Container(
                  width: 2,
                  height: 14,
                  decoration: BoxDecoration(
                    color: colorScheme.onSurface.withValues(alpha: 0.72),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}

class _RadarCard extends StatelessWidget {
  const _RadarCard(this.points);

  final List<MobileHealthRadarPoint> points;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      child: Column(
        children: [
          LooRadarChart(
            points: points
                .map((point) => LooRadarPoint(
                      label: point.dimension,
                      value: point.value,
                    ))
                .toList(),
          ),
          const SizedBox(height: 8),
          ...points.map(_RadarTile.new),
        ],
      ),
    );
  }
}

class _DimensionCard extends StatelessWidget {
  const _DimensionCard(this.dimension);

  final MobileHealthDimension dimension;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("${dimension.label} · ${dimension.score}",
              style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(dimension.status),
          if (dimension.summary.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              dimension.summary,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
          ],
          ...dimension.drivers.take(3).map(_smallBullet),
          ...dimension.consequences.take(2).map(
                (item) => Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text("影响：$item"),
                ),
              ),
          ...dimension.actions.take(3).map(
                (item) => Padding(
                  padding: const EdgeInsets.only(top: 6),
                  child: Text("行动：$item"),
                ),
              ),
        ],
      ),
    );
  }
}

class _DrilldownCard extends StatelessWidget {
  const _DrilldownCard(this.item, {this.onTap});

  final MobileHealthDrilldownItem item;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return LooTappableRow(
      margin: const EdgeInsets.only(bottom: 10),
      title: item.label,
      subtitle: [
        item.status,
        if (item.summary.isNotEmpty) item.summary,
        ...item.drivers.take(1),
        ...item.actions.take(1).map((action) => "行动：$action"),
      ].join("\n"),
      value: item.score,
      onTap: onTap,
    );
  }
}

Widget _smallBullet(String item) {
  return Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Text("• $item"),
  );
}

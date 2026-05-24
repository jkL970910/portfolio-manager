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
                  if (data.recommendationBridge != null) ...[
                    const SizedBox(height: 12),
                    _RecommendationBridgeCard(
                      data.recommendationBridge!,
                      onTap: () => context.push(MobileRoutes.recommendations),
                    ),
                  ],
                  const SizedBox(height: 12),
                  _LooHealthBriefingCard(
                    data: data,
                    apiClient: widget.apiClient,
                    accountId: widget.accountId,
                  ),
                  if (data.dimensions.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const _SectionTitle("健康维度"),
                    const SizedBox(height: 8),
                    ...data.dimensions.map(_DimensionCard.new),
                  ],
                  if (data.accountDrilldown.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _AccountDrilldownCarousel(
                      items: data.accountDrilldown,
                      onOpenDetail: _openAccountTypePortfolio,
                    ),
                  ],
                  if (data.holdingDrilldown.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _HoldingDragSection(
                      items: data.holdingDrilldown,
                      onTap: _openHoldingDetail,
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
    context.push(MobileRoutes.accountDetail(item.id));
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
    this.recommendationBridge,
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
  final MobileHealthRecommendationBridge? recommendationBridge;

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
          label: isAccountScope ? "开始账户巡阅" : "开始国库巡阅",
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
      recommendationBridge: MobileHealthRecommendationBridge.fromJson(
          json["recommendationBridge"]),
    );
  }
}

class MobileHealthRecommendationBridge {
  const MobileHealthRecommendationBridge({
    required this.title,
    required this.status,
    required this.detail,
    required this.actionLabel,
    this.targetAssetClass,
    this.securitySymbol,
    this.targetAccount,
    this.gapBeforePct,
    this.gapAfterPct,
  });

  final String title;
  final String status;
  final String detail;
  final String actionLabel;
  final String? targetAssetClass;
  final String? securitySymbol;
  final String? targetAccount;
  final double? gapBeforePct;
  final double? gapAfterPct;

  bool get isBlocked => status == "blocked";
  bool get isReady => status == "ready";

  static MobileHealthRecommendationBridge? fromJson(Object? value) {
    if (value is! Map<String, dynamic>) {
      return null;
    }
    double? readPct(String key) {
      final raw = value[key];
      return raw is num ? raw.toDouble() : null;
    }

    return MobileHealthRecommendationBridge(
      title: value["title"] as String? ?? "下一笔进货",
      status: value["status"] as String? ?? "needs-run",
      detail: value["detail"] as String? ?? "",
      actionLabel: value["actionLabel"] as String? ?? "查看进货清单",
      targetAssetClass: value["targetAssetClass"] as String?,
      securitySymbol: value["securitySymbol"] as String?,
      targetAccount: value["targetAccount"] as String?,
      gapBeforePct: readPct("gapBeforePct"),
      gapAfterPct: readPct("gapAfterPct"),
    );
  }
}

class MobileHealthDimensionPair {
  const MobileHealthDimensionPair({required this.label, required this.value});

  final String label;
  final String value;

  factory MobileHealthDimensionPair.fromJson(Object? value) {
    if (value is String && value.trim().isNotEmpty) {
      final match = RegExp(r"(-?\d+(?:\.\d+)?)").firstMatch(value);
      final numeric = double.tryParse(match?.group(1) ?? "");
      final label =
          value.replaceFirst(RegExp(r"\s*-?\d+(?:\.\d+)?\s*$"), "").trim();
      return MobileHealthDimensionPair(
        label: label.isEmpty ? value : label,
        value: numeric == null ? "--" : "${numeric.round()} 分",
      );
    }
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

  double get scoreValue {
    final match = RegExp(r"\d+(\.\d+)?").firstMatch(score);
    return double.tryParse(match?.group(0) ?? "")?.clamp(0, 100) ?? 0;
  }

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
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(data.scopeName, style: theme.textTheme.headlineMedium),
                    const SizedBox(height: 8),
                    _ScopePill(data.scopeLabel),
                    const SizedBox(height: 12),
                    Text(
                      data.score.replaceAll(" 分", ""),
                      style: theme.textTheme.displaySmall?.copyWith(
                        fontWeight: FontWeight.w900,
                        letterSpacing: -1.0,
                      ),
                    ),
                    Text(data.status, style: theme.textTheme.titleMedium),
                  ],
                ),
              ),
              const SizedBox(width: 14),
              if (data.radar.isNotEmpty)
                GestureDetector(
                  onTap: () => _showRadarSheet(context, data),
                  child: SizedBox(
                    width: 150,
                    height: 150,
                    child: LooRadarChart(
                      height: 150,
                      showLabels: false,
                      points: data.radar
                          .map((point) => LooRadarPoint(
                                label: point.dimension,
                                value: point.value,
                              ))
                          .toList(),
                    ),
                  ),
                ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoPill(
                "最强 ${data.strongestDimension.label} ${data.strongestDimension.value}",
              ),
              _InfoPill(
                "最弱 ${data.weakestDimension.label} ${data.weakestDimension.value}",
              ),
              if (data.recommendationBridge != null)
                _InfoPill(
                  data.recommendationBridge!.isReady ? "可修复" : "待进货",
                ),
            ],
          ),
          if (data.isAccountScope && data.scopeDetail.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              data.scopeDetail,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: theme.textTheme.bodySmall?.copyWith(
                color: tokens.mutedText,
              ),
            ),
          ],
        ],
      ),
    );
  }

  void _showRadarSheet(BuildContext context, MobileHealthSnapshot data) {
    showLooFloatingSheet<void>(
      context: context,
      builder: (context) => SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    "健康雷达",
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close_rounded),
                  tooltip: "关闭",
                ),
              ],
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: LooRadarChart(
                height: 300,
                points: data.radar
                    .map((point) => LooRadarPoint(
                          label: point.dimension,
                          value: point.value,
                        ))
                    .toList(),
              ),
            ),
            const SizedBox(height: 12),
            ...data.radar.map(_RadarTile.new),
          ],
        ),
      ),
    );
  }
}

class _LooHealthBriefingCard extends StatefulWidget {
  const _LooHealthBriefingCard({
    required this.data,
    required this.apiClient,
    required this.accountId,
  });

  final MobileHealthSnapshot data;
  final LooApiClient apiClient;
  final String? accountId;

  @override
  State<_LooHealthBriefingCard> createState() => _LooHealthBriefingCardState();
}

class _LooHealthBriefingCardState extends State<_LooHealthBriefingCard> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    final summary = _briefingSummary(widget.data);
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(18),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Row(
              children: [
                Icon(Icons.auto_awesome_outlined, color: tokens.accent),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Loo皇批注", style: theme.textTheme.titleLarge),
                      const SizedBox(height: 4),
                      Text(
                        summary,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: tokens.mutedText,
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                Wrap(
                  spacing: 6,
                  children: [
                    if (widget.data.actionQueue.isNotEmpty)
                      _InfoPill("${widget.data.actionQueue.length} 行动"),
                    const _InfoPill("巡阅"),
                  ],
                ),
                AnimatedRotation(
                  turns: _expanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 180),
                  child: const Icon(Icons.keyboard_arrow_down_rounded),
                ),
              ],
            ),
          ),
          if (_expanded) ...[
            if (widget.data.highlights.isNotEmpty) ...[
              const SizedBox(height: 14),
              _InlineBriefSection(
                title: "批注",
                icon: Icons.format_quote_rounded,
                items: widget.data.highlights,
              ),
            ],
            if (widget.data.actionQueue.isNotEmpty) ...[
              const SizedBox(height: 12),
              _InlineBriefSection(
                title: "优先行动",
                icon: Icons.task_alt,
                items: widget.data.actionQueue,
              ),
            ],
            const SizedBox(height: 12),
            AiAnalysisCard(
              apiClient: widget.apiClient,
              title: widget.accountId == null ? "Loo皇巡阅国库" : "Loo皇巡阅账户",
              description: widget.accountId == null
                  ? "先用组合健康、投资偏好和已保存资料生成确定性判断；Loo皇深度思考需手动点击。"
                  : "先用当前账户持仓、账户类型和偏好生成确定性判断；Loo皇深度思考需手动点击。",
              collapseDescriptionToInfo: true,
              payload: {
                "scope": widget.accountId == null ? "portfolio" : "account",
                "mode": "quick",
                if (widget.accountId != null) "accountId": widget.accountId,
              },
            ),
          ],
        ],
      ),
    );
  }

  String _briefingSummary(MobileHealthSnapshot data) {
    if (data.highlights.isNotEmpty) {
      return data.highlights.first;
    }
    if (data.actionQueue.isNotEmpty) {
      return data.actionQueue.first;
    }
    return "展开查看批注、优先行动和 Loo皇巡阅。";
  }
}

class _InlineBriefSection extends StatelessWidget {
  const _InlineBriefSection({
    required this.title,
    required this.icon,
    required this.items,
  });

  final String title;
  final IconData icon;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Icon(icon, size: 18, color: tokens.accent),
            const SizedBox(width: 8),
            Text(title, style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
        const SizedBox(height: 8),
        ...items.take(3).map(
              (item) => Padding(
                padding: const EdgeInsets.only(bottom: 7),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("•", style: TextStyle(color: tokens.accent)),
                    const SizedBox(width: 8),
                    Expanded(child: Text(item)),
                  ],
                ),
              ),
            ),
      ],
    );
  }
}

class _RecommendationBridgeCard extends StatelessWidget {
  const _RecommendationBridgeCard(this.bridge, {required this.onTap});

  final MobileHealthRecommendationBridge bridge;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    final color = bridge.isBlocked
        ? Theme.of(context).colorScheme.error
        : bridge.isReady
            ? Colors.green.shade300
            : tokens.accent;
    return LooGlassCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(bridge.title, style: theme.textTheme.titleLarge),
              ),
              Icon(Icons.arrow_forward_ios, size: 16, color: tokens.mutedText),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            bridge.detail,
            style: theme.textTheme.bodyMedium?.copyWith(
              color: tokens.mutedText,
            ),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (bridge.securitySymbol != null)
                _InfoPill(bridge.securitySymbol!),
              if (bridge.targetAssetClass != null)
                _InfoPill(bridge.targetAssetClass!),
              if (bridge.targetAccount != null)
                _InfoPill(bridge.targetAccount!),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.12),
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Padding(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                  child: Text(
                    bridge.actionLabel,
                    style: theme.textTheme.labelMedium?.copyWith(
                      color: color,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
              ),
            ],
          ),
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

class _DimensionCard extends StatelessWidget {
  const _DimensionCard(this.dimension);

  final MobileHealthDimension dimension;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: ExpansionTile(
        tilePadding: EdgeInsets.zero,
        childrenPadding: EdgeInsets.zero,
        shape: const Border(),
        collapsedShape: const Border(),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Text(
                    dimension.label,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
                Text(
                  dimension.score.replaceAll(" 分", ""),
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ],
            ),
            const SizedBox(height: 8),
            _TargetProgressBar(value: dimension.scoreValue / 100),
            if (dimension.summary.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(
                dimension.summary,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: context.looTokens.mutedText,
                    ),
              ),
            ],
          ],
        ),
        subtitle: Text(dimension.status),
        children: [
          ...dimension.drivers.take(3).map(_smallBullet),
          ...dimension.consequences.take(2).map(_impactBullet),
          ...dimension.actions.take(3).map(_actionBullet),
        ],
      ),
    );
  }
}

class _AccountDrilldownCarousel extends StatefulWidget {
  const _AccountDrilldownCarousel({
    required this.items,
    required this.onOpenDetail,
  });

  final List<MobileHealthDrilldownItem> items;
  final ValueChanged<MobileHealthDrilldownItem> onOpenDetail;

  @override
  State<_AccountDrilldownCarousel> createState() =>
      _AccountDrilldownCarouselState();
}

class _AccountDrilldownCarouselState extends State<_AccountDrilldownCarousel> {
  final PageController _pageController = PageController();
  int _selectedIndex = 0;

  @override
  void dispose() {
    _pageController.dispose();
    super.dispose();
  }

  void _select(int index) {
    setState(() => _selectedIndex = index);
    _pageController.animateToPage(
      1,
      duration: const Duration(milliseconds: 260),
      curve: Curves.easeOutCubic,
    );
  }

  @override
  Widget build(BuildContext context) {
    final selected =
        widget.items[_selectedIndex.clamp(0, widget.items.length - 1)];
    return LooGlassCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  "账户巡查",
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              _InfoPill("${widget.items.length} 项"),
            ],
          ),
          const SizedBox(height: 10),
          SizedBox(
            height: 260,
            child: PageView(
              controller: _pageController,
              children: [
                _AccountDrilldownList(
                  items: widget.items,
                  selectedIndex: _selectedIndex,
                  onSelect: _select,
                ),
                _AccountDrilldownDetail(
                  item: selected,
                  onBack: () => _pageController.animateToPage(
                    0,
                    duration: const Duration(milliseconds: 240),
                    curve: Curves.easeOutCubic,
                  ),
                  onOpenDetail: () => widget.onOpenDetail(selected),
                ),
              ],
            ),
          ),
          const SizedBox(height: 8),
          const Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _CarouselDot(active: true),
              SizedBox(width: 6),
              _CarouselDot(active: false),
            ],
          ),
        ],
      ),
    );
  }
}

class _AccountDrilldownList extends StatelessWidget {
  const _AccountDrilldownList({
    required this.items,
    required this.selectedIndex,
    required this.onSelect,
  });

  final List<MobileHealthDrilldownItem> items;
  final int selectedIndex;
  final ValueChanged<int> onSelect;

  @override
  Widget build(BuildContext context) {
    return ListView.separated(
      padding: EdgeInsets.zero,
      itemCount: items.length,
      separatorBuilder: (_, __) => const SizedBox(height: 8),
      itemBuilder: (context, index) {
        final item = items[index];
        final selected = index == selectedIndex;
        return InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => onSelect(index),
          child: DecoratedBox(
            decoration: BoxDecoration(
              color: Theme.of(context)
                  .colorScheme
                  .surface
                  .withValues(alpha: selected ? 0.34 : 0.18),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(
                color: selected
                    ? context.looTokens.accent.withValues(alpha: 0.45)
                    : context.looTokens.cardBorder,
              ),
            ),
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          item.label,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 4),
                        Text(
                          item.status,
                          style:
                              Theme.of(context).textTheme.bodySmall?.copyWith(
                                    color: context.looTokens.mutedText,
                                  ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 10),
                  _InfoPill(item.score),
                  const Icon(Icons.chevron_right_rounded),
                ],
              ),
            ),
          ),
        );
      },
    );
  }
}

class _AccountDrilldownDetail extends StatelessWidget {
  const _AccountDrilldownDetail({
    required this.item,
    required this.onBack,
    required this.onOpenDetail,
  });

  final MobileHealthDrilldownItem item;
  final VoidCallback onBack;
  final VoidCallback onOpenDetail;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            IconButton(
              visualDensity: VisualDensity.compact,
              onPressed: onBack,
              icon: const Icon(Icons.chevron_left_rounded),
            ),
            Expanded(
              child: Text(
                item.label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleLarge,
              ),
            ),
            _InfoPill(item.score),
          ],
        ),
        const SizedBox(height: 8),
        Text(
          item.summary,
          maxLines: 3,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                color: tokens.mutedText,
              ),
        ),
        const SizedBox(height: 10),
        ...item.drivers.take(2).map(_smallBullet),
        ...item.actions.take(2).map(_actionBullet),
        const Spacer(),
        Align(
          alignment: Alignment.centerLeft,
          child: TextButton.icon(
            onPressed: onOpenDetail,
            icon: const Icon(Icons.open_in_new_rounded),
            label: const Text("查看账户详情"),
          ),
        ),
      ],
    );
  }
}

class _CarouselDot extends StatelessWidget {
  const _CarouselDot({required this.active});

  final bool active;

  @override
  Widget build(BuildContext context) {
    return AnimatedContainer(
      duration: const Duration(milliseconds: 180),
      width: active ? 18 : 6,
      height: 6,
      decoration: BoxDecoration(
        color: context.looTokens.accent.withValues(alpha: active ? 0.9 : 0.28),
        borderRadius: BorderRadius.circular(999),
      ),
    );
  }
}

class _HoldingDragSection extends StatefulWidget {
  const _HoldingDragSection({
    required this.items,
    required this.onTap,
  });

  final List<MobileHealthDrilldownItem> items;
  final ValueChanged<MobileHealthDrilldownItem> onTap;

  @override
  State<_HoldingDragSection> createState() => _HoldingDragSectionState();
}

class _HoldingDragSectionState extends State<_HoldingDragSection> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final visibleItems =
        _expanded ? widget.items : widget.items.take(3).toList();
    final hiddenCount = widget.items.length - visibleItems.length;
    return LooGlassCard(
      padding: const EdgeInsets.fromLTRB(16, 14, 16, 6),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(16),
            onTap: widget.items.length > 3
                ? () => setState(() => _expanded = !_expanded)
                : null,
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    "主要拖累持仓",
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                _InfoPill("${widget.items.length} 项"),
                if (widget.items.length > 3) ...[
                  const SizedBox(width: 6),
                  AnimatedRotation(
                    turns: _expanded ? 0.5 : 0,
                    duration: const Duration(milliseconds: 180),
                    child: const Icon(Icons.keyboard_arrow_down_rounded),
                  ),
                ],
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            "默认只看最需要处理的持仓；展开后查看完整诊断。",
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
          const SizedBox(height: 10),
          ...visibleItems.map(
            (item) => _HoldingDragCard(
              item,
              onTap: () => widget.onTap(item),
            ),
          ),
          if (!_expanded && hiddenCount > 0)
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => setState(() => _expanded = true),
                icon: const Icon(Icons.expand_more_rounded),
                label: Text("展开剩余 $hiddenCount 项"),
              ),
            ),
        ],
      ),
    );
  }
}

class _HoldingDragCard extends StatelessWidget {
  const _HoldingDragCard(this.item, {this.onTap});

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
        ...item.actions.take(1).map((action) => "建议：$action"),
      ].join("\n"),
      value: item.drivers.isNotEmpty ? "影响项" : "${item.score} 分",
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

Widget _impactBullet(String item) {
  return Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Text("影响：$item"),
  );
}

Widget _actionBullet(String item) {
  return Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Text("行动：$item"),
  );
}

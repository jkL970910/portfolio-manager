import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "account_type_portfolio_page.dart";
import "ai_analysis_card.dart";
import "detail_state_widgets.dart";
import "holding_detail_page.dart";

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

    return MobileHealthSnapshot.fromJson(data);
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
      body: FutureBuilder<MobileHealthSnapshot>(
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
                if (widget.accountId == null) ...[
                  const SizedBox(height: 12),
                  AiAnalysisCard(
                    apiClient: widget.apiClient,
                    title: "AI 组合快扫",
                    payload: const {
                      "scope": "portfolio",
                      "mode": "quick",
                    },
                  ),
                ] else ...[
                  const SizedBox(height: 12),
                  AiAnalysisCard(
                    apiClient: widget.apiClient,
                    title: "AI 账户快扫",
                    description: "基于当前账户持仓、账户类型、投资偏好和本地报价缓存生成，不包含实时新闻或论坛情绪。",
                    payload: {
                      "scope": "account",
                      "mode": "quick",
                      "accountId": widget.accountId,
                    },
                  ),
                ],
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
    );
  }

  void _openHoldingDetail(MobileHealthDrilldownItem item) {
    if (item.id.isEmpty) {
      return;
    }
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => HoldingDetailPage(
          apiClient: widget.apiClient,
          holdingId: item.id,
          fallbackTitle: item.label,
        ),
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
  });

  final String id;
  final String label;
  final String score;
  final String status;
  final String summary;
  final List<String> drivers;
  final List<String> actions;

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
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard(this.data);

  final MobileHealthSnapshot data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      clipBehavior: Clip.antiAlias,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              theme.colorScheme.primaryContainer,
              theme.colorScheme.surface,
            ],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(data.scopeName, style: theme.textTheme.headlineMedium),
              const SizedBox(height: 10),
              _ScopePill(data.scopeLabel),
              const SizedBox(height: 8),
              Text(data.scopeDetail),
              const SizedBox(height: 14),
              Text(data.score, style: theme.textTheme.displaySmall),
              const SizedBox(height: 8),
              Text(data.status),
              const SizedBox(height: 14),
              Text(
                  "最强：${data.strongestDimension.label} · ${data.strongestDimension.value}"),
              const SizedBox(height: 4),
              Text(
                  "最弱：${data.weakestDimension.label} · ${data.weakestDimension.value}"),
            ],
          ),
        ),
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
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color: theme.colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
        child: Text(label, style: theme.textTheme.bodySmall),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
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
          LinearProgressIndicator(value: progress),
        ],
      ),
    );
  }
}

class _RadarCard extends StatelessWidget {
  const _RadarCard(this.points);

  final List<MobileHealthRadarPoint> points;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 12),
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
      ),
    );
  }
}

class _DimensionCard extends StatelessWidget {
  const _DimensionCard(this.dimension);

  final MobileHealthDimension dimension;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("${dimension.label} · ${dimension.score}",
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 6),
            Text(dimension.status),
            if (dimension.summary.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(dimension.summary),
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
    return Card(
      child: ListTile(
        onTap: onTap,
        title: Text(item.label),
        subtitle: Text(
          [
            item.status,
            if (item.summary.isNotEmpty) item.summary,
            ...item.drivers.take(2),
            ...item.actions.take(2).map((action) => "行动：$action"),
          ].join("\n"),
        ),
        trailing: Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          children: [
            Text(item.score, style: Theme.of(context).textTheme.titleMedium),
            if (onTap != null) const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}

Widget _smallBullet(String item) {
  return Padding(
    padding: const EdgeInsets.only(top: 6),
    child: Text("• $item"),
  );
}

import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../app/mobile_routes.dart";
import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/loo_minister_context_models.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "../../shared/presentation/loo_minister_scope.dart";
import "detail_state_widgets.dart";
import "health_score_page.dart";

class AccountDetailPage extends StatefulWidget {
  const AccountDetailPage({
    required this.apiClient,
    required this.accountId,
    required this.fallbackTitle,
    super.key,
  });

  final LooApiClient apiClient;
  final String accountId;
  final String fallbackTitle;

  @override
  State<AccountDetailPage> createState() => _AccountDetailPageState();
}

class _AccountDetailPageState extends State<AccountDetailPage> {
  late Future<MobileAccountDetailSnapshot?> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  Future<MobileAccountDetailSnapshot?> _loadSnapshot() async {
    final response =
        await widget.apiClient.getPortfolioAccountDetail(widget.accountId);
    final data = response["data"];
    if (data == null) {
      return null;
    }
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("账户详情格式不正确。");
    }

    final snapshot = MobileAccountDetailSnapshot.fromJson(data);
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
      appBar: AppBar(
        title: Text(widget.fallbackTitle),
        actions: [
          IconButton(
            tooltip: "编辑账户",
            onPressed: _openEditAccountSheet,
            icon: const Icon(Icons.edit_outlined),
          ),
          IconButton(
              tooltip: "删除账户",
              onPressed: _confirmDeleteAccount,
              icon: const Icon(Icons.delete_outline)),
        ],
      ),
      body: FutureBuilder<MobileAccountDetailSnapshot?>(
        future: _snapshot,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LooPageGradient(
              child: Center(child: CircularProgressIndicator()),
            );
          }

          if (snapshot.hasError) {
            return LooPageGradient(
              child: DetailErrorState(
                title: "账户详情暂时打不开",
                message: snapshot.error.toString(),
                onRetry: _refresh,
              ),
            );
          }

          if (!snapshot.hasData) {
            return LooPageGradient(
              child: DetailNotFoundState(
                title: "没有找到这个账户",
                message: "这个账户可能已被删除、合并，或当前登录身份没有访问权限。",
                onRetry: _refresh,
              ),
            );
          }

          final data = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: LooPageGradient(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                children: [
                  _SummaryCard(data),
                  const SizedBox(height: 12),
                  if (data.accountValueChart != null ||
                      data.performance.isNotEmpty) ...[
                    _AccountTrendCard(
                      chart: data.accountValueChart,
                      fallbackPoints: data.performance,
                    ),
                    const SizedBox(height: 12),
                  ],
                  _HealthCard(
                    data.healthScore,
                    onTap: () => _openHealthScore(data),
                  ),
                  if (data.allocation.isNotEmpty) ...[
                    const SizedBox(height: 12),
                    _AllocationChartCard(data.allocation),
                  ],
                  const SizedBox(height: 16),
                  _AccountHoldingsPreview(
                    holdings: data.holdings,
                    onOpenHolding: _openHoldingDetail,
                  ),
                  if (data.facts.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    _CompactFactsCard(
                      title: "账户事实",
                      facts: data.facts,
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  void _openHoldingDetail(MobileHoldingCard holding) {
    context.push(
      MobileRoutes.securityDetail(
        symbol: holding.symbol,
        securityId: holding.securityId.isEmpty ? null : holding.securityId,
        exchange: holding.exchange.isEmpty ? null : holding.exchange,
        currency: holding.currency.isEmpty ? null : holding.currency,
      ),
    );
  }

  void _openHealthScore(MobileAccountDetailSnapshot data) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => HealthScorePage(
          apiClient: widget.apiClient,
          accountId: widget.accountId,
          fallbackTitle: "${data.name}健康巡查",
        ),
      ),
    );
  }

  Future<void> _openEditAccountSheet() async {
    final current = await _snapshot;
    if (!mounted || current == null) {
      return;
    }

    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _EditAccountSheet(
        apiClient: widget.apiClient,
        accountId: widget.accountId,
        account: current,
      ),
    );
    if (updated == true && mounted) {
      _refresh();
    }
  }

  Future<void> _confirmDeleteAccount() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("删除账户？"),
        content: const Text("删除账户会移除这个账户及其相关持仓。这个操作不能撤销。"),
        actions: [
          TextButton(
              onPressed: () => Navigator.of(context).pop(false),
              child: const Text("取消")),
          FilledButton.tonal(
              onPressed: () => Navigator.of(context).pop(true),
              child: const Text("删除")),
        ],
      ),
    );

    if (confirmed != true) {
      return;
    }

    try {
      await widget.apiClient.deletePortfolioAccount(widget.accountId);
      if (mounted) {
        Navigator.of(context).pop();
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.toString())),
        );
      }
    }
  }
}

class MobileAccountDetailSnapshot {
  const MobileAccountDetailSnapshot({
    required this.name,
    required this.typeId,
    required this.institution,
    required this.currency,
    required this.value,
    required this.gainLoss,
    required this.portfolioShare,
    required this.room,
    required this.subtitle,
    required this.summaryPoints,
    required this.performance,
    required this.accountValueChart,
    required this.allocation,
    required this.healthScore,
    required this.facts,
    required this.holdings,
  });

  final String name;
  final String typeId;
  final String institution;
  final String currency;
  final String value;
  final String gainLoss;
  final String portfolioShare;
  final String room;
  final String subtitle;
  final List<String> summaryPoints;
  final List<MobileAccountPerformancePoint> performance;
  final MobileChartSeries? accountValueChart;
  final List<MobileAllocationPoint> allocation;
  final MobileAccountHealthScore healthScore;
  final List<MobileFact> facts;
  final List<MobileHoldingCard> holdings;

  LooMinisterPageContext toMinisterContext({
    required String accountId,
    required String asOf,
  }) {
    final chart = accountValueChart;
    return LooMinisterPageContext(
      page: "account-detail",
      title: "$name账户详情",
      asOf: asOf,
      displayCurrency: currency.isEmpty ? "CAD" : currency,
      subject: LooMinisterSubject(accountId: accountId),
      dataFreshness: LooMinisterDataFreshness(
        chartFreshness: _toMinisterChartFreshness(chart?.freshness.status),
        sourceMode: _toMinisterSourceMode(chart?.sourceMode),
      ),
      facts: [
        LooMinisterFact(id: "account-value", label: "账户市值", value: value),
        if (gainLoss.isNotEmpty)
          LooMinisterFact(id: "gain-loss", label: "账户盈亏", value: gainLoss),
        if (portfolioShare.isNotEmpty)
          LooMinisterFact(
            id: "portfolio-share",
            label: "组合占比",
            value: portfolioShare,
          ),
        LooMinisterFact(
          id: "health-score",
          label: "账户健康分",
          value: healthScore.score,
          detail: healthScore.status,
          source: "analysis-cache",
        ),
        LooMinisterFact(
          id: "holding-count",
          label: "持仓数量",
          value: "${holdings.length} 个",
        ),
        if (chart != null)
          LooMinisterFact(
            id: "account-value-chart",
            label: chart.title,
            value: chart.freshness.label,
            detail: chart.freshness.detail,
            source: "portfolio-data",
          ),
        ...allocation.take(5).map(
              (item) => LooMinisterFact(
                id: "allocation-${_slug(item.name)}",
                label: "账户配置 ${item.name}",
                value: item.value,
                source: "analysis-cache",
              ),
            ),
        ...facts.take(5).map(
              (fact) => LooMinisterFact(
                id: "fact-${_slug(fact.label)}",
                label: fact.label,
                value: fact.value,
                detail: fact.detail,
              ),
            ),
      ],
      warnings: [
        ...summaryPoints.take(4),
        ...healthScore.highlights.take(3),
        ...healthScore.actions.take(3),
        if (chart != null && chart.notes.isNotEmpty) ...chart.notes.take(3),
      ],
      allowedActions: const [
        LooMinisterSuggestedAction(
          id: "open-account-health",
          label: "查看账户健康巡查",
          actionType: "navigate",
          target: {"page": "portfolio-health"},
        ),
        LooMinisterSuggestedAction(
          id: "run-account-analysis",
          label: "运行智能账户快扫",
          actionType: "run-analysis",
          target: {"scope": "account"},
          requiresConfirmation: true,
        ),
      ],
    );
  }

  factory MobileAccountDetailSnapshot.fromJson(Map<String, dynamic> json) {
    final account = json["account"];
    final accountData =
        account is Map<String, dynamic> ? account : const <String, dynamic>{};

    return MobileAccountDetailSnapshot(
      name: accountData["name"] as String? ?? "未知账户",
      typeId: accountData["typeId"] as String? ?? "Taxable",
      institution: accountData["institution"] as String? ?? "",
      currency: accountData["currency"] as String? ?? "CAD",
      value: accountData["value"] as String? ?? "--",
      gainLoss: accountData["gainLoss"] as String? ?? "",
      portfolioShare: accountData["portfolioShare"] as String? ?? "",
      room: accountData["room"] as String? ?? "",
      subtitle: [
        accountData["typeLabel"] as String? ?? "",
        accountData["institution"] as String? ?? "",
        accountData["portfolioShare"] as String? ?? "",
      ].where((item) => item.isNotEmpty).join(" · "),
      summaryPoints: (accountData["summaryPoints"] as List?)
              ?.whereType<String>()
              .toList() ??
          const [],
      performance: readJsonList(json, "performance")
          .map(MobileAccountPerformancePoint.fromJson)
          .toList(),
      accountValueChart: MobileChartSeries.fromJson(
        (json["chartSeries"] is Map<String, dynamic>
            ? json["chartSeries"] as Map<String, dynamic>
            : const <String, dynamic>{})["accountValue"],
      ),
      allocation: readJsonList(json, "allocation")
          .map(MobileAllocationPoint.fromJson)
          .toList(),
      healthScore: MobileAccountHealthScore.fromJson(json["healthScore"]),
      facts: readJsonList(json, "facts").map(MobileFact.fromJson).toList(),
      holdings: readJsonList(json, "holdings")
          .map(MobileHoldingCard.fromJson)
          .toList(),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard(this.data);

  final MobileAccountDetailSnapshot data;

  @override
  Widget build(BuildContext context) {
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
                    Text(data.name,
                        style: Theme.of(context).textTheme.headlineMedium),
                    SizedBox(height: tokens.gapXs),
                    Text(
                      data.subtitle.isEmpty ? "账户详情" : data.subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: tokens.mutedText,
                          ),
                    ),
                  ],
                ),
              ),
              _MiniPill(data.typeId),
            ],
          ),
          SizedBox(height: tokens.gapLg),
          Text(data.value, style: Theme.of(context).textTheme.displaySmall),
          SizedBox(height: tokens.gapSm),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (data.gainLoss.isNotEmpty) _MiniPill(data.gainLoss),
              if (data.portfolioShare.isNotEmpty)
                _MiniPill("组合 ${data.portfolioShare}"),
              if (data.room.isNotEmpty) _MiniPill(data.room),
            ],
          ),
          SizedBox(height: tokens.gapLg),
          _AccountMetricStrip(data),
        ],
      ),
    );
  }
}

class MobileAccountPerformancePoint {
  const MobileAccountPerformancePoint({
    required this.label,
    required this.displayValue,
    required this.chartValue,
  });

  final String label;
  final String displayValue;
  final double chartValue;

  factory MobileAccountPerformancePoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];
    return MobileAccountPerformancePoint(
      label: json["label"] as String? ?? "未知日期",
      displayValue: rawValue is num
          ? rawValue.toStringAsFixed(2)
          : rawValue?.toString() ?? "--",
      chartValue: rawValue is num ? rawValue.toDouble() : 0,
    );
  }
}

class _AccountTrendCard extends StatelessWidget {
  const _AccountTrendCard({
    required this.chart,
    required this.fallbackPoints,
  });

  final MobileChartSeries? chart;
  final List<MobileAccountPerformancePoint> fallbackPoints;

  @override
  Widget build(BuildContext context) {
    final allPoints = chart?.points
            .map((point) => AccountTrendPoint(
                  label: point.label,
                  displayValue: point.displayValue,
                  chartValue: point.value,
                  rawDate: DateTime.tryParse(point.rawDate ?? ""),
                ))
            .toList() ??
        fallbackPoints
            .map((point) => AccountTrendPoint(
                  label: point.label,
                  displayValue: point.displayValue,
                  chartValue: point.chartValue,
                  rawDate: null,
                ))
            .toList();

    return _AccountTrendRangeCard(
      title: chart?.title ?? "账户资产走势",
      trailing: chart?.freshness.label,
      allPoints: allPoints,
    );
  }
}

class AccountTrendPoint {
  const AccountTrendPoint({
    required this.label,
    required this.displayValue,
    required this.chartValue,
    required this.rawDate,
  });

  final String label;
  final String displayValue;
  final double chartValue;
  final DateTime? rawDate;
}

class _AccountTrendRangeCard extends StatefulWidget {
  const _AccountTrendRangeCard({
    required this.title,
    required this.trailing,
    required this.allPoints,
  });

  final String title;
  final String? trailing;
  final List<AccountTrendPoint> allPoints;

  @override
  State<_AccountTrendRangeCard> createState() => _AccountTrendRangeCardState();
}

class _AccountTrendRangeCardState extends State<_AccountTrendRangeCard> {
  _TrendRange _selectedRange = _TrendRange.threeMonths;

  @override
  Widget build(BuildContext context) {
    final allPoints = widget.allPoints;
    final enabledRanges = {
      for (final range in _TrendRange.values)
        range: _filteredPoints(allPoints, range).length >= 2,
    };
    if (enabledRanges[_selectedRange] != true) {
      _selectedRange = enabledRanges[_TrendRange.ytd] == true
          ? _TrendRange.ytd
          : _TrendRange.values.firstWhere(
              (range) => enabledRanges[range] == true,
              orElse: () => _TrendRange.ytd,
            );
    }
    final points = enabledRanges[_selectedRange] == true
        ? _filteredPoints(allPoints, _selectedRange)
        : allPoints;
    if (points.length < 2) {
      return const SizedBox.shrink();
    }

    final first = points.first;
    final last = points.last;
    final delta = last.chartValue - first.chartValue;
    final percent =
        first.chartValue == 0 ? 0.0 : delta / first.chartValue * 100;
    final tokens = context.looTokens;

    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            title: widget.title,
            trailing: widget.trailing,
          ),
          const SizedBox(height: 12),
          SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: _TrendRange.values.map((range) {
                final enabled = enabledRanges[range] == true;
                return Padding(
                  padding: const EdgeInsets.only(right: 8),
                  child: ChoiceChip(
                    label: Text(range.label),
                    selected: _selectedRange == range,
                    onSelected: enabled
                        ? (_) => setState(() => _selectedRange = range)
                        : null,
                  ),
                );
              }).toList(),
            ),
          ),
          const SizedBox(height: 12),
          LooLineChart(
            points: points
                .map(
                  (point) => LooLineChartPoint(
                    label: point.label,
                    value: point.chartValue,
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(
                child: Text(
                  "${first.label} → ${last.label}",
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
              ),
              Text(
                "${_selectedRange.label} ${_formatDelta(delta)} · ${_formatPercent(percent)}",
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: delta >= 0 ? tokens.success : tokens.danger,
                      fontWeight: FontWeight.w800,
                    ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  List<AccountTrendPoint> _filteredPoints(
    List<AccountTrendPoint> points,
    _TrendRange range,
  ) {
    if (points.length < 2) return points;
    final datedPoints = points.where((point) => point.rawDate != null).toList();
    if (datedPoints.length < 2) {
      return range == _TrendRange.ytd ? points : const [];
    }

    final latest = datedPoints
        .map((point) => point.rawDate!)
        .reduce((left, right) => left.isAfter(right) ? left : right);
    final cutoff = switch (range) {
      _TrendRange.oneDay => latest.subtract(const Duration(days: 1)),
      _TrendRange.oneWeek => latest.subtract(const Duration(days: 7)),
      _TrendRange.oneMonth => latest.subtract(const Duration(days: 31)),
      _TrendRange.threeMonths => latest.subtract(const Duration(days: 93)),
      _TrendRange.sixMonths => latest.subtract(const Duration(days: 186)),
      _TrendRange.oneYear => latest.subtract(const Duration(days: 366)),
      _TrendRange.ytd => DateTime(latest.year),
    };
    return points
        .where((point) =>
            point.rawDate != null && !point.rawDate!.isBefore(cutoff))
        .toList();
  }

  String _formatDelta(double value) {
    final sign = value >= 0 ? "+" : "-";
    final absValue = value.abs();
    if (absValue >= 1000000) {
      return "$sign\$${(absValue / 1000000).toStringAsFixed(1)}M";
    }
    if (absValue >= 1000) {
      return "$sign\$${(absValue / 1000).toStringAsFixed(1)}k";
    }
    return "$sign\$${absValue.toStringAsFixed(0)}";
  }

  String _formatPercent(double value) {
    final sign = value >= 0 ? "+" : "";
    return "$sign${value.toStringAsFixed(1)}%";
  }
}

enum _TrendRange {
  oneDay("1D"),
  oneWeek("1W"),
  oneMonth("1M"),
  threeMonths("3M"),
  sixMonths("6M"),
  oneYear("1Y"),
  ytd("YTD");

  const _TrendRange(this.label);

  final String label;
}

class MobileAllocationPoint {
  const MobileAllocationPoint({
    required this.name,
    required this.value,
    required this.rawValue,
  });

  final String name;
  final String value;
  final double rawValue;

  factory MobileAllocationPoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];
    final numericValue = rawValue is num ? rawValue.toDouble() : 0.0;

    return MobileAllocationPoint(
      name: json["name"] as String? ?? "未知配置",
      value: rawValue is num ? "${rawValue.toStringAsFixed(1)}%" : "--",
      rawValue: numericValue,
    );
  }
}

class MobileAccountHealthScore {
  const MobileAccountHealthScore({
    required this.score,
    required this.status,
    required this.highlights,
    required this.actions,
  });

  final String score;
  final String status;
  final List<String> highlights;
  final List<String> actions;

  factory MobileAccountHealthScore.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};

    return MobileAccountHealthScore(
      score: "${json["score"] ?? "--"} 分",
      status: json["status"] as String? ?? "待评估",
      highlights: (json["highlights"] as List?)?.whereType<String>().toList() ??
          const [],
      actions: (json["actionQueue"] as List?)?.whereType<String>().toList() ??
          const [],
    );
  }
}

String _toMinisterChartFreshness(String? value) {
  return switch (value) {
    "fresh" => "fresh",
    "stale" => "stale",
    "fallback" => "fallback",
    "reference" => "reference",
    _ => "unknown",
  };
}

String _toMinisterSourceMode(String? value) {
  return switch (value) {
    "local" => "local",
    "cached-external" => "cached-external",
    "live-external" => "live-external",
    "reference" => "reference",
    _ => "local",
  };
}

String _slug(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r"[^a-z0-9\u4e00-\u9fa5]+"), "-")
      .replaceAll(RegExp(r"^-+|-+$"), "");
}

class _AccountMetricStrip extends StatelessWidget {
  const _AccountMetricStrip(this.data);

  final MobileAccountDetailSnapshot data;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final metrics = [
      _MetricDatum("账户盈亏", _shortGainLoss(data.gainLoss)),
      _MetricDatum("组合占比", _portfolioShareValue(data.portfolioShare)),
      _MetricDatum("持仓数量", "${data.holdings.length} 个"),
      _MetricDatum("健康度", data.healthScore.score),
    ].where((item) => item.value.isNotEmpty && item.value != "--").toList();

    if (metrics.isEmpty) return const SizedBox.shrink();

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.28),
        borderRadius: BorderRadius.circular(tokens.radiusLg),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Padding(
        padding: EdgeInsets.all(tokens.gapMd),
        child: Row(
          children: [
            for (var index = 0; index < metrics.take(3).length; index++) ...[
              if (index > 0) SizedBox(width: tokens.gapSm),
              Expanded(child: _MetricCard(metrics[index])),
            ],
          ],
        ),
      ),
    );
  }

  String _shortGainLoss(String value) {
    final parts = value.split(RegExp(r"\s+"));
    return parts.isEmpty ? value : parts.first.trim();
  }

  String _portfolioShareValue(String value) {
    final percent = RegExp(r"[-+]?\d+(?:\.\d+)?%").firstMatch(value);
    return percent?.group(0) ?? value.replaceAll("大约占整个组合", "").trim();
  }
}

class _MetricDatum {
  const _MetricDatum(this.label, this.value);

  final String label;
  final String value;
}

class _MetricCard extends StatelessWidget {
  const _MetricCard(this.metric);

  final _MetricDatum metric;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          metric.label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.mutedText,
              ),
        ),
        const SizedBox(height: 6),
        Text(
          metric.value,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.titleMedium,
        ),
      ],
    );
  }
}

class _HealthCard extends StatelessWidget {
  const _HealthCard(this.health, {required this.onTap});

  final MobileAccountHealthScore health;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionHeader(title: "账户健康度", trailing: "健康分析 →"),
          const SizedBox(height: 12),
          Row(
            children: [
              Text(health.score.replaceAll(" 分", ""),
                  style: Theme.of(context).textTheme.displaySmall),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  health.status,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          ...[
            ...health.highlights.take(2),
            ...health.actions.take(1),
          ].map((item) => _BulletLine(item)),
        ],
      ),
    );
  }
}

class _AllocationTile extends StatelessWidget {
  const _AllocationTile(this.point);

  final MobileAllocationPoint point;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Expanded(child: Text(point.name)),
          Text(point.value, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

class _AllocationChartCard extends StatelessWidget {
  const _AllocationChartCard(this.points);

  final List<MobileAllocationPoint> points;

  @override
  Widget build(BuildContext context) {
    final shownPoints =
        points.where((point) => point.rawValue > 0).take(6).toList();
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionHeader(title: "账户配置"),
          const SizedBox(height: 14),
          LooDistributionBar(
            segments: shownPoints
                .map(
                  (point) => LooDistributionSegment(
                    label: point.name,
                    value: point.rawValue,
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 8),
          ...shownPoints.map(_AllocationTile.new),
        ],
      ),
    );
  }
}

class _CompactFactsCard extends StatelessWidget {
  const _CompactFactsCard({required this.title, required this.facts});

  final String title;
  final List<MobileFact> facts;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(title: title),
          const SizedBox(height: 10),
          ...facts.take(5).map(
                (fact) => Padding(
                  padding: const EdgeInsets.only(top: 8),
                  child: Row(
                    children: [
                      Expanded(child: Text(fact.label)),
                      Text(
                        fact.value,
                        style: Theme.of(context).textTheme.titleSmall,
                      ),
                    ],
                  ),
                ),
              ),
        ],
      ),
    );
  }
}

class _AccountHoldingsPreview extends StatefulWidget {
  const _AccountHoldingsPreview({
    required this.holdings,
    required this.onOpenHolding,
  });

  final List<MobileHoldingCard> holdings;
  final ValueChanged<MobileHoldingCard> onOpenHolding;

  @override
  State<_AccountHoldingsPreview> createState() =>
      _AccountHoldingsPreviewState();
}

class _AccountHoldingsPreviewState extends State<_AccountHoldingsPreview> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final shownHoldings =
        _expanded ? widget.holdings : widget.holdings.take(5).toList();
    final canExpand = widget.holdings.length > 5;

    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            title: "账户内持仓",
            trailing: _expanded || !canExpand
                ? "全部 ${widget.holdings.length} 个"
                : "预览 5/${widget.holdings.length}",
          ),
          SizedBox(height: tokens.gapSm),
          if (canExpand)
            _HoldingsViewToggle(
              expanded: _expanded,
              total: widget.holdings.length,
              onChanged: (expanded) => setState(() => _expanded = expanded),
            )
          else
            Text(
              "点击单项查看这笔仓位详情。",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.mutedText,
                  ),
            ),
          SizedBox(height: tokens.gapMd),
          if (shownHoldings.isEmpty)
            Text(
              "这个账户还没有持仓。",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.mutedText,
                  ),
            )
          else
            ...shownHoldings.map(
              (holding) => _CompactHoldingRow(
                holding,
                onTap: () => widget.onOpenHolding(holding),
              ),
            ),
          if (canExpand && !_expanded) ...[
            SizedBox(height: tokens.gapSm),
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton(
                onPressed: () => setState(() => _expanded = true),
                child: Text("展开全部 ${widget.holdings.length} 个持仓"),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HoldingsViewToggle extends StatelessWidget {
  const _HoldingsViewToggle({
    required this.expanded,
    required this.total,
    required this.onChanged,
  });

  final bool expanded;
  final int total;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.18),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _TogglePill(
            label: "预览 5 个",
            selected: !expanded,
            onTap: () => onChanged(false),
          ),
          _TogglePill(
            label: "全部 $total 个",
            selected: expanded,
            onTap: () => onChanged(true),
          ),
        ],
      ),
    );
  }
}

class _TogglePill extends StatelessWidget {
  const _TogglePill({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return InkWell(
      borderRadius: BorderRadius.circular(999),
      onTap: selected ? null : onTap,
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 160),
        curve: Curves.easeOutCubic,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
        decoration: BoxDecoration(
          color: selected
              ? tokens.accent.withValues(alpha: 0.24)
              : Colors.transparent,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: selected ? tokens.accent : tokens.mutedText,
                fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
              ),
        ),
      ),
    );
  }
}

class _CompactHoldingRow extends StatelessWidget {
  const _CompactHoldingRow(this.holding, {required this.onTap});

  final MobileHoldingCard holding;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return InkWell(
      borderRadius: BorderRadius.circular(tokens.radiusMd),
      onTap: onTap,
      child: Padding(
        padding: EdgeInsets.symmetric(vertical: tokens.gapSm),
        child: Row(
          children: [
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    "${holding.symbol} · ${holding.name}",
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  if (holding.weight.isNotEmpty) ...[
                    SizedBox(height: tokens.gapXs),
                    Text(
                      holding.weight,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: tokens.mutedText,
                          ),
                    ),
                  ],
                ],
              ),
            ),
            SizedBox(width: tokens.gapMd),
            Column(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Text(holding.value,
                    style: Theme.of(context).textTheme.titleSmall),
                if (holding.gainLoss.isNotEmpty) ...[
                  SizedBox(height: tokens.gapXs),
                  Text(
                    holding.gainLoss,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: holding.gainLoss.trim().startsWith("-")
                              ? tokens.danger
                              : tokens.success,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ],
              ],
            ),
            SizedBox(width: tokens.gapSm),
            Icon(Icons.chevron_right_rounded, color: tokens.mutedText),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.trailing});

  final String title;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
        if (trailing != null && trailing!.isNotEmpty)
          Text(
            trailing!,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: context.looTokens.accent,
                ),
          ),
      ],
    );
  }
}

class _BulletLine extends StatelessWidget {
  const _BulletLine(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 6),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("• ", style: TextStyle(color: context.looTokens.accent)),
          Expanded(child: Text(text)),
        ],
      ),
    );
  }
}

class _MiniPill extends StatelessWidget {
  const _MiniPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.38),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(label, style: Theme.of(context).textTheme.labelMedium),
      ),
    );
  }
}

class _EditAccountSheet extends StatefulWidget {
  const _EditAccountSheet({
    required this.apiClient,
    required this.accountId,
    required this.account,
  });

  final LooApiClient apiClient;
  final String accountId;
  final MobileAccountDetailSnapshot account;

  @override
  State<_EditAccountSheet> createState() => _EditAccountSheetState();
}

class _EditAccountSheetState extends State<_EditAccountSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _nicknameController =
      TextEditingController(text: widget.account.name);
  late final _institutionController =
      TextEditingController(text: widget.account.institution);
  final _roomController = TextEditingController(text: "0");

  late var _accountType = widget.account.typeId;
  late var _currency = widget.account.currency;
  var _submitting = false;
  String? _error;

  @override
  void dispose() {
    _nicknameController.dispose();
    _institutionController.dispose();
    _roomController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) {
      return;
    }

    setState(() {
      _submitting = true;
      _error = null;
    });

    try {
      await widget.apiClient.updatePortfolioAccount(
        accountId: widget.accountId,
        nickname: _nicknameController.text.trim(),
        institution: _institutionController.text.trim(),
        type: _accountType,
        currency: _currency,
        contributionRoomCad: double.tryParse(_roomController.text.trim()) ?? 0,
      );
      if (mounted) {
        Navigator.of(context).pop(true);
      }
    } catch (error) {
      if (mounted) {
        setState(() {
          _error = error.toString();
          _submitting = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;

    return Padding(
      padding: EdgeInsets.fromLTRB(20, 20, 20, bottomInset + 20),
      child: Form(
        key: _formKey,
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text("编辑账户", style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _accountType,
                decoration: const InputDecoration(labelText: "账户类型"),
                items: const [
                  DropdownMenuItem(value: "TFSA", child: Text("TFSA")),
                  DropdownMenuItem(value: "RRSP", child: Text("RRSP")),
                  DropdownMenuItem(value: "FHSA", child: Text("FHSA")),
                  DropdownMenuItem(value: "Taxable", child: Text("Taxable")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) =>
                        setState(() => _accountType = value ?? _accountType),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _nicknameController,
                enabled: !_submitting,
                decoration: const InputDecoration(labelText: "账户昵称"),
                validator: (value) =>
                    (value == null || value.trim().isEmpty) ? "请输入账户昵称" : null,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _institutionController,
                enabled: !_submitting,
                decoration: const InputDecoration(labelText: "机构"),
                validator: (value) => (value == null || value.trim().length < 2)
                    ? "机构至少 2 个字符"
                    : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _currency,
                decoration: const InputDecoration(labelText: "账户币种"),
                items: const [
                  DropdownMenuItem(value: "CAD", child: Text("CAD")),
                  DropdownMenuItem(value: "USD", child: Text("USD")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _currency = value ?? _currency),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _roomController,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "贡献额度 CAD"),
                validator: _validateMoney,
              ),
              if (_error != null) ...[
                const SizedBox(height: 12),
                Text(_error!,
                    style:
                        TextStyle(color: Theme.of(context).colorScheme.error)),
              ],
              const SizedBox(height: 18),
              SizedBox(
                width: double.infinity,
                child: FilledButton(
                  onPressed: _submitting ? null : _submit,
                  child: Text(_submitting ? "保存中..." : "保存账户"),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  String? _validateMoney(String? value) {
    final parsed = double.tryParse((value ?? "").trim());
    if (parsed == null || parsed < 0) {
      return "请输入大于等于 0 的数字";
    }
    return null;
  }
}

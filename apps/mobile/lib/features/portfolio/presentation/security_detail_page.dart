import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "ai_analysis_card.dart";
import "detail_state_widgets.dart";
import "holding_detail_page.dart";

class SecurityDetailPage extends StatefulWidget {
  const SecurityDetailPage({
    required this.apiClient,
    required this.symbol,
    required this.fallbackTitle,
    this.exchange,
    this.currency,
    super.key,
  });

  final LooApiClient apiClient;
  final String symbol;
  final String fallbackTitle;
  final String? exchange;
  final String? currency;

  @override
  State<SecurityDetailPage> createState() => _SecurityDetailPageState();
}

class _SecurityDetailPageState extends State<SecurityDetailPage> {
  late Future<MobileSecurityDetailSnapshot?> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  Future<MobileSecurityDetailSnapshot?> _loadSnapshot() async {
    final response = await widget.apiClient.getPortfolioSecurityDetail(
      widget.symbol,
      exchange: widget.exchange,
      currency: widget.currency,
    );
    final data = response["data"];
    if (data == null) {
      return null;
    }
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("标的详情格式不正确。");
    }

    return MobileSecurityDetailSnapshot.fromJson(data);
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
      body: FutureBuilder<MobileSecurityDetailSnapshot?>(
        future: _snapshot,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return DetailErrorState(
              title: "标的详情暂时打不开",
              message: snapshot.error.toString(),
              onRetry: _refresh,
            );
          }

          if (!snapshot.hasData) {
            return DetailNotFoundState(
              title: "没有找到这个标的",
              message: "这个标的可能尚未被解析，或当前账户里已经没有相关持仓。",
              onRetry: _refresh,
            );
          }

          final data = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                _SummaryCard(
                  data,
                ),
                const SizedBox(height: 12),
                AiAnalysisCard(
                  apiClient: widget.apiClient,
                  title: "AI 标的快扫",
                  payload: {
                    "scope": "security",
                    "mode": "quick",
                    "security": {
                      "symbol": data.symbol,
                      if (data.exchange.isNotEmpty) "exchange": data.exchange,
                      if (data.currency.isNotEmpty) "currency": data.currency,
                      "name": data.name,
                    },
                  },
                ),
                const SizedBox(height: 12),
                _MetricGrid(data),
                if (data.priceHistoryChart != null ||
                    data.performance.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const _SectionTitle("价格走势"),
                  const SizedBox(height: 8),
                  _PerformanceChartCard(
                    chart: data.priceHistoryChart,
                    fallbackPoints: data.performance,
                  ),
                ],
                const SizedBox(height: 16),
                if (data.summaryPoints.isNotEmpty) ...[
                  const _SectionTitle("Loo皇摘要"),
                  const SizedBox(height: 8),
                  _TextCard(data.summaryPoints.take(4).join("\n")),
                  const SizedBox(height: 16),
                ],
                const _SectionTitle("市场状态"),
                const SizedBox(height: 8),
                _MarketDataCard(data.marketData),
                const SizedBox(height: 16),
                const _SectionTitle("配置偏离"),
                const SizedBox(height: 8),
                _AnalysisCard(data.analysis),
                if (data.heldPosition != null) ...[
                  const SizedBox(height: 16),
                  const _SectionTitle("持有汇总"),
                  const SizedBox(height: 8),
                  _HeldPositionCard(data.heldPosition!),
                  if (data.heldPosition!.accountSummaries.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    const _SectionTitle("账户分布"),
                    const SizedBox(height: 8),
                    _AccountDistributionCard(data.heldPosition!),
                  ],
                ],
                const SizedBox(height: 16),
                const _SectionTitle("标的事实"),
                const SizedBox(height: 8),
                ...data.facts.map(_FactTile.new),
                const SizedBox(height: 16),
                const _SectionTitle("相关持仓"),
                const SizedBox(height: 8),
                ...data.relatedHoldings.map(
                  (holding) => _HoldingTile(
                    holding,
                    onTap: () => _openHoldingDetail(holding),
                  ),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _openHoldingDetail(MobileHoldingCard holding) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => HoldingDetailPage(
          apiClient: widget.apiClient,
          holdingId: holding.id,
          fallbackTitle: holding.symbol,
        ),
      ),
    );
  }
}

class MobileSecurityDetailSnapshot {
  const MobileSecurityDetailSnapshot({
    required this.symbol,
    required this.name,
    required this.assetClass,
    required this.sector,
    required this.currency,
    required this.exchange,
    required this.lastPrice,
    required this.quoteTimestamp,
    required this.freshnessVariant,
    required this.subtitle,
    required this.marketData,
    required this.analysis,
    required this.performance,
    required this.priceHistoryChart,
    required this.summaryPoints,
    required this.facts,
    required this.relatedHoldings,
    required this.heldPosition,
  });

  final String symbol;
  final String name;
  final String assetClass;
  final String sector;
  final String currency;
  final String exchange;
  final String lastPrice;
  final String quoteTimestamp;
  final String freshnessVariant;
  final String subtitle;
  final MobileSecurityMarketData marketData;
  final MobileSecurityAnalysis analysis;
  final List<MobileSecurityPerformancePoint> performance;
  final MobileChartSeries? priceHistoryChart;
  final List<String> summaryPoints;
  final List<MobileFact> facts;
  final List<MobileHoldingCard> relatedHoldings;
  final MobileHeldPosition? heldPosition;

  factory MobileSecurityDetailSnapshot.fromJson(Map<String, dynamic> json) {
    final security = json["security"];
    final securityData =
        security is Map<String, dynamic> ? security : const <String, dynamic>{};

    return MobileSecurityDetailSnapshot(
      symbol: securityData["symbol"] as String? ?? "--",
      name: securityData["name"] as String? ?? "未知标的",
      assetClass: securityData["assetClass"] as String? ?? "",
      sector: securityData["sector"] as String? ?? "",
      currency: securityData["currency"] as String? ?? "",
      exchange: securityData["exchange"] as String? ?? "",
      lastPrice: securityData["lastPrice"] as String? ?? "--",
      quoteTimestamp: securityData["quoteTimestamp"] as String? ?? "",
      freshnessVariant:
          securityData["freshnessVariant"] as String? ?? "neutral",
      subtitle: [
        securityData["assetClass"] as String? ?? "",
        securityData["sector"] as String? ?? "",
        securityData["exchange"] as String? ?? "",
      ].where((item) => item.isNotEmpty).join(" · "),
      marketData: MobileSecurityMarketData.fromJson(json["marketData"]),
      analysis: MobileSecurityAnalysis.fromJson(json["analysis"]),
      performance: readJsonList(json, "performance")
          .map(MobileSecurityPerformancePoint.fromJson)
          .toList(),
      priceHistoryChart: MobileChartSeries.fromJson(
        (json["chartSeries"] is Map<String, dynamic>
            ? json["chartSeries"] as Map<String, dynamic>
            : const <String, dynamic>{})["priceHistory"],
      ),
      summaryPoints:
          (json["summaryPoints"] as List?)?.whereType<String>().toList() ??
              const [],
      facts: readJsonList(json, "facts").map(MobileFact.fromJson).toList(),
      relatedHoldings: readJsonList(json, "relatedHoldings")
          .map(MobileHoldingCard.fromJson)
          .toList(),
      heldPosition: MobileHeldPosition.fromJson(json["heldPosition"]),
    );
  }
}

class MobileChartSeries {
  const MobileChartSeries({
    required this.title,
    required this.valueType,
    required this.sourceMode,
    required this.freshness,
    required this.points,
    required this.notes,
  });

  final String title;
  final String valueType;
  final String sourceMode;
  final MobileChartFreshness freshness;
  final List<MobileSecurityPerformancePoint> points;
  final List<String> notes;

  static MobileChartSeries? fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    final rawPoints = json["points"];
    final points = rawPoints is List
        ? rawPoints
            .whereType<Map<String, dynamic>>()
            .map(MobileSecurityPerformancePoint.fromChartPointJson)
            .toList()
        : const <MobileSecurityPerformancePoint>[];

    if (points.length < 2) return null;

    return MobileChartSeries(
      title: json["title"] as String? ?? "价格走势",
      valueType: json["valueType"] as String? ?? "index",
      sourceMode: json["sourceMode"] as String? ?? "local",
      freshness: MobileChartFreshness.fromJson(json["freshness"]),
      points: points,
      notes: (json["notes"] as List?)?.whereType<String>().toList() ?? const [],
    );
  }
}

class MobileChartFreshness {
  const MobileChartFreshness({
    required this.status,
    required this.label,
    required this.latestDate,
    required this.detail,
  });

  final String status;
  final String label;
  final String? latestDate;
  final String detail;

  factory MobileChartFreshness.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileChartFreshness(
      status: json["status"] as String? ?? "fallback",
      label: json["label"] as String? ?? "参考曲线",
      latestDate: json["latestDate"] as String?,
      detail: json["detail"] as String? ?? "请确认数据来源和更新时间。",
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard(this.data);

  final MobileSecurityDetailSnapshot data;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final freshnessColor = _freshnessColor(context, data.freshnessVariant);

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
              Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Text(
                      "${data.symbol} · ${data.name}",
                      style: theme.textTheme.headlineMedium,
                    ),
                  ),
                  _StatusPill(
                      label: _freshnessLabel(data.freshnessVariant),
                      color: freshnessColor),
                ],
              ),
              const SizedBox(height: 10),
              Text(data.lastPrice, style: theme.textTheme.displaySmall),
              const SizedBox(height: 8),
              Text(data.subtitle),
              if (data.quoteTimestamp.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(data.quoteTimestamp, style: theme.textTheme.bodySmall),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class MobileSecurityMarketData {
  const MobileSecurityMarketData({
    required this.summary,
    required this.notes,
    required this.facts,
  });

  final String summary;
  final List<String> notes;
  final List<MobileFact> facts;

  factory MobileSecurityMarketData.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};

    return MobileSecurityMarketData(
      summary: json["summary"] as String? ?? "市场状态待刷新。",
      notes: (json["notes"] as List?)?.whereType<String>().toList() ?? const [],
      facts: readJsonList(json, "facts").map(MobileFact.fromJson).toList(),
    );
  }
}

class MobileSecurityAnalysis {
  const MobileSecurityAnalysis({
    required this.assetClassLabel,
    required this.targetAllocation,
    required this.currentAllocation,
    required this.driftLabel,
    required this.portfolioShare,
    required this.targetAllocationPct,
    required this.currentAllocationPct,
    required this.portfolioSharePct,
    required this.summary,
  });

  final String assetClassLabel;
  final String targetAllocation;
  final String currentAllocation;
  final String driftLabel;
  final String portfolioShare;
  final double targetAllocationPct;
  final double currentAllocationPct;
  final double portfolioSharePct;
  final String summary;

  factory MobileSecurityAnalysis.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};

    return MobileSecurityAnalysis(
      assetClassLabel: json["assetClassLabel"] as String? ?? "未知资产类别",
      targetAllocation: json["targetAllocation"] as String? ?? "--",
      currentAllocation: json["currentAllocation"] as String? ?? "--",
      driftLabel: json["driftLabel"] as String? ?? "--",
      portfolioShare: json["portfolioShare"] as String? ?? "--",
      targetAllocationPct: _readDouble(json["targetAllocationPct"]),
      currentAllocationPct: _readDouble(json["currentAllocationPct"]),
      portfolioSharePct: _readDouble(json["portfolioSharePct"]),
      summary: json["summary"] as String? ?? "",
    );
  }
}

class MobileSecurityPerformancePoint {
  const MobileSecurityPerformancePoint({
    required this.label,
    required this.value,
    required this.chartValue,
  });

  final String label;
  final String value;
  final double chartValue;

  factory MobileSecurityPerformancePoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];

    return MobileSecurityPerformancePoint(
      label: json["label"] as String? ?? "未知表现",
      value: rawValue is num
          ? rawValue.toStringAsFixed(2)
          : rawValue?.toString() ?? "--",
      chartValue: rawValue is num ? rawValue.toDouble() : 0,
    );
  }

  factory MobileSecurityPerformancePoint.fromChartPointJson(
      Map<String, dynamic> json) {
    final rawValue = json["value"];
    return MobileSecurityPerformancePoint(
      label: json["displayLabel"] as String? ??
          json["rawDate"] as String? ??
          "未知日期",
      value: json["displayValue"] as String? ?? rawValue?.toString() ?? "--",
      chartValue: rawValue is num ? rawValue.toDouble() : 0,
    );
  }
}

class MobileHeldPosition {
  const MobileHeldPosition({
    required this.quantity,
    required this.avgCost,
    required this.costBasis,
    required this.value,
    required this.gainLoss,
    required this.portfolioShare,
    required this.accountCount,
    required this.summaryPoints,
    required this.accountSummaries,
  });

  final String quantity;
  final String avgCost;
  final String costBasis;
  final String value;
  final String gainLoss;
  final String portfolioShare;
  final String accountCount;
  final List<String> summaryPoints;
  final List<MobileHeldAccountSummary> accountSummaries;

  static MobileHeldPosition? fromJson(Object? value) {
    final json = value is Map<String, dynamic> ? value : null;
    final aggregate = json?["aggregate"];
    final aggregateData = aggregate is Map<String, dynamic> ? aggregate : null;
    if (aggregateData == null) {
      return null;
    }

    return MobileHeldPosition(
      quantity: aggregateData["quantity"] as String? ?? "--",
      avgCost: aggregateData["avgCost"] as String? ?? "--",
      costBasis: aggregateData["costBasis"] as String? ?? "--",
      value: aggregateData["value"] as String? ?? "--",
      gainLoss: aggregateData["gainLoss"] as String? ?? "",
      portfolioShare: aggregateData["portfolioShare"] as String? ?? "",
      accountCount: aggregateData["accountCount"] as String? ?? "",
      summaryPoints: (aggregateData["summaryPoints"] as List?)
              ?.whereType<String>()
              .toList() ??
          const [],
      accountSummaries: readJsonList(json!, "accountSummaries")
          .map(MobileHeldAccountSummary.fromJson)
          .toList(),
    );
  }
}

class MobileHeldAccountSummary {
  const MobileHeldAccountSummary({
    required this.accountLabel,
    required this.accountType,
    required this.value,
    required this.positionShare,
    required this.positionSharePct,
    required this.accountShare,
    required this.gainLoss,
  });

  final String accountLabel;
  final String accountType;
  final String value;
  final String positionShare;
  final double positionSharePct;
  final String accountShare;
  final String gainLoss;

  factory MobileHeldAccountSummary.fromJson(Map<String, dynamic> json) {
    return MobileHeldAccountSummary(
      accountLabel: json["accountLabel"] as String? ?? "未知账户",
      accountType: json["accountType"] as String? ?? "",
      value: json["value"] as String? ?? "--",
      positionShare: json["positionShare"] as String? ?? "--",
      positionSharePct: _readDouble(json["positionSharePct"]),
      accountShare: json["accountShare"] as String? ?? "",
      gainLoss: json["gainLoss"] as String? ?? "",
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid(this.data);

  final MobileSecurityDetailSnapshot data;

  @override
  Widget build(BuildContext context) {
    final held = data.heldPosition;
    final metrics = [
      _MetricDatum("最新价格", data.lastPrice),
      if (held != null) _MetricDatum("持有市值", held.value),
      if (held != null) _MetricDatum("持仓盈亏", held.gainLoss),
      if (held != null) _MetricDatum("组合占比", held.portfolioShare),
      if (held == null)
        _MetricDatum("相关持仓", "${data.relatedHoldings.length} 个"),
    ].where((item) => item.value.isNotEmpty && item.value != "--").toList();

    if (metrics.isEmpty) {
      return const SizedBox.shrink();
    }

    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: metrics.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 10,
        mainAxisSpacing: 10,
        childAspectRatio: 1.8,
      ),
      itemBuilder: (context, index) => _MetricCard(metrics[index]),
    );
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(14),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(metric.label, style: Theme.of(context).textTheme.bodyMedium),
            const Spacer(),
            Text(metric.value, style: Theme.of(context).textTheme.titleLarge),
          ],
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

class _TextCard extends StatelessWidget {
  const _TextCard(this.text);

  final String text;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(text),
      ),
    );
  }
}

class _MarketDataCard extends StatelessWidget {
  const _MarketDataCard(this.marketData);

  final MobileSecurityMarketData marketData;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(marketData.summary),
            ...marketData.notes.take(3).map(
                  (note) => Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text("• $note"),
                  ),
                ),
            ...marketData.facts.take(4).map(
                  (fact) => Padding(
                    padding: const EdgeInsets.only(top: 10),
                    child: Row(
                      children: [
                        Expanded(child: Text(fact.label)),
                        Text(fact.value,
                            style: Theme.of(context).textTheme.titleMedium),
                      ],
                    ),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _AnalysisCard extends StatelessWidget {
  const _AnalysisCard(this.analysis);

  final MobileSecurityAnalysis analysis;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(analysis.assetClassLabel,
                style: Theme.of(context).textTheme.titleLarge),
            if (analysis.summary.isNotEmpty) ...[
              const SizedBox(height: 8),
              Text(analysis.summary),
            ],
            const SizedBox(height: 14),
            _ProgressMetric(
              label: "目标配置",
              value: analysis.targetAllocation,
              progress: analysis.targetAllocationPct / 100,
            ),
            _ProgressMetric(
              label: "当前配置",
              value: analysis.currentAllocation,
              progress: analysis.currentAllocationPct / 100,
            ),
            _ProgressMetric(
              label: "本标的组合占比",
              value: analysis.portfolioShare,
              progress: analysis.portfolioSharePct / 100,
            ),
            const SizedBox(height: 8),
            Text("偏离：${analysis.driftLabel}",
                style: Theme.of(context).textTheme.titleMedium),
          ],
        ),
      ),
    );
  }
}

class _ProgressMetric extends StatelessWidget {
  const _ProgressMetric({
    required this.label,
    required this.value,
    required this.progress,
  });

  final String label;
  final String value;
  final double progress;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(child: Text(label)),
              Text(value, style: Theme.of(context).textTheme.titleSmall),
            ],
          ),
          const SizedBox(height: 6),
          LinearProgressIndicator(value: progress.clamp(0, 1)),
        ],
      ),
    );
  }
}

class _PerformanceChartCard extends StatelessWidget {
  const _PerformanceChartCard({
    required this.chart,
    required this.fallbackPoints,
  });

  final MobileChartSeries? chart;
  final List<MobileSecurityPerformancePoint> fallbackPoints;

  @override
  Widget build(BuildContext context) {
    final points = chart?.points ?? fallbackPoints;
    final first = points.first;
    final last = points.last;
    final freshness = chart?.freshness;
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
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
            Text(
              "${first.label} ${first.value} → ${last.label} ${last.value}",
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            if (freshness != null) ...[
              const SizedBox(height: 10),
              Chip(label: Text(freshness.label)),
              const SizedBox(height: 6),
              Text(
                freshness.detail,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
            if (chart != null && chart!.notes.isNotEmpty) ...[
              const SizedBox(height: 8),
              ...chart!.notes.take(2).map(
                    (note) => Text(
                      "· $note",
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ),
            ],
          ],
        ),
      ),
    );
  }
}

class _AccountDistributionCard extends StatelessWidget {
  const _AccountDistributionCard(this.position);

  final MobileHeldPosition position;

  @override
  Widget build(BuildContext context) {
    final accounts = position.accountSummaries
        .where((account) => account.positionSharePct > 0)
        .take(6)
        .toList();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LooDistributionBar(
              segments: accounts
                  .map(
                    (account) => LooDistributionSegment(
                      label: account.accountLabel,
                      value: account.positionSharePct,
                    ),
                  )
                  .toList(),
            ),
            const SizedBox(height: 12),
            ...accounts.map(
              (account) => Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Row(
                  children: [
                    Expanded(
                      child: Text(
                        [
                          account.accountLabel,
                          account.accountType,
                          account.accountShare,
                        ].where((item) => item.isNotEmpty).join(" · "),
                      ),
                    ),
                    Text(account.positionShare,
                        style: Theme.of(context).textTheme.titleSmall),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeldPositionCard extends StatelessWidget {
  const _HeldPositionCard(this.position);

  final MobileHeldPosition position;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(position.value, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text([
              position.quantity,
              position.avgCost,
              position.costBasis,
              position.accountCount,
            ].where((item) => item.isNotEmpty && item != "--").join(" · ")),
            ...position.summaryPoints.take(3).map(
                  (point) => Padding(
                    padding: const EdgeInsets.only(top: 8),
                    child: Text("• $point"),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _FactTile extends StatelessWidget {
  const _FactTile(this.fact);

  final MobileFact fact;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(fact.label),
        subtitle: Text(fact.detail),
        trailing:
            Text(fact.value, style: Theme.of(context).textTheme.titleLarge),
      ),
    );
  }
}

class _HoldingTile extends StatelessWidget {
  const _HoldingTile(this.holding, {required this.onTap});

  final MobileHoldingCard holding;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        onTap: onTap,
        title: Text("${holding.symbol} · ${holding.name}"),
        subtitle: Text(holding.detail),
        trailing: Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          children: [
            Text(holding.value, style: Theme.of(context).textTheme.titleLarge),
            const Icon(Icons.chevron_right),
          ],
        ),
      ),
    );
  }
}

class _StatusPill extends StatelessWidget {
  const _StatusPill({required this.label, required this.color});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.14),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.45)),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(
          label,
          style:
              Theme.of(context).textTheme.labelMedium?.copyWith(color: color),
        ),
      ),
    );
  }
}

Color _freshnessColor(BuildContext context, String variant) {
  return switch (variant) {
    "success" => Colors.green.shade700,
    "warning" => Colors.orange.shade800,
    _ => Theme.of(context).colorScheme.onSurfaceVariant,
  };
}

String _freshnessLabel(String variant) {
  return switch (variant) {
    "success" => "报价新鲜",
    "warning" => "需要刷新",
    _ => "报价待核",
  };
}

double _readDouble(Object? value) {
  return value is num ? value.toDouble() : 0.0;
}

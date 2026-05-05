import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../intelligence/data/daily_intelligence_models.dart";
import "../../intelligence/presentation/daily_intelligence_card.dart";
import "../data/mobile_home_models.dart";
import "../../portfolio/presentation/account_detail_page.dart";
import "../../portfolio/presentation/health_score_page.dart";
import "../../portfolio/presentation/holding_detail_page.dart";
import "../../portfolio/presentation/security_detail_page.dart";
import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "../../shared/presentation/loo_minister_scope.dart";

class OverviewPage extends StatefulWidget {
  const OverviewPage({
    required this.apiClient,
    super.key,
  });

  final LooApiClient apiClient;

  @override
  State<OverviewPage> createState() => _OverviewPageState();
}

class _OverviewPageState extends State<OverviewPage> {
  late Future<MobileHomeSnapshot> _snapshot;
  late Future<MobileDailyIntelligenceSnapshot> _dailyIntelligence;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
    _dailyIntelligence = _loadDailyIntelligence();
  }

  Future<MobileHomeSnapshot> _loadSnapshot() async {
    final response = await widget.apiClient.getMobileHome();
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("总览数据格式不正确。");
    }

    final snapshot = MobileHomeSnapshot.fromJson(data);
    if (mounted) {
      LooMinisterScope.report(
        context,
        snapshot.toMinisterContext(
            asOf: DateTime.now().toUtc().toIso8601String()),
      );
    }
    return snapshot;
  }

  Future<MobileDailyIntelligenceSnapshot> _loadDailyIntelligence() async {
    final response = await widget.apiClient.getDailyIntelligence(limit: 8);
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("今日秘闻数据格式不正确。");
    }
    return MobileDailyIntelligenceSnapshot.fromJson(data);
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
      _dailyIntelligence = _loadDailyIntelligence();
    });
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MobileHomeSnapshot>(
      future: _snapshot,
      builder: (context, snapshot) {
        return RefreshIndicator(
          onRefresh: () async => _refresh(),
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: _PageHeader(
                  title: "Loo国总览",
                  subtitle: snapshot.hasData
                      ? "欢迎回来，${snapshot.data!.viewerName}"
                      : "正在召集 Loo 国财政大臣...",
                ),
              ),
              if (snapshot.connectionState == ConnectionState.waiting)
                const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()))
              else if (snapshot.hasError)
                SliverFillRemaining(
                  child: _ErrorState(
                      message: snapshot.error.toString(), onRetry: _refresh),
                )
              else if (snapshot.hasData)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
                  sliver: SliverList.list(
                    children: [
                      _MetricGrid(metrics: snapshot.data!.metrics),
                      if (snapshot.data!.fxContext.hasContent) ...[
                        const SizedBox(height: 18),
                        _FxContextCard(snapshot.data!.fxContext),
                      ],
                      if (snapshot.data!.netWorthChart != null ||
                          snapshot.data!.netWorthTrend.isNotEmpty) ...[
                        const SizedBox(height: 18),
                        _OverviewTrendCard(
                          chart: snapshot.data!.netWorthChart,
                          fallbackPoints: snapshot.data!.netWorthTrend,
                        ),
                      ],
                      if (snapshot.data!.marketSentiment != null) ...[
                        const SizedBox(height: 18),
                        _MarketSentimentCard(
                          snapshot.data!.marketSentiment!,
                        ),
                      ],
                      const SizedBox(height: 18),
                      FutureBuilder<MobileDailyIntelligenceSnapshot>(
                        future: _dailyIntelligence,
                        builder: (context, intelligenceSnapshot) {
                          return DailyIntelligenceCard(
                            snapshot: intelligenceSnapshot.data,
                            isLoading: intelligenceSnapshot.connectionState ==
                                ConnectionState.waiting,
                            errorMessage: intelligenceSnapshot.hasError
                                ? intelligenceSnapshot.error.toString()
                                : null,
                            onViewSecurity: _openSecurityFromIntelligence,
                          );
                        },
                      ),
                      const SizedBox(height: 18),
                      _HealthCard(
                        snapshot.data!.health,
                        onTap: _openHealthScore,
                      ),
                      const SizedBox(height: 18),
                      _SectionTitle(
                          title: "重点账户",
                          actionLabel: "${snapshot.data!.accounts.length} 个账户"),
                      const SizedBox(height: 10),
                      ...snapshot.data!.accounts.take(3).map(
                            (account) => _AccountTile(
                              account,
                              onTap: () => _openAccountDetail(account),
                            ),
                          ),
                      const SizedBox(height: 18),
                      _SectionTitle(
                          title: "头部持仓",
                          actionLabel:
                              "${snapshot.data!.topHoldings.length} 个标的"),
                      const SizedBox(height: 10),
                      ...snapshot.data!.topHoldings.take(5).map(
                            (holding) => _HoldingTile(
                              holding,
                              onTap: () => _openHoldingDetail(holding),
                            ),
                          ),
                      const SizedBox(height: 18),
                      _RecommendationCard(snapshot.data!.recommendationTheme,
                          snapshot.data!.recommendationReason),
                    ],
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  void _openAccountDetail(MobileAccountCard account) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AccountDetailPage(
          apiClient: widget.apiClient,
          accountId: account.id,
          fallbackTitle: account.name,
        ),
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

  void _openSecurityFromIntelligence(MobileDailyIntelligenceItem item) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SecurityDetailPage(
          apiClient: widget.apiClient,
          symbol: item.identity.symbol,
          fallbackTitle: item.identity.symbol,
          securityId: item.identity.securityId.isEmpty
              ? null
              : item.identity.securityId,
          exchange:
              item.identity.exchange.isEmpty ? null : item.identity.exchange,
          currency:
              item.identity.currency.isEmpty ? null : item.identity.currency,
        ),
      ),
    );
  }

  void _openHealthScore() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => HealthScorePage(apiClient: widget.apiClient),
      ),
    );
  }
}

class _PageHeader extends StatelessWidget {
  const _PageHeader({required this.title, required this.subtitle});

  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(20, 22, 20, 18),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 8),
          Text(subtitle, style: Theme.of(context).textTheme.bodyLarge),
        ],
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid({required this.metrics});

  final List<MobileMetric> metrics;

  @override
  Widget build(BuildContext context) {
    final shownMetrics = metrics.take(4).toList();
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: shownMetrics.length,
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 2,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
        childAspectRatio: 1.35,
      ),
      itemBuilder: (context, index) {
        final metric = shownMetrics[index];
        return _LooCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(metric.label, style: Theme.of(context).textTheme.bodyMedium),
              const Spacer(),
              Text(metric.value, style: Theme.of(context).textTheme.titleLarge),
              const SizedBox(height: 4),
              Text(metric.detail, maxLines: 2, overflow: TextOverflow.ellipsis),
            ],
          ),
        );
      },
    );
  }
}

class _FxContextCard extends StatelessWidget {
  const _FxContextCard(this.context);

  final MobileFxContext context;

  @override
  Widget build(BuildContext context) {
    return _LooCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              const Icon(Icons.currency_exchange),
              const SizedBox(width: 8),
              Expanded(
                child: Text("FX 折算口径",
                    style: Theme.of(context).textTheme.titleLarge),
              ),
              Chip(label: Text(this.context.statusLabel)),
            ],
          ),
          const SizedBox(height: 8),
          Text(this.context.label),
          if (this.context.note.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(this.context.note,
                style: Theme.of(context).textTheme.bodySmall),
          ],
        ],
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.actionLabel});

  final String title;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        Text(actionLabel, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class _HealthCard extends StatelessWidget {
  const _HealthCard(this.health, {required this.onTap});

  final MobileHomeHealth health;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _LooCard(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(18),
        child: Padding(
          padding: const EdgeInsets.all(2),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Expanded(
                    child: Text("Loo国健康巡查",
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
              const SizedBox(height: 8),
              Text(health.score,
                  style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 6),
              Text(health.status),
              ...health.highlights.take(2).map(
                    (item) => Padding(
                      padding: const EdgeInsets.only(top: 6),
                      child: Text("• $item"),
                    ),
                  ),
            ],
          ),
        ),
      ),
    );
  }
}

class _AccountTile extends StatelessWidget {
  const _AccountTile(this.account, {required this.onTap});

  final MobileAccountCard account;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return _LooCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: EdgeInsets.zero,
        onTap: onTap,
        title: Text(account.name),
        subtitle: Text(account.detail),
        trailing: Wrap(
          crossAxisAlignment: WrapCrossAlignment.center,
          spacing: 8,
          children: [
            Text(account.value, style: Theme.of(context).textTheme.titleLarge),
            const Icon(Icons.chevron_right),
          ],
        ),
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
    return _LooCard(
      margin: const EdgeInsets.only(bottom: 10),
      child: ListTile(
        contentPadding: EdgeInsets.zero,
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

class _OverviewTrendCard extends StatelessWidget {
  const _OverviewTrendCard({
    required this.chart,
    required this.fallbackPoints,
  });

  final MobileChartSeries? chart;
  final List<MobileHomeTrendPoint> fallbackPoints;

  @override
  Widget build(BuildContext context) {
    final points = chart?.points
            .map((point) => (
                  label: point.label,
                  displayValue: point.displayValue,
                  chartValue: point.value,
                ))
            .toList() ??
        fallbackPoints
            .map((point) => (
                  label: point.label,
                  displayValue: point.displayValue,
                  chartValue: point.chartValue,
                ))
            .toList();
    if (points.length < 2) {
      return const SizedBox.shrink();
    }

    final first = points.first;
    final last = points.last;
    final freshness = chart?.freshness;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(chart?.title ?? "投资资产走势",
                style: Theme.of(context).textTheme.titleLarge),
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
            Text(
              "${first.label} ${first.displayValue} → ${last.label} ${last.displayValue}",
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

class _MarketSentimentCard extends StatelessWidget {
  const _MarketSentimentCard(this.sentiment);

  final MobileMarketSentiment sentiment;

  @override
  Widget build(BuildContext context) {
    return _LooCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  "今日市场脉搏",
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              Chip(label: Text("象限 ${sentiment.quadrant.isEmpty ? "-" : sentiment.quadrant}")),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _PulseMetricTile(
                label: "VIX",
                value: sentiment.vixDisplay,
                detail: sentiment.vixLevelLabel,
              ),
              _PulseMetricTile(
                label: "FGI",
                value: "${sentiment.fgiScore}",
                detail: sentiment.fgiLevelLabel,
              ),
              _PulseMetricTile(
                label: "策略",
                value: sentiment.strategyLabel,
                detail: sentiment.buySignalLabel,
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            sentiment.quadrantLabel,
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 6),
          Text(sentiment.strategyDetail),
          if (sentiment.summary.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              sentiment.summary,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text(sentiment.sourceLabel)),
              if (sentiment.freshnessLabel.isNotEmpty)
                Chip(label: Text(sentiment.freshnessLabel)),
            ],
          ),
          if (sentiment.components.isNotEmpty) ...[
            const SizedBox(height: 12),
            ...sentiment.components.take(4).map(
                  (component) => Padding(
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Row(
                      children: [
                        Expanded(child: Text(component.label)),
                        Text("${component.score}/100"),
                      ],
                    ),
                  ),
                ),
          ],
        ],
      ),
    );
  }
}

class _PulseMetricTile extends StatelessWidget {
  const _PulseMetricTile({
    required this.label,
    required this.value,
    required this.detail,
  });

  final String label;
  final String value;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 120,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(16),
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: Theme.of(context).textTheme.labelMedium),
          const SizedBox(height: 6),
          Text(value, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 4),
          Text(detail, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _RecommendationCard extends StatelessWidget {
  const _RecommendationCard(this.theme, this.reason);

  final String theme;
  final String reason;

  @override
  Widget build(BuildContext context) {
    return _LooCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text("Loo皇谕令", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(theme),
          const SizedBox(height: 8),
          Text(reason),
        ],
      ),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Text("Loo国财政部暂时连不上", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text("重新召集")),
        ],
      ),
    );
  }
}

class _LooCard extends StatelessWidget {
  const _LooCard({required this.child, this.margin});

  final Widget child;
  final EdgeInsetsGeometry? margin;

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: margin,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: child,
      ),
    );
  }
}

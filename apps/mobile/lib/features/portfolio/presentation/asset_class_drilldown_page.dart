import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../app/mobile_routes.dart";
import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../data/mobile_portfolio_models.dart";
import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";

class AssetClassDrilldownPage extends StatelessWidget {
  const AssetClassDrilldownPage({
    required this.apiClient,
    required this.item,
    super.key,
  });

  final LooApiClient apiClient;
  final MobileAssetClassDrilldown item;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(item.name)),
      body: LooPageGradient(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
          children: [
            _SummaryCard(item),
            if (item.valueHistoryChart != null) ...[
              const SizedBox(height: 16),
              _AssetClassTrendCard(item.valueHistoryChart!),
            ],
            const SizedBox(height: 16),
            const _SectionTitle("目标偏离"),
            const SizedBox(height: 8),
            _DriftCard(item),
            if (item.actions.isNotEmpty) ...[
              const SizedBox(height: 16),
              const _SectionTitle("修正行动"),
              const SizedBox(height: 8),
              _ActionCard(item.actions),
            ],
            const SizedBox(height: 16),
            _SectionTitle("该类别持仓", actionLabel: "${item.holdings.length} 个"),
            const SizedBox(height: 8),
            if (item.holdings.isEmpty)
              const _EmptyCard("这个资产类别下暂时没有持仓。")
            else
              ...item.holdings.map(
                (holding) => LooTappableRow(
                  margin: const EdgeInsets.only(bottom: 10),
                  onTap: () => _openHoldingDetail(context, holding),
                  title: "${holding.symbol} · ${holding.name}",
                  subtitle: holding.detail,
                  value: holding.value,
                  valueDetail: holding.gainLoss,
                ),
              ),
          ],
        ),
      ),
    );
  }

  void _openHoldingDetail(BuildContext context, MobileHoldingCard holding) {
    context.push(MobileRoutes.holdingDetail(holding.id));
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard(this.item);

  final MobileAssetClassDrilldown item;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      isHero: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(item.name, style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 10),
          Text(item.value, style: Theme.of(context).textTheme.displaySmall),
          const SizedBox(height: 8),
          Text(
            item.summary,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
        ],
      ),
    );
  }
}

class _AssetClassTrendCard extends StatelessWidget {
  const _AssetClassTrendCard(this.chart);

  final MobileChartSeries chart;

  @override
  Widget build(BuildContext context) {
    final points = chart.points;
    if (points.length < 2) {
      return const SizedBox.shrink();
    }

    final first = points.first;
    final last = points.last;

    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(chart.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 12),
          LooLineChart(
            points: points
                .map(
                  (point) => LooLineChartPoint(
                    label: point.label,
                    value: point.value,
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: 12),
          Text(
            "${first.label} ${first.displayValue} → ${last.label} ${last.displayValue}",
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 10),
          _InfoPill(chart.freshness.label),
          const SizedBox(height: 6),
          Text(
            chart.freshness.detail,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
          if (chart.notes.isNotEmpty) ...[
            const SizedBox(height: 8),
            ...chart.notes.take(2).map(
                  (note) => Text(
                    "· $note",
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                ),
          ],
        ],
      ),
    );
  }
}

class _DriftCard extends StatelessWidget {
  const _DriftCard(this.item);

  final MobileAssetClassDrilldown item;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          LooDistributionBar(
            segments: [
              LooDistributionSegment(label: "当前", value: item.currentPct),
              LooDistributionSegment(
                label: "距离目标",
                value: (item.targetPct - item.currentPct).abs(),
              ),
            ],
          ),
          const SizedBox(height: 14),
          _MetricRow(label: "目标", value: item.target),
          _MetricRow(label: "当前", value: item.current),
          _MetricRow(label: "偏离", value: item.driftLabel),
        ],
      ),
    );
  }
}

class _MetricRow extends StatelessWidget {
  const _MetricRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Row(
        children: [
          Expanded(child: Text(label)),
          Text(value, style: Theme.of(context).textTheme.titleMedium),
        ],
      ),
    );
  }
}

class _ActionCard extends StatelessWidget {
  const _ActionCard(this.actions);

  final List<String> actions;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: actions
            .take(4)
            .map(
              (action) => Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text("• $action"),
              ),
            )
            .toList(),
      ),
    );
  }
}

class _SectionTitle extends StatelessWidget {
  const _SectionTitle(this.title, {this.actionLabel});

  final String title;
  final String? actionLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
            child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
        if (actionLabel != null)
          Text(
            actionLabel!,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
      ],
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return LooGlassCard(
      child: Text(message),
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

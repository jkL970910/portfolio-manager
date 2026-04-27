import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "holding_detail_page.dart";
import "portfolio_page.dart";

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
      body: ListView(
        padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
        children: [
          _SummaryCard(item),
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
              (holding) => Card(
                child: ListTile(
                  onTap: () => _openHoldingDetail(context, holding),
                  title: Text("${holding.symbol} · ${holding.name}"),
                  subtitle: Text(holding.detail),
                  trailing: Wrap(
                    crossAxisAlignment: WrapCrossAlignment.center,
                    spacing: 8,
                    children: [
                      Text(holding.value,
                          style: Theme.of(context).textTheme.titleMedium),
                      const Icon(Icons.chevron_right),
                    ],
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  void _openHoldingDetail(BuildContext context, MobileHoldingCard holding) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => HoldingDetailPage(
          apiClient: apiClient,
          holdingId: holding.id,
          fallbackTitle: holding.symbol,
        ),
      ),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard(this.item);

  final MobileAssetClassDrilldown item;

  @override
  Widget build(BuildContext context) {
    return Card(
      clipBehavior: Clip.antiAlias,
      child: DecoratedBox(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [
              Theme.of(context).colorScheme.primaryContainer,
              Theme.of(context).colorScheme.surface,
            ],
          ),
        ),
        child: Padding(
          padding: const EdgeInsets.all(18),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(item.name,
                  style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 10),
              Text(item.value, style: Theme.of(context).textTheme.displaySmall),
              const SizedBox(height: 8),
              Text(item.summary),
            ],
          ),
        ),
      ),
    );
  }
}

class _DriftCard extends StatelessWidget {
  const _DriftCard(this.item);

  final MobileAssetClassDrilldown item;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            LooDistributionBar(
              segments: [
                LooDistributionSegment(label: "当前", value: item.currentPct),
                LooDistributionSegment(
                    label: "距离目标",
                    value: (item.targetPct - item.currentPct).abs()),
              ],
            ),
            const SizedBox(height: 14),
            _MetricRow(label: "目标", value: item.target),
            _MetricRow(label: "当前", value: item.current),
            _MetricRow(label: "偏离", value: item.driftLabel),
          ],
        ),
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
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
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
          Text(actionLabel!, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard(this.message);

  final String message;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Text(message),
      ),
    );
  }
}

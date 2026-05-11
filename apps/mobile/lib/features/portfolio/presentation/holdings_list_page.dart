import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../app/mobile_routes.dart";
import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../../shared/data/mobile_models.dart";
import "../data/mobile_portfolio_models.dart";

class HoldingsListPage extends StatefulWidget {
  const HoldingsListPage({required this.apiClient, super.key});

  final LooApiClient apiClient;

  @override
  State<HoldingsListPage> createState() => _HoldingsListPageState();
}

class _HoldingsListPageState extends State<HoldingsListPage> {
  late Future<MobilePortfolioSnapshot> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  Future<MobilePortfolioSnapshot> _loadSnapshot() async {
    final response = await widget.apiClient.getPortfolioOverview();
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("持仓列表格式不正确。");
    }
    return MobilePortfolioSnapshot.fromJson(data);
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
    });
  }

  void _openSecurityPosition(MobileHoldingCard holding) {
    context.push(
      MobileRoutes.securityDetail(
        symbol: holding.symbol,
        securityId: holding.securityId.isEmpty ? null : holding.securityId,
        exchange: holding.exchange.isEmpty ? null : holding.exchange,
        currency: holding.currency.isEmpty ? null : holding.currency,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<MobilePortfolioSnapshot>(
      future: _snapshot,
      builder: (context, snapshot) {
        return RefreshIndicator(
          onRefresh: () async => _refresh(),
          child: LooPageGradient(
            child: CustomScrollView(
              physics: const AlwaysScrollableScrollPhysics(),
              slivers: [
                SliverToBoxAdapter(
                  child: LooHeroHeader(
                    eyebrow: "Holdings",
                    title: "持仓列表",
                    subtitle: snapshot.hasData
                        ? "共 ${snapshot.data!.securityHoldings.length} 个标的 · 点击查看汇总仓位"
                        : "正在整理持仓账本...",
                  ),
                ),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (snapshot.hasError)
                  SliverFillRemaining(
                    child: LooStatePanel(
                      title: "持仓列表暂时打不开",
                      message: snapshot.error.toString(),
                      actionLabel: "重新加载",
                      onAction: _refresh,
                    ),
                  )
                else if (snapshot.hasData)
                  SliverPadding(
                    padding: looPagePadding(context),
                    sliver: SliverList.list(
                      children: [
                        _HoldingsSummaryCard(snapshot.data!),
                        const SizedBox(height: 14),
                        ...snapshot.data!.securityHoldings.map(
                          (holding) => LooTappableRow(
                            margin: const EdgeInsets.only(bottom: 10),
                            title: "${holding.symbol} · ${holding.name}",
                            subtitle: holding.detail,
                            value: holding.value,
                            valueDetail: holding.gainLoss,
                            onTap: () => _openSecurityPosition(holding),
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        );
      },
    );
  }
}

class _HoldingsSummaryCard extends StatelessWidget {
  const _HoldingsSummaryCard(this.snapshot);

  final MobilePortfolioSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return LooGlassCard(
      child: Row(
        children: [
          Expanded(
            child: _SummaryMetric(
              label: "标的数",
              value: "${snapshot.securityHoldings.length}",
            ),
          ),
          SizedBox(width: tokens.gapMd),
          Expanded(
            child: _SummaryMetric(
              label: "账户数",
              value: "${snapshot.accounts.length}",
            ),
          ),
          SizedBox(width: tokens.gapMd),
          Expanded(
            child: _SummaryMetric(
              label: "健康分",
              value: snapshot.healthScore,
            ),
          ),
        ],
      ),
    );
  }
}

class _SummaryMetric extends StatelessWidget {
  const _SummaryMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.mutedText,
              ),
        ),
        const SizedBox(height: 4),
        Text(value, style: Theme.of(context).textTheme.titleLarge),
      ],
    );
  }
}

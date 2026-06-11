import "package:flutter/material.dart";
import "package:go_router/go_router.dart";

import "../../../app/mobile_routes.dart";
import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../data/mobile_portfolio_models.dart";
import "cash_account_balance_sheet.dart";

class AccountsListPage extends StatefulWidget {
  const AccountsListPage({required this.apiClient, super.key});

  final LooApiClient apiClient;

  @override
  State<AccountsListPage> createState() => _AccountsListPageState();
}

class _AccountsListPageState extends State<AccountsListPage> {
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
      throw const LooApiException("账户列表格式不正确。");
    }
    return MobilePortfolioSnapshot.fromJson(data);
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
    });
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
                    title: "账户列表",
                    subtitle: snapshot.hasData
                        ? "共 ${snapshot.data!.totalAccountCount} 个账户 · 投资账户看详情，现金账户可更新余额"
                        : "正在整理账户账本...",
                  ),
                ),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const SliverFillRemaining(
                    child: Center(child: CircularProgressIndicator()),
                  )
                else if (snapshot.hasError)
                  SliverFillRemaining(
                    child: LooStatePanel(
                      title: "账户列表暂时打不开",
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
                        _AccountsSummaryCard(snapshot.data!),
                        const SizedBox(height: 14),
                        ...snapshot.data!.accounts.map(
                          (account) => LooTappableRow(
                            margin: const EdgeInsets.only(bottom: 10),
                            title: account.name,
                            subtitle: account.detail,
                            value: account.value,
                            valueDetail: account.gainLoss,
                            onTap: () async {
                              final changed = await context.push<bool>(
                                MobileRoutes.accountDetail(account.id),
                              );
                              if (changed == true && context.mounted) {
                                _refresh();
                              }
                            },
                          ),
                        ),
                        ...snapshot.data!.cashAccounts.map(
                          (account) => LooTappableRow(
                            margin: const EdgeInsets.only(bottom: 10),
                            leading: const Icon(Icons.payments_outlined),
                            title: account.name,
                            subtitle: account.detail.isEmpty
                                ? "现金账户 · 点击更新余额"
                                : "${account.detail} · 点击更新余额",
                            value: account.value,
                            valueDetail: "现金",
                            onTap: () async {
                              final changed = await showCashAccountBalanceSheet(
                                context: context,
                                apiClient: widget.apiClient,
                                account: account,
                              );
                              if (changed && context.mounted) {
                                _refresh();
                              }
                            },
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

class _AccountsSummaryCard extends StatelessWidget {
  const _AccountsSummaryCard(this.snapshot);

  final MobilePortfolioSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return LooGlassCard(
      child: Row(
        children: [
          Expanded(
            child: _SummaryMetric(
              label: "账户数",
              value: "${snapshot.totalAccountCount}",
            ),
          ),
          SizedBox(width: tokens.gapMd),
          Expanded(
            child: _SummaryMetric(
              label: "持仓数",
              value: "${snapshot.holdings.length}",
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

import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "account_detail_page.dart";
import "health_score_page.dart";
import "holding_detail_page.dart";
import "../../shared/data/mobile_models.dart";

class PortfolioPage extends StatefulWidget {
  const PortfolioPage({
    required this.apiClient,
    super.key,
  });

  final LooApiClient apiClient;

  @override
  State<PortfolioPage> createState() => _PortfolioPageState();
}

class _PortfolioPageState extends State<PortfolioPage> {
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
      throw const LooApiException("组合数据格式不正确。");
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
          child: CustomScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            slivers: [
              SliverToBoxAdapter(
                child: _PageHeader(
                  title: "组合御览",
                  subtitle: snapshot.hasData
                      ? snapshot.data!.quoteStatus
                      : "正在整理 Loo国资产账本...",
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
                      _HealthCard(
                        snapshot.data!.healthScore,
                        snapshot.data!.summaryPoints,
                        onTap: _openHealthScore,
                      ),
                      const SizedBox(height: 18),
                      _SectionTitle(
                          title: "账户",
                          actionLabel: "${snapshot.data!.accounts.length} 个"),
                      const SizedBox(height: 10),
                      ...snapshot.data!.accounts.map(
                        (account) => _AccountTile(
                          account,
                          onTap: () => _openAccountDetail(account),
                        ),
                      ),
                      const SizedBox(height: 18),
                      _SectionTitle(
                          title: "持仓",
                          actionLabel: "${snapshot.data!.holdings.length} 个"),
                      const SizedBox(height: 10),
                      ...snapshot.data!.holdings.take(12).map(
                            (holding) => _HoldingTile(
                              holding,
                              onTap: () => _openHoldingDetail(holding),
                            ),
                          ),
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

  void _openHealthScore() {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => HealthScorePage(apiClient: widget.apiClient),
      ),
    );
  }
}

class MobilePortfolioSnapshot {
  const MobilePortfolioSnapshot({
    required this.accounts,
    required this.holdings,
    required this.quoteStatus,
    required this.healthScore,
    required this.summaryPoints,
  });

  final List<MobileAccountCard> accounts;
  final List<MobileHoldingCard> holdings;
  final String quoteStatus;
  final String healthScore;
  final List<String> summaryPoints;

  factory MobilePortfolioSnapshot.fromJson(Map<String, dynamic> json) {
    final quoteStatus = json["quoteStatus"];
    final healthScore = json["healthScore"];

    return MobilePortfolioSnapshot(
      accounts: readJsonList(json, "accountCards")
          .map(MobileAccountCard.fromJson)
          .toList(),
      holdings: readJsonList(json, "holdings")
          .map(MobileHoldingCard.fromJson)
          .toList(),
      quoteStatus: quoteStatus is Map<String, dynamic>
          ? quoteStatus["lastRefreshed"] as String? ?? "报价状态待刷新"
          : "报价状态待刷新",
      healthScore: healthScore is Map<String, dynamic>
          ? "${healthScore["score"] ?? "--"} 分"
          : "-- 分",
      summaryPoints:
          (json["summaryPoints"] as List?)?.whereType<String>().toList() ??
              const [],
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

class _HealthCard extends StatelessWidget {
  const _HealthCard(this.score, this.summaryPoints, {required this.onTap});

  final String score;
  final List<String> summaryPoints;
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
                    child: Text("国库健康度",
                        style: Theme.of(context).textTheme.titleLarge),
                  ),
                  const Icon(Icons.chevron_right),
                ],
              ),
              const SizedBox(height: 8),
              Text(score, style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              ...summaryPoints.take(3).map((point) => Padding(
                    padding: const EdgeInsets.only(top: 4),
                    child: Text("• $point"),
                  )),
            ],
          ),
        ),
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
          Text("Loo国资产账本暂时打不开", style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          FilledButton(onPressed: onRetry, child: const Text("重新翻阅")),
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

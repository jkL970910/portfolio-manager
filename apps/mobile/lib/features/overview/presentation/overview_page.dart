import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../portfolio/presentation/account_detail_page.dart";
import "../../portfolio/presentation/security_detail_page.dart";
import "../../shared/data/mobile_models.dart";

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
  late final LooApiClient _apiClient;
  late Future<MobileHomeSnapshot> _snapshot;

  @override
  void initState() {
    super.initState();
    _apiClient = widget.apiClient;
    _snapshot = _loadSnapshot();
  }

  Future<MobileHomeSnapshot> _loadSnapshot() async {
    final response = await _apiClient.getMobileHome();
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("总览数据格式不正确。");
    }

    return MobileHomeSnapshot.fromJson(data);
  }

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
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
                const SliverFillRemaining(child: Center(child: CircularProgressIndicator()))
              else if (snapshot.hasError)
                SliverFillRemaining(
                  child: _ErrorState(message: snapshot.error.toString(), onRetry: _refresh),
                )
              else if (snapshot.hasData)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 28),
                  sliver: SliverList.list(
                    children: [
                      _MetricGrid(metrics: snapshot.data!.metrics),
                      const SizedBox(height: 18),
                      _SectionTitle(title: "重点账户", actionLabel: "${snapshot.data!.accounts.length} 个账户"),
                      const SizedBox(height: 10),
                      ...snapshot.data!.accounts.take(3).map(
                            (account) => _AccountTile(
                              account,
                              onTap: () => _openAccountDetail(account),
                            ),
                          ),
                      const SizedBox(height: 18),
                      _SectionTitle(title: "头部持仓", actionLabel: "${snapshot.data!.topHoldings.length} 个标的"),
                      const SizedBox(height: 10),
                      ...snapshot.data!.topHoldings.take(5).map(
                            (holding) => _HoldingTile(
                              holding,
                              onTap: () => _openSecurityDetail(holding),
                            ),
                          ),
                      const SizedBox(height: 18),
                      _RecommendationCard(snapshot.data!.recommendationTheme, snapshot.data!.recommendationReason),
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
          apiClient: _apiClient,
          accountId: account.id,
          fallbackTitle: account.name,
        ),
      ),
    );
  }

  void _openSecurityDetail(MobileHoldingCard holding) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SecurityDetailPage(
          apiClient: _apiClient,
          symbol: holding.symbol,
          fallbackTitle: holding.symbol,
        ),
      ),
    );
  }
}

class MobileHomeSnapshot {
  const MobileHomeSnapshot({
    required this.viewerName,
    required this.metrics,
    required this.accounts,
    required this.topHoldings,
    required this.recommendationTheme,
    required this.recommendationReason,
  });

  final String viewerName;
  final List<MobileMetric> metrics;
  final List<MobileAccountCard> accounts;
  final List<MobileHoldingCard> topHoldings;
  final String recommendationTheme;
  final String recommendationReason;

  factory MobileHomeSnapshot.fromJson(Map<String, dynamic> json) {
    final viewer = json["viewer"];
    final recommendation = json["recommendation"];

    return MobileHomeSnapshot(
      viewerName: viewer is Map<String, dynamic> ? viewer["displayName"] as String? ?? "Loo国居民" : "Loo国居民",
      metrics: readJsonList(json, "metrics").map(MobileMetric.fromJson).toList(),
      accounts: readJsonList(json, "accounts").map(MobileAccountCard.fromJson).toList(),
      topHoldings: readJsonList(json, "topHoldings").map(MobileHoldingCard.fromJson).toList(),
      recommendationTheme: recommendation is Map<String, dynamic>
          ? recommendation["theme"] as String? ?? "暂无推荐主题"
          : "暂无推荐主题",
      recommendationReason: recommendation is Map<String, dynamic>
          ? recommendation["reason"] as String? ?? "完成数据导入后，Loo国会生成组合建议。"
          : "完成数据导入后，Loo国会生成组合建议。",
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

class _SectionTitle extends StatelessWidget {
  const _SectionTitle({required this.title, required this.actionLabel});

  final String title;
  final String actionLabel;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(child: Text(title, style: Theme.of(context).textTheme.titleLarge)),
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

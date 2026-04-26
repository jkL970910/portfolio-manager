import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../shared/data/mobile_models.dart";

class SecurityDetailPage extends StatefulWidget {
  const SecurityDetailPage({
    required this.apiClient,
    required this.symbol,
    required this.fallbackTitle,
    super.key,
  });

  final LooApiClient apiClient;
  final String symbol;
  final String fallbackTitle;

  @override
  State<SecurityDetailPage> createState() => _SecurityDetailPageState();
}

class _SecurityDetailPageState extends State<SecurityDetailPage> {
  late Future<MobileSecurityDetailSnapshot> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  Future<MobileSecurityDetailSnapshot> _loadSnapshot() async {
    final response = await widget.apiClient.getPortfolioSecurityDetail(widget.symbol);
    final data = response["data"];
    if (data == null) {
      throw const LooApiException("没有找到这个标的。");
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
      body: FutureBuilder<MobileSecurityDetailSnapshot>(
        future: _snapshot,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return _ErrorState(message: snapshot.error.toString(), onRetry: _refresh);
          }

          final data = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                _SummaryCard(
                  title: "${data.symbol} · ${data.name}",
                  value: data.lastPrice,
                  subtitle: data.subtitle,
                ),
                const SizedBox(height: 16),
                if (data.summaryPoints.isNotEmpty) ...[
                  const _SectionTitle("Loo皇摘要"),
                  const SizedBox(height: 8),
                  _TextCard(data.summaryPoints.take(4).join("\n")),
                  const SizedBox(height: 16),
                ],
                const _SectionTitle("标的事实"),
                const SizedBox(height: 8),
                ...data.facts.map(_FactTile.new),
                const SizedBox(height: 16),
                const _SectionTitle("相关持仓"),
                const SizedBox(height: 8),
                ...data.relatedHoldings.map(_HoldingTile.new),
              ],
            ),
          );
        },
      ),
    );
  }
}

class MobileSecurityDetailSnapshot {
  const MobileSecurityDetailSnapshot({
    required this.symbol,
    required this.name,
    required this.lastPrice,
    required this.subtitle,
    required this.summaryPoints,
    required this.facts,
    required this.relatedHoldings,
  });

  final String symbol;
  final String name;
  final String lastPrice;
  final String subtitle;
  final List<String> summaryPoints;
  final List<MobileFact> facts;
  final List<MobileHoldingCard> relatedHoldings;

  factory MobileSecurityDetailSnapshot.fromJson(Map<String, dynamic> json) {
    final security = json["security"];
    final securityData = security is Map<String, dynamic> ? security : const <String, dynamic>{};

    return MobileSecurityDetailSnapshot(
      symbol: securityData["symbol"] as String? ?? "--",
      name: securityData["name"] as String? ?? "未知标的",
      lastPrice: securityData["lastPrice"] as String? ?? "--",
      subtitle: [
        securityData["assetClass"] as String? ?? "",
        securityData["sector"] as String? ?? "",
        securityData["exchange"] as String? ?? "",
      ].where((item) => item.isNotEmpty).join(" · "),
      summaryPoints: (json["summaryPoints"] as List?)?.whereType<String>().toList() ?? const [],
      facts: readJsonList(json, "facts").map(MobileFact.fromJson).toList(),
      relatedHoldings: readJsonList(json, "relatedHoldings").map(MobileHoldingCard.fromJson).toList(),
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard({
    required this.title,
    required this.value,
    required this.subtitle,
  });

  final String title;
  final String value;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(18),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.headlineMedium),
            const SizedBox(height: 8),
            Text(value, style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(subtitle),
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

class _FactTile extends StatelessWidget {
  const _FactTile(this.fact);

  final MobileFact fact;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(fact.label),
        subtitle: Text(fact.detail),
        trailing: Text(fact.value, style: Theme.of(context).textTheme.titleLarge),
      ),
    );
  }
}

class _HoldingTile extends StatelessWidget {
  const _HoldingTile(this.holding);

  final MobileHoldingCard holding;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text("${holding.symbol} · ${holding.name}"),
        subtitle: Text(holding.detail),
        trailing: Text(holding.value, style: Theme.of(context).textTheme.titleLarge),
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
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text("标的详情暂时打不开", style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(message, textAlign: TextAlign.center),
            const SizedBox(height: 16),
            FilledButton(onPressed: onRetry, child: const Text("重新查看")),
          ],
        ),
      ),
    );
  }
}

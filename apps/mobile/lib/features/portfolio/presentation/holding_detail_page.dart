import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../shared/data/mobile_models.dart";
import "account_detail_page.dart";
import "detail_state_widgets.dart";
import "security_detail_page.dart";

class HoldingDetailPage extends StatefulWidget {
  const HoldingDetailPage({
    required this.apiClient,
    required this.holdingId,
    required this.fallbackTitle,
    super.key,
  });

  final LooApiClient apiClient;
  final String holdingId;
  final String fallbackTitle;

  @override
  State<HoldingDetailPage> createState() => _HoldingDetailPageState();
}

class _HoldingDetailPageState extends State<HoldingDetailPage> {
  late Future<MobileHoldingDetailSnapshot?> _snapshot;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
  }

  Future<MobileHoldingDetailSnapshot?> _loadSnapshot() async {
    final response =
        await widget.apiClient.getPortfolioHoldingDetail(widget.holdingId);
    final data = response["data"];
    if (data == null) {
      return null;
    }
    if (data is! Map<String, dynamic>) {
      throw const LooApiException("持仓详情格式不正确。");
    }

    return MobileHoldingDetailSnapshot.fromJson(data);
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
            tooltip: "编辑持仓",
            onPressed: _openEditHoldingSheet,
            icon: const Icon(Icons.edit_outlined),
          ),
          IconButton(
            tooltip: "删除持仓",
            onPressed: _confirmDeleteHolding,
            icon: const Icon(Icons.delete_outline),
          ),
        ],
      ),
      body: FutureBuilder<MobileHoldingDetailSnapshot?>(
        future: _snapshot,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const Center(child: CircularProgressIndicator());
          }

          if (snapshot.hasError) {
            return DetailErrorState(
              title: "持仓详情暂时打不开",
              message: snapshot.error.toString(),
              onRetry: _refresh,
            );
          }

          if (!snapshot.hasData) {
            return DetailNotFoundState(
              title: "没有找到这个持仓",
              message: "这个持仓可能已被删除、移动到账户外，或当前报价同步尚未完成。",
              onRetry: _refresh,
            );
          }

          final data = snapshot.data!;
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                _SummaryCard(data),
                const SizedBox(height: 12),
                _MetricGrid(data),
                const SizedBox(height: 12),
                Row(
                  children: [
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _openAccountDetail(data),
                        icon: const Icon(Icons.account_balance_wallet_outlined),
                        label: const Text("查看账户"),
                      ),
                    ),
                    const SizedBox(width: 10),
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: () => _openSecurityDetail(data),
                        icon: const Icon(Icons.show_chart),
                        label: const Text("查看标的"),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 16),
                const _SectionTitle("持仓档案"),
                const SizedBox(height: 8),
                ...data.facts.map(_FactTile.new),
                const SizedBox(height: 16),
                const _SectionTitle("行情状态"),
                const SizedBox(height: 8),
                _MarketDataCard(data.marketData),
                if (data.portfolioRole.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const _SectionTitle("组合角色"),
                  const SizedBox(height: 8),
                  _TextCard(data.portfolioRole.take(4).join("\n")),
                ],
                const SizedBox(height: 16),
                const _SectionTitle("Loo国健康度"),
                const SizedBox(height: 8),
                _HealthCard(data.healthSummary),
                if (data.performance.isNotEmpty) ...[
                  const SizedBox(height: 16),
                  const _SectionTitle("表现记录"),
                  const SizedBox(height: 8),
                  ...data.performance.take(6).map(_PerformanceTile.new),
                ],
              ],
            ),
          );
        },
      ),
    );
  }

  void _openAccountDetail(MobileHoldingDetailSnapshot data) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => AccountDetailPage(
          apiClient: widget.apiClient,
          accountId: data.accountId,
          fallbackTitle: data.accountName,
        ),
      ),
    );
  }

  void _openSecurityDetail(MobileHoldingDetailSnapshot data) {
    Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (_) => SecurityDetailPage(
          apiClient: widget.apiClient,
          symbol: data.symbol,
          exchange: data.identityExchange,
          currency: data.currency,
          fallbackTitle: data.symbol,
        ),
      ),
    );
  }

  Future<void> _openEditHoldingSheet() async {
    final current = await _snapshot;
    if (!mounted || current == null) {
      return;
    }

    final updated = await showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      builder: (context) => _EditHoldingSheet(
        apiClient: widget.apiClient,
        holdingId: widget.holdingId,
        holding: current,
      ),
    );
    if (updated == true && mounted) {
      _refresh();
    }
  }

  Future<void> _confirmDeleteHolding() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("删除持仓？"),
        content: const Text("删除后会从组合中移除这个持仓，并记录对应组合事件。这个操作不能撤销。"),
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
      await widget.apiClient.deletePortfolioHolding(widget.holdingId);
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

class MobileHoldingDetailSnapshot {
  const MobileHoldingDetailSnapshot({
    required this.id,
    required this.symbol,
    required this.name,
    required this.accountId,
    required this.accountName,
    required this.currency,
    required this.identityExchange,
    required this.accountType,
    required this.assetClass,
    required this.sector,
    required this.exchange,
    required this.securityType,
    required this.value,
    required this.lastPrice,
    required this.lastUpdated,
    required this.freshnessVariant,
    required this.portfolioShare,
    required this.accountShare,
    required this.gainLoss,
    required this.subtitle,
    required this.quantityLine,
    required this.quoteLine,
    required this.fxLine,
    required this.facts,
    required this.marketData,
    required this.performance,
    required this.portfolioRole,
    required this.healthSummary,
  });

  final String id;
  final String symbol;
  final String name;
  final String accountId;
  final String accountName;
  final String currency;
  final String identityExchange;
  final String accountType;
  final String assetClass;
  final String sector;
  final String exchange;
  final String securityType;
  final String value;
  final String lastPrice;
  final String lastUpdated;
  final String freshnessVariant;
  final String portfolioShare;
  final String accountShare;
  final String gainLoss;
  final String subtitle;
  final String quantityLine;
  final String quoteLine;
  final String fxLine;
  final List<MobileFact> facts;
  final MobileMarketData marketData;
  final List<MobilePerformancePoint> performance;
  final List<String> portfolioRole;
  final MobileHealthSummary healthSummary;

  factory MobileHoldingDetailSnapshot.fromJson(Map<String, dynamic> json) {
    final holding = json["holding"];
    final holdingData =
        holding is Map<String, dynamic> ? holding : const <String, dynamic>{};
    final identity = holdingData["identity"];
    final identityData =
        identity is Map<String, dynamic> ? identity : const <String, dynamic>{};
    final displayContext = json["displayContext"];
    final displayContextData = displayContext is Map<String, dynamic>
        ? displayContext
        : const <String, dynamic>{};

    return MobileHoldingDetailSnapshot(
      id: holdingData["id"] as String? ?? "",
      symbol: holdingData["symbol"] as String? ?? "--",
      name: holdingData["name"] as String? ?? "未知标的",
      accountId: holdingData["accountId"] as String? ?? "",
      accountName: holdingData["accountName"] as String? ?? "未知账户",
      currency: holdingData["currency"] as String? ?? "CAD",
      identityExchange: identityData["exchange"] as String? ?? "",
      accountType: holdingData["accountType"] as String? ?? "",
      assetClass: holdingData["assetClass"] as String? ?? "",
      sector: holdingData["sector"] as String? ?? "",
      exchange: holdingData["exchange"] as String? ?? "",
      securityType: holdingData["securityType"] as String? ?? "Common Stock",
      value: holdingData["value"] as String? ?? "--",
      lastPrice: holdingData["lastPrice"] as String? ?? "--",
      lastUpdated: holdingData["lastUpdated"] as String? ?? "",
      freshnessVariant: holdingData["freshnessVariant"] as String? ?? "neutral",
      portfolioShare: holdingData["portfolioShare"] as String? ?? "",
      accountShare: holdingData["accountShare"] as String? ?? "",
      gainLoss: holdingData["gainLoss"] as String? ?? "",
      subtitle: [
        holdingData["accountName"] as String? ?? "",
        holdingData["portfolioShare"] as String? ?? "",
        holdingData["gainLoss"] as String? ?? "",
      ].where((item) => item.isNotEmpty).join(" · "),
      quantityLine: [
        holdingData["quantity"] as String? ?? "",
        holdingData["avgCost"] as String? ?? "",
        holdingData["costBasis"] as String? ?? "",
      ].where((item) => item.isNotEmpty).join(" · "),
      quoteLine: [
        holdingData["lastPrice"] as String? ?? "",
        holdingData["lastUpdated"] as String? ?? "",
      ].where((item) => item.isNotEmpty).join(" · "),
      fxLine: [
        displayContextData["fxRateLabel"] as String? ?? "",
        displayContextData["fxNote"] as String? ?? "",
      ].where((item) => item.isNotEmpty).join(" · "),
      facts: readJsonList(json, "facts").map(MobileFact.fromJson).toList(),
      marketData: MobileMarketData.fromJson(json["marketData"]),
      performance: readJsonList(json, "performance")
          .map(MobilePerformancePoint.fromJson)
          .toList(),
      portfolioRole:
          (json["portfolioRole"] as List?)?.whereType<String>().toList() ??
              const [],
      healthSummary: MobileHealthSummary.fromJson(json["healthSummary"]),
    );
  }
}

class MobileMarketData {
  const MobileMarketData({
    required this.summary,
    required this.notes,
    required this.facts,
  });

  final String summary;
  final List<String> notes;
  final List<MobileFact> facts;

  factory MobileMarketData.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};

    return MobileMarketData(
      summary: json["summary"] as String? ?? "行情状态待刷新。",
      notes: (json["notes"] as List?)?.whereType<String>().toList() ?? const [],
      facts: readJsonList(json, "facts").map(MobileFact.fromJson).toList(),
    );
  }
}

class MobilePerformancePoint {
  const MobilePerformancePoint({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  factory MobilePerformancePoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];

    return MobilePerformancePoint(
      label: json["label"] as String? ?? "未知表现",
      value: rawValue is num
          ? rawValue.toStringAsFixed(2)
          : rawValue?.toString() ?? "--",
    );
  }
}

class MobileHealthSummary {
  const MobileHealthSummary({
    required this.score,
    required this.status,
    required this.summary,
    required this.drivers,
    required this.actions,
  });

  final String score;
  final String status;
  final String summary;
  final List<String> drivers;
  final List<String> actions;

  factory MobileHealthSummary.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};

    return MobileHealthSummary(
      score: "${json["score"] ?? "--"} 分",
      status: json["status"] as String? ?? "待评估",
      summary: json["summary"] as String? ?? "暂无健康度摘要。",
      drivers:
          (json["drivers"] as List?)?.whereType<String>().toList() ?? const [],
      actions:
          (json["actions"] as List?)?.whereType<String>().toList() ?? const [],
    );
  }
}

class _SummaryCard extends StatelessWidget {
  const _SummaryCard(this.data);

  final MobileHoldingDetailSnapshot data;

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
              Text(data.value, style: theme.textTheme.displaySmall),
              const SizedBox(height: 8),
              Text(data.subtitle),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  if (data.assetClass.isNotEmpty) _InfoPill(data.assetClass),
                  if (data.sector.isNotEmpty) _InfoPill(data.sector),
                  if (data.exchange.isNotEmpty) _InfoPill(data.exchange),
                ],
              ),
              if (data.quantityLine.isNotEmpty) ...[
                const SizedBox(height: 12),
                Text(data.quantityLine),
              ],
              if (data.quoteLine.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(data.quoteLine),
              ],
              if (data.fxLine.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(data.fxLine, style: theme.textTheme.bodySmall),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _MetricGrid extends StatelessWidget {
  const _MetricGrid(this.data);

  final MobileHoldingDetailSnapshot data;

  @override
  Widget build(BuildContext context) {
    final metrics = [
      _MetricDatum("最新价格", data.lastPrice),
      _MetricDatum("持仓盈亏", data.gainLoss),
      _MetricDatum("组合占比", data.portfolioShare),
      _MetricDatum("账户占比", data.accountShare),
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

class _InfoPill extends StatelessWidget {
  const _InfoPill(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.72),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: Theme.of(context).colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(label, style: Theme.of(context).textTheme.labelMedium),
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

class _MarketDataCard extends StatelessWidget {
  const _MarketDataCard(this.marketData);

  final MobileMarketData marketData;

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

class _HealthCard extends StatelessWidget {
  const _HealthCard(this.health);

  final MobileHealthSummary health;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text("${health.score} · ${health.status}",
                style: Theme.of(context).textTheme.titleLarge),
            const SizedBox(height: 8),
            Text(health.summary),
            ...health.drivers.take(3).map(
                  (driver) => Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text("• $driver"),
                  ),
                ),
            ...health.actions.take(3).map(
                  (action) => Padding(
                    padding: const EdgeInsets.only(top: 6),
                    child: Text("行动：$action"),
                  ),
                ),
          ],
        ),
      ),
    );
  }
}

class _PerformanceTile extends StatelessWidget {
  const _PerformanceTile(this.point);

  final MobilePerformancePoint point;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(point.label),
        trailing:
            Text(point.value, style: Theme.of(context).textTheme.titleLarge),
      ),
    );
  }
}

class _EditHoldingSheet extends StatefulWidget {
  const _EditHoldingSheet({
    required this.apiClient,
    required this.holdingId,
    required this.holding,
  });

  final LooApiClient apiClient;
  final String holdingId;
  final MobileHoldingDetailSnapshot holding;

  @override
  State<_EditHoldingSheet> createState() => _EditHoldingSheetState();
}

class _EditHoldingSheetState extends State<_EditHoldingSheet> {
  final _formKey = GlobalKey<FormState>();
  late final _nameController = TextEditingController(text: widget.holding.name);
  late final _sectorController =
      TextEditingController(text: widget.holding.sector);
  final _quantityController = TextEditingController(text: "0");
  final _avgCostController = TextEditingController(text: "0");
  final _lastPriceController = TextEditingController(text: "0");
  final _marketValueController = TextEditingController(text: "0");

  late var _currency = widget.holding.currency;
  late var _assetClass = _normalizeAssetClass(widget.holding.assetClass);
  late var _securityType = _normalizeSecurityType(widget.holding.securityType);
  late var _exchange = _normalizeExchange(widget.holding.exchange);
  var _submitting = false;
  String? _error;

  @override
  void dispose() {
    _nameController.dispose();
    _sectorController.dispose();
    _quantityController.dispose();
    _avgCostController.dispose();
    _lastPriceController.dispose();
    _marketValueController.dispose();
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
      await widget.apiClient.updatePortfolioHolding(
        holdingId: widget.holdingId,
        name: _nameController.text.trim(),
        currency: _currency,
        quantity: double.tryParse(_quantityController.text.trim()) ?? 0,
        avgCostPerShareAmount:
            double.tryParse(_avgCostController.text.trim()) ?? 0,
        lastPriceAmount: double.tryParse(_lastPriceController.text.trim()) ?? 0,
        marketValueAmount:
            double.tryParse(_marketValueController.text.trim()) ?? 0,
        assetClass: _assetClass,
        sector: _sectorController.text.trim(),
        securityType: _securityType,
        exchange: _exchange,
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
              Text("编辑持仓", style: Theme.of(context).textTheme.headlineMedium),
              const SizedBox(height: 8),
              Text(widget.holding.symbol),
              const SizedBox(height: 16),
              TextFormField(
                controller: _nameController,
                enabled: !_submitting,
                decoration: const InputDecoration(labelText: "名称"),
                validator: (value) =>
                    (value == null || value.trim().isEmpty) ? "请输入名称" : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _currency,
                decoration: const InputDecoration(labelText: "交易币种"),
                items: const [
                  DropdownMenuItem(value: "CAD", child: Text("CAD")),
                  DropdownMenuItem(value: "USD", child: Text("USD")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _currency = value ?? _currency),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _assetClass,
                decoration: const InputDecoration(labelText: "资产类别"),
                items: const [
                  DropdownMenuItem(
                      value: "Canadian Equity", child: Text("Canadian Equity")),
                  DropdownMenuItem(
                      value: "US Equity", child: Text("US Equity")),
                  DropdownMenuItem(
                      value: "International Equity",
                      child: Text("International Equity")),
                  DropdownMenuItem(
                      value: "Fixed Income", child: Text("Fixed Income")),
                  DropdownMenuItem(value: "Cash", child: Text("Cash")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) =>
                        setState(() => _assetClass = value ?? _assetClass),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _sectorController,
                enabled: !_submitting,
                decoration: const InputDecoration(labelText: "行业"),
                validator: (value) =>
                    (value == null || value.trim().isEmpty) ? "请输入行业" : null,
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _securityType,
                decoration: const InputDecoration(labelText: "证券类型"),
                items: const [
                  DropdownMenuItem(
                      value: "Common Stock", child: Text("Common Stock")),
                  DropdownMenuItem(value: "ETF", child: Text("ETF")),
                  DropdownMenuItem(
                      value: "Commodity ETF", child: Text("Commodity ETF")),
                  DropdownMenuItem(
                      value: "Mutual Fund", child: Text("Mutual Fund")),
                  DropdownMenuItem(value: "REIT", child: Text("REIT")),
                  DropdownMenuItem(value: "Unknown", child: Text("Unknown")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) =>
                        setState(() => _securityType = value ?? _securityType),
              ),
              const SizedBox(height: 12),
              DropdownButtonFormField<String>(
                initialValue: _exchange,
                decoration: const InputDecoration(labelText: "交易所"),
                items: const [
                  DropdownMenuItem(value: "TSX", child: Text("TSX")),
                  DropdownMenuItem(value: "TSXV", child: Text("TSXV")),
                  DropdownMenuItem(
                      value: "Cboe Canada", child: Text("Cboe Canada")),
                  DropdownMenuItem(value: "NYSE", child: Text("NYSE")),
                  DropdownMenuItem(value: "NASDAQ", child: Text("NASDAQ")),
                  DropdownMenuItem(
                      value: "NYSE Arca", child: Text("NYSE Arca")),
                  DropdownMenuItem(value: "OTC", child: Text("OTC")),
                  DropdownMenuItem(value: "LSE", child: Text("LSE")),
                  DropdownMenuItem(value: "TSE", child: Text("TSE")),
                  DropdownMenuItem(
                      value: "Other / Manual", child: Text("Other / Manual")),
                ],
                onChanged: _submitting
                    ? null
                    : (value) => setState(() => _exchange = value ?? _exchange),
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _quantityController,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "数量"),
                validator: _validateMoney,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _avgCostController,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "平均成本"),
                validator: _validateMoney,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _lastPriceController,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "最新价格"),
                validator: _validateMoney,
              ),
              const SizedBox(height: 12),
              TextFormField(
                controller: _marketValueController,
                enabled: !_submitting,
                keyboardType:
                    const TextInputType.numberWithOptions(decimal: true),
                decoration: const InputDecoration(labelText: "当前市值"),
                validator: _validatePositiveMoney,
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
                  child: Text(_submitting ? "保存中..." : "保存持仓"),
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

  String? _validatePositiveMoney(String? value) {
    final parsed = double.tryParse((value ?? "").trim());
    if (parsed == null || parsed <= 0) {
      return "请输入大于 0 的数字";
    }
    return null;
  }

  String _normalizeAssetClass(String value) {
    const allowed = {
      "Canadian Equity",
      "US Equity",
      "International Equity",
      "Fixed Income",
      "Cash"
    };
    return allowed.contains(value) ? value : "Canadian Equity";
  }

  String _normalizeSecurityType(String value) {
    const allowed = {
      "Common Stock",
      "ETF",
      "Commodity ETF",
      "Mutual Fund",
      "REIT",
      "Unknown"
    };
    return allowed.contains(value) ? value : "Common Stock";
  }

  String _normalizeExchange(String value) {
    final normalized = value.trim();
    final upper = normalized.toUpperCase();
    if (upper == "TSX" || upper.contains("TORONTO STOCK EXCHANGE")) {
      return "TSX";
    }
    if (upper == "TSXV" || upper.contains("TSX VENTURE")) {
      return "TSXV";
    }
    if (upper.contains("CBOE CANADA") ||
        upper == "NEO" ||
        upper.contains("NEO EXCHANGE")) {
      return "Cboe Canada";
    }
    if (upper == "NYSE" || upper.contains("NEW YORK STOCK EXCHANGE")) {
      return "NYSE";
    }
    if (upper == "NASDAQ" || upper.contains("NASDAQ")) {
      return "NASDAQ";
    }
    if (upper == "NYSE ARCA" || upper.contains("ARCA")) {
      return "NYSE Arca";
    }
    if (upper == "OTC" || upper.contains("OTC")) {
      return "OTC";
    }
    if (upper == "LSE" || upper.contains("LONDON STOCK EXCHANGE")) {
      return "LSE";
    }
    if (upper == "TSE" || upper.contains("TOKYO STOCK EXCHANGE")) {
      return "TSE";
    }

    const allowed = {
      "TSX",
      "TSXV",
      "Cboe Canada",
      "NYSE",
      "NASDAQ",
      "NYSE Arca",
      "OTC",
      "LSE",
      "TSE",
      "Other / Manual",
    };
    return allowed.contains(normalized) ? normalized : "Other / Manual";
  }
}

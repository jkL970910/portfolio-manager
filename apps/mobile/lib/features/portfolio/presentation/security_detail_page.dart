import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../intelligence/data/daily_intelligence_models.dart";
import "../../intelligence/presentation/daily_intelligence_card.dart";
import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/loo_minister_context_models.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "../../shared/presentation/loo_minister_scope.dart";
import "ai_analysis_card.dart";
import "detail_state_widgets.dart";
import "holding_detail_page.dart";

class SecurityDetailPage extends StatefulWidget {
  const SecurityDetailPage({
    required this.apiClient,
    required this.symbol,
    required this.fallbackTitle,
    this.securityId,
    this.exchange,
    this.currency,
    super.key,
  });

  final LooApiClient apiClient;
  final String symbol;
  final String fallbackTitle;
  final String? securityId;
  final String? exchange;
  final String? currency;

  @override
  State<SecurityDetailPage> createState() => _SecurityDetailPageState();
}

class _SecurityDetailPageState extends State<SecurityDetailPage> {
  late Future<MobileSecurityDetailSnapshot?> _snapshot;
  late Future<MobileDailyIntelligenceSnapshot> _dailyIntelligence;
  bool _isRefreshingQuote = false;
  String? _securityId;

  @override
  void initState() {
    super.initState();
    _snapshot = _loadSnapshot();
    _dailyIntelligence = _loadDailyIntelligence();
  }

  Future<MobileSecurityDetailSnapshot?> _loadSnapshot() async {
    final response = await widget.apiClient.getPortfolioSecurityDetail(
      widget.symbol,
      securityId: widget.securityId,
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

    final snapshot = MobileSecurityDetailSnapshot.fromJson(data);
    _securityId = snapshot.securityId.isNotEmpty ? snapshot.securityId : null;
    if (mounted) {
      LooMinisterScope.report(
        context,
        snapshot.toMinisterContext(
          asOf: DateTime.now().toUtc().toIso8601String(),
        ),
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

  Future<void> _refreshQuote() async {
    setState(() {
      _isRefreshingQuote = true;
    });

    try {
      await widget.apiClient.refreshPortfolioSecurityQuote(
        widget.symbol,
        securityId: _securityId ?? widget.securityId,
        exchange: widget.exchange,
        currency: widget.currency,
      );
      _refresh();
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("已刷新这个标的的报价，并重新加载走势。")),
      );
    } on LooApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text(error.message)),
      );
    } finally {
      if (mounted) {
        setState(() {
          _isRefreshingQuote = false;
        });
      }
    }
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
          final priceHistoryChart = data.priceHistoryChart;
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
              children: [
                _SummaryCard(
                  data,
                  isRefreshingQuote: _isRefreshingQuote,
                  onRefreshQuote: _refreshQuote,
                ),
                const SizedBox(height: 12),
                _ResearchCockpitCard(data),
                const SizedBox(height: 12),
                AiAnalysisCard(
                  apiClient: widget.apiClient,
                  title: "Loo国研究工作台",
                  description: "自动生成基础智能快扫：先看结论、护栏和组合适配；外部 GPT 只在你手动点增强时调用。",
                  autoRun: true,
                  onCompleted: _refreshDailyIntelligence,
                  refreshKey: [
                    data.quoteTimestamp,
                    data.priceHistoryChart?.freshness.latestDate,
                  ].where((part) => part != null && part.isNotEmpty).join("|"),
                  payload: {
                    "scope": "security",
                    "mode": "quick",
                    "security": {
                      if (data.securityId.isNotEmpty)
                        "securityId": data.securityId,
                      "symbol": data.symbol,
                      if (data.exchange.isNotEmpty) "exchange": data.exchange,
                      if (data.currency.isNotEmpty) "currency": data.currency,
                      "name": data.name,
                    },
                  },
                ),
                const SizedBox(height: 12),
                FutureBuilder<MobileDailyIntelligenceSnapshot>(
                  future: _dailyIntelligence,
                  builder: (context, intelligenceSnapshot) {
                    return DailyIntelligenceCard(
                      snapshot: intelligenceSnapshot.hasData
                          ? _filterIntelligenceForSecurity(
                              intelligenceSnapshot.data!,
                              data,
                            )
                          : null,
                      isLoading: intelligenceSnapshot.connectionState ==
                          ConnectionState.waiting,
                      errorMessage: intelligenceSnapshot.hasError
                          ? intelligenceSnapshot.error.toString()
                          : null,
                    );
                  },
                ),
                const SizedBox(height: 12),
                _MetricGrid(data),
                if (priceHistoryChart != null) ...[
                  const SizedBox(height: 16),
                  const _SectionTitle("价格走势"),
                  const SizedBox(height: 8),
                  _PerformanceChartCard(
                    chart: priceHistoryChart,
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

  void _refreshDailyIntelligence() {
    if (!mounted) {
      return;
    }
    setState(() {
      _dailyIntelligence = _loadDailyIntelligence();
    });
  }

  MobileDailyIntelligenceSnapshot _filterIntelligenceForSecurity(
    MobileDailyIntelligenceSnapshot snapshot,
    MobileSecurityDetailSnapshot security,
  ) {
    final securityId = security.securityId.trim();
    final symbol = security.symbol.trim().toUpperCase();
    final exchange = security.exchange.trim().toUpperCase();
    final currency = security.currency.trim().toUpperCase();
    final items = snapshot.items.where((item) {
      final identity = item.identity;
      final itemSymbol = identity.symbol.trim().toUpperCase();
      final itemExchange = identity.exchange.trim().toUpperCase();
      final itemCurrency = identity.currency.trim().toUpperCase();
      final conflictsWithVisibleIdentity = (itemExchange.isNotEmpty &&
              exchange.isNotEmpty &&
              itemExchange != exchange) ||
          (itemCurrency.isNotEmpty &&
              currency.isNotEmpty &&
              itemCurrency != currency);
      if (securityId.isNotEmpty && identity.securityId == securityId) {
        return !conflictsWithVisibleIdentity;
      }

      return symbol.isNotEmpty &&
          exchange.isNotEmpty &&
          currency.isNotEmpty &&
          itemSymbol == symbol &&
          itemExchange == exchange &&
          itemCurrency == currency;
    }).toList();

    return MobileDailyIntelligenceSnapshot(
      generatedAt: snapshot.generatedAt,
      disclaimer: snapshot.disclaimer,
      manualTriggerOnly: snapshot.manualTriggerOnly,
      scheduledOverviewEnabled: snapshot.scheduledOverviewEnabled,
      securityManualRefreshEnabled: snapshot.securityManualRefreshEnabled,
      items: items,
      emptyTitle: "暂时没有该标的秘闻",
      emptyDetail:
          "当前只显示同一标的，或完整 symbol/exchange/currency 匹配的缓存情报；不会把其他版本的资料混入当前标的。",
    );
  }
}

class MobileSecurityDetailSnapshot {
  const MobileSecurityDetailSnapshot({
    required this.securityId,
    required this.symbol,
    required this.name,
    required this.assetClass,
    required this.sector,
    required this.currency,
    required this.exchange,
    required this.lastPrice,
    required this.quoteTimestamp,
    required this.freshnessVariant,
    required this.quoteStatusLabel,
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

  final String securityId;
  final String symbol;
  final String name;
  final String assetClass;
  final String sector;
  final String currency;
  final String exchange;
  final String lastPrice;
  final String quoteTimestamp;
  final String freshnessVariant;
  final String quoteStatusLabel;
  final String subtitle;
  final MobileSecurityMarketData marketData;
  final MobileSecurityAnalysis analysis;
  final List<MobileSecurityPerformancePoint> performance;
  final MobileChartSeries? priceHistoryChart;
  final List<String> summaryPoints;
  final List<MobileFact> facts;
  final List<MobileHoldingCard> relatedHoldings;
  final MobileHeldPosition? heldPosition;

  LooMinisterPageContext toMinisterContext({required String asOf}) {
    final chart = priceHistoryChart;
    final listingExchange = exchange.isNotEmpty ? exchange : null;
    final listingCurrency =
        currency == "CAD" || currency == "USD" ? currency : null;
    return LooMinisterPageContext(
      page: "security-detail",
      title: "$symbol标的详情",
      asOf: asOf,
      displayCurrency: currency.isEmpty ? "CAD" : currency,
      subject: LooMinisterSubject(
        security: LooMinisterSecurityIdentity(
          securityId: securityId.isNotEmpty ? securityId : null,
          symbol: symbol,
          exchange: listingExchange != null && listingCurrency != null
              ? listingExchange
              : null,
          currency: listingExchange != null && listingCurrency != null
              ? listingCurrency
              : null,
          name: name,
          securityType: assetClass,
        ),
      ),
      dataFreshness: LooMinisterDataFreshness(
        quotesAsOf: _toIsoDateTimeOrNull(quoteTimestamp),
        chartFreshness: _toMinisterChartFreshness(chart?.freshness.status),
        sourceMode: _toMinisterSourceMode(chart?.sourceMode),
      ),
      facts: [
        LooMinisterFact(
          id: "last-price",
          label: "最新价格",
          value: lastPrice,
          detail: quoteTimestamp,
          source: "quote-cache",
        ),
        if (assetClass.isNotEmpty)
          LooMinisterFact(
            id: "asset-class",
            label: "资产类别",
            value: assetClass,
            source: "analysis-cache",
          ),
        if (sector.isNotEmpty)
          LooMinisterFact(id: "sector", label: "行业", value: sector),
        if (analysis.currentAllocation.isNotEmpty)
          LooMinisterFact(
            id: "current-allocation",
            label: "当前配置",
            value: analysis.currentAllocation,
            detail:
                "目标 ${analysis.targetAllocation} · 偏离 ${analysis.driftLabel}",
            source: "analysis-cache",
          ),
        if (analysis.portfolioShare.isNotEmpty)
          LooMinisterFact(
            id: "portfolio-share",
            label: "组合占比",
            value: analysis.portfolioShare,
            source: "analysis-cache",
          ),
        if (heldPosition != null) ...[
          LooMinisterFact(
            id: "held-value",
            label: "持有市值",
            value: heldPosition!.value,
          ),
          if (heldPosition!.gainLoss.isNotEmpty)
            LooMinisterFact(
              id: "held-gain-loss",
              label: "持有盈亏",
              value: heldPosition!.gainLoss,
            ),
          LooMinisterFact(
            id: "held-account-count",
            label: "持有账户",
            value: heldPosition!.accountCount,
          ),
        ],
        if (chart != null)
          LooMinisterFact(
            id: "price-history-chart",
            label: chart.title,
            value: chart.freshness.label,
            detail: chart.freshness.detail,
            source: "portfolio-data",
          ),
        ...facts.take(5).map(
              (fact) => LooMinisterFact(
                id: "fact-${_slug(fact.label)}",
                label: fact.label,
                value: fact.value,
                detail: fact.detail,
              ),
            ),
      ],
      warnings: [
        marketData.summary,
        ...marketData.notes.take(3),
        analysis.summary,
        ...summaryPoints.take(4),
        ...?heldPosition?.summaryPoints.take(3),
        if (chart != null && chart.notes.isNotEmpty) ...chart.notes.take(3),
      ].where((item) => item.isNotEmpty).toList(),
      allowedActions: const [
        LooMinisterSuggestedAction(
          id: "run-security-analysis",
          label: "运行智能标的快扫",
          actionType: "run-analysis",
          target: {"scope": "security"},
          requiresConfirmation: true,
        ),
      ],
    );
  }

  factory MobileSecurityDetailSnapshot.fromJson(Map<String, dynamic> json) {
    final security = json["security"];
    final securityData =
        security is Map<String, dynamic> ? security : const <String, dynamic>{};

    return MobileSecurityDetailSnapshot(
      securityId: securityData["securityId"] as String? ?? "",
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
      quoteStatusLabel: securityData["quoteStatusLabel"] as String? ??
          switch (securityData["freshnessVariant"] as String? ?? "neutral") {
            "success" => "报价较新",
            "warning" => "报价可能过期",
            _ => "报价待确认",
          },
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

class _SummaryCard extends StatelessWidget {
  const _SummaryCard(
    this.data, {
    required this.isRefreshingQuote,
    required this.onRefreshQuote,
  });

  final MobileSecurityDetailSnapshot data;
  final bool isRefreshingQuote;
  final VoidCallback onRefreshQuote;

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
                      label: data.quoteStatusLabel, color: freshnessColor),
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
              const SizedBox(height: 14),
              FilledButton.icon(
                onPressed: isRefreshingQuote ? null : onRefreshQuote,
                icon: isRefreshingQuote
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.refresh),
                label: Text(isRefreshingQuote ? "刷新中" : "刷新此标的"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ResearchCockpitCard extends StatelessWidget {
  const _ResearchCockpitCard(this.data);

  final MobileSecurityDetailSnapshot data;

  @override
  Widget build(BuildContext context) {
    final decision = _SecurityResearchDecision.fromSnapshot(data);
    final trust = _SecurityDataTrust.fromSnapshot(data);
    final portfolioFit = _portfolioFitSummary(data);
    final riskNotes = _topRiskNotes(data);
    final chips = [
      if (data.assetClass.isNotEmpty) data.assetClass,
      if (data.sector.isNotEmpty) data.sector,
      if (data.exchange.isNotEmpty && data.currency.isNotEmpty)
        "${data.exchange} · ${data.currency}",
      if (data.heldPosition != null) "已持有" else "候选标的",
    ];

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(Icons.dashboard_customize_outlined,
                    color: decision.color(context)),
                const SizedBox(width: 10),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text("Loo国研究台",
                          style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 6),
                      Text(
                        decision.directAnswer,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                _StatusPill(
                  label: decision.label,
                  color: decision.color(context),
                ),
              ],
            ),
            const SizedBox(height: 14),
            _ResearchLine(
              icon: Icons.account_balance_wallet_outlined,
              label: "组合适配",
              value: portfolioFit,
            ),
            const SizedBox(height: 10),
            _ResearchLine(
              icon: Icons.verified_outlined,
              label: "数据可信度",
              value: trust.summary,
              trailing: _StatusPill(
                label: trust.label,
                color: trust.color(context),
              ),
            ),
            if (riskNotes.isNotEmpty) ...[
              const SizedBox(height: 10),
              _ResearchLine(
                icon: Icons.report_gmailerrorred_outlined,
                label: "主要提醒",
                value: riskNotes.take(2).join("；"),
              ),
            ],
            if (chips.isNotEmpty) ...[
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: chips.map((chip) => _InfoChip(chip)).toList(),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _ResearchLine extends StatelessWidget {
  const _ResearchLine({
    required this.icon,
    required this.label,
    required this.value,
    this.trailing,
  });

  final IconData icon;
  final String label;
  final String value;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Icon(icon, size: 18, color: Theme.of(context).colorScheme.primary),
        const SizedBox(width: 8),
        Expanded(
          child: Text.rich(
            TextSpan(
              children: [
                TextSpan(
                  text: "$label：",
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                ),
                TextSpan(text: value),
              ],
            ),
          ),
        ),
        if (trailing != null) ...[
          const SizedBox(width: 8),
          trailing!,
        ],
      ],
    );
  }
}

class _SecurityResearchDecision {
  const _SecurityResearchDecision({
    required this.label,
    required this.directAnswer,
    required this.tone,
  });

  final String label;
  final String directAnswer;
  final String tone;

  static _SecurityResearchDecision fromSnapshot(
      MobileSecurityDetailSnapshot data) {
    final trust = _SecurityDataTrust.fromSnapshot(data);
    if (trust.tone == "danger") {
      return const _SecurityResearchDecision(
        label: "需要补数据",
        directAnswer: "这个标的的关键数据还不完整，先刷新报价或走势，再做买入判断。",
        tone: "danger",
      );
    }

    final current = data.analysis.currentAllocationPct;
    final target = data.analysis.targetAllocationPct;
    final gap = target - current;
    if (data.heldPosition != null) {
      return _SecurityResearchDecision(
        label: gap < -3 ? "继续持有/复核" : "持仓复核",
        directAnswer: gap < -3
            ? "你已经持有相关暴露，且同类资产高于目标，重点是复核是否继续持有。"
            : "这是已持有标的，重点看它是否仍符合账户、税务和目标配置。",
        tone: gap < -3 ? "warning" : "success",
      );
    }

    if (gap > 3) {
      return const _SecurityResearchDecision(
        label: "适合继续研究",
        directAnswer: "这个标的对应的资产类别仍有配置空间，可以进入快扫看是否适合加入观察。",
        tone: "success",
      );
    }
    if (gap < -3) {
      return const _SecurityResearchDecision(
        label: "保持观察",
        directAnswer: "当前同类资产已经高于目标，除非有更强理由，否则不应作为下一笔优先买入。",
        tone: "warning",
      );
    }
    return const _SecurityResearchDecision(
      label: "中性观察",
      directAnswer: "这个标的可以继续研究，但需要结合偏好、账户位置和数据新鲜度再判断。",
      tone: "neutral",
    );
  }

  Color color(BuildContext context) {
    return switch (tone) {
      "success" => Colors.green,
      "warning" => Colors.orange,
      "danger" => Theme.of(context).colorScheme.error,
      _ => Theme.of(context).colorScheme.primary,
    };
  }
}

class _SecurityDataTrust {
  const _SecurityDataTrust({
    required this.label,
    required this.summary,
    required this.tone,
  });

  final String label;
  final String summary;
  final String tone;

  static _SecurityDataTrust fromSnapshot(MobileSecurityDetailSnapshot data) {
    final quoteFresh = data.freshnessVariant == "success";
    final quoteWarning = data.freshnessVariant == "warning";
    final chartStatus = data.priceHistoryChart?.freshness.status;
    final hasChart = data.priceHistoryChart?.points.isNotEmpty == true;
    final chartFresh = chartStatus == "fresh";
    final chartFallback = chartStatus == "fallback";
    final identityComplete = data.symbol.isNotEmpty &&
        data.exchange.isNotEmpty &&
        data.currency.isNotEmpty;

    if (!identityComplete || (!quoteFresh && !hasChart)) {
      return const _SecurityDataTrust(
        label: "需补数据",
        summary: "标的身份、报价或走势不完整，结论只能低置信参考。",
        tone: "danger",
      );
    }
    if (quoteWarning || chartFallback || !chartFresh) {
      return _SecurityDataTrust(
        label: "部分可用",
        summary: [
          data.quoteStatusLabel,
          if (hasChart) data.priceHistoryChart!.freshness.label else "走势待补充",
        ].where((item) => item.isNotEmpty).join("；"),
        tone: "warning",
      );
    }
    return _SecurityDataTrust(
      label: "数据较新",
      summary: [
        data.quoteStatusLabel,
        if (hasChart) data.priceHistoryChart!.freshness.label,
      ].where((item) => item.isNotEmpty).join("；"),
      tone: "success",
    );
  }

  Color color(BuildContext context) {
    return switch (tone) {
      "success" => Colors.green,
      "warning" => Colors.orange,
      "danger" => Theme.of(context).colorScheme.error,
      _ => Theme.of(context).colorScheme.primary,
    };
  }
}

String _portfolioFitSummary(MobileSecurityDetailSnapshot data) {
  final current = data.analysis.currentAllocation;
  final target = data.analysis.targetAllocation;
  final drift = data.analysis.driftLabel;
  final share = data.analysis.portfolioShare;
  if (current == "--" && target == "--" && share == "--") {
    return data.heldPosition == null
        ? "未持有候选标的，需用快扫判断它是否补足目标配置。"
        : "已持有标的，需复核账户位置、风险和目标配置。";
  }
  return [
    if (share != "--") "组合占比 $share",
    if (current != "--" || target != "--") "同类资产 $current / 目标 $target",
    if (drift != "--") "偏离 $drift",
  ].join("；");
}

List<String> _topRiskNotes(MobileSecurityDetailSnapshot data) {
  final notes = <String>[
    if (data.analysis.currentAllocationPct >
        data.analysis.targetAllocationPct + 3)
      "同类资产已高于目标",
    if (data.freshnessVariant != "success") "报价需要确认",
    if (data.priceHistoryChart?.freshness.status == "fallback") "走势含参考数据",
    ...data.marketData.notes.take(2),
  ];
  final deduped = <String>[];
  for (final note in notes.where((item) => item.trim().isNotEmpty)) {
    if (!deduped.contains(note)) deduped.add(note);
  }
  return deduped;
}

class _InfoChip extends StatelessWidget {
  const _InfoChip(this.label);

  final String label;

  @override
  Widget build(BuildContext context) {
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
        child: Text(label, style: Theme.of(context).textTheme.bodySmall),
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
  });

  final MobileChartSeries chart;

  @override
  Widget build(BuildContext context) {
    final freshness = chart.freshness;
    final isReferenceOnly = freshness.status == "fallback";

    if (isReferenceOnly) {
      return Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.info_outline,
                    color: Theme.of(context).colorScheme.primary,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "真实价格历史不足",
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 10),
              Chip(label: Text(freshness.label)),
              const SizedBox(height: 8),
              Text(
                freshness.detail,
                style: Theme.of(context).textTheme.bodySmall,
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
        ),
      );
    }

    final points = chart.points
        .map((point) => (
              label: point.label,
              displayValue: point.displayValue,
              chartValue: point.value,
            ))
        .toList();
    if (points.length < 2) {
      return const _TextCard("真实价格历史不足，暂不绘制价格走势。");
    }
    final first = points.first;
    final last = points.last;
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
              "${first.label} ${first.displayValue} → ${last.label} ${last.displayValue}",
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 10),
            Chip(label: Text(freshness.label)),
            const SizedBox(height: 6),
            Text(
              freshness.detail,
              style: Theme.of(context).textTheme.bodySmall,
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

double _readDouble(Object? value) {
  return value is num ? value.toDouble() : 0.0;
}

String _toMinisterChartFreshness(String? value) {
  return switch (value) {
    "fresh" => "fresh",
    "stale" => "stale",
    "fallback" => "fallback",
    "reference" => "reference",
    _ => "unknown",
  };
}

String _toMinisterSourceMode(String? value) {
  return switch (value) {
    "local" => "local",
    "cached-external" => "cached-external",
    "live-external" => "live-external",
    "reference" => "reference",
    _ => "local",
  };
}

String? _toIsoDateTimeOrNull(String? value) {
  if (value == null || value.isEmpty) return null;
  return DateTime.tryParse(value)?.toUtc().toIso8601String();
}

String _slug(String value) {
  return value
      .trim()
      .toLowerCase()
      .replaceAll(RegExp(r"[^a-z0-9\u4e00-\u9fa5]+"), "-")
      .replaceAll(RegExp(r"^-+|-+$"), "");
}

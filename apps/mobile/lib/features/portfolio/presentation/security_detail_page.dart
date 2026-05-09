import "dart:async";

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
  bool _isSubmittingExternalResearch = false;
  int _externalResearchRefreshRevision = 0;
  String? _externalResearchMessage;
  String? _securityId;
  final AiAnalysisController _analysisController = AiAnalysisController();

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

  void _showResearchUpdateSheet(MobileSecurityDetailSnapshot data) {
    final trust = _SecurityDataTrust.fromSnapshot(data);
    final refreshStatus = _loadResearchRefreshSnapshot(data);
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: FutureBuilder<_ResearchRefreshSnapshot>(
            future: refreshStatus,
            builder: (context, snapshot) {
              final status = snapshot.data;
              final profileStatus = status?.source("profile");
              final institutionalStatus = status?.source("institutional");
              final canSubmitProfile = !_isSubmittingExternalResearch &&
                  (profileStatus?.canSubmit ?? true);
              final canSubmitInstitutional = !_isSubmittingExternalResearch &&
                  (institutionalStatus?.canSubmit ?? true);
              return SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      "研究资料更新",
                      style: Theme.of(sheetContext).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      "报价、基本资料、财报资料分开刷新；研究结论只读取已经落入缓存的资料。",
                      style: Theme.of(sheetContext).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 14),
                    _ResearchRefreshStatusCard(
                      status: status,
                      isLoading:
                          snapshot.connectionState == ConnectionState.waiting,
                      errorMessage:
                          snapshot.hasError ? snapshot.error.toString() : null,
                    ),
                    const SizedBox(height: 10),
                    _ResearchUpdateActionTile(
                      icon: Icons.show_chart,
                      title: "刷新报价与走势",
                      detail: [
                        data.quoteStatusLabel,
                        data.priceHistoryChart?.freshness.label,
                      ]
                          .whereType<String>()
                          .where((item) => item.isNotEmpty)
                          .join("；"),
                      isBusy: _isRefreshingQuote,
                      onTap: _isRefreshingQuote
                          ? null
                          : () {
                              Navigator.of(sheetContext).pop();
                              unawaited(_refreshQuote());
                            },
                    ),
                    _ResearchUpdateActionTile(
                      icon: Icons.badge_outlined,
                      title: "刷新基本资料",
                      detail:
                          profileStatus?.detail ?? "目标价、PE、Beta、市值、52周区间等估值证据。",
                      isBusy: _isSubmittingExternalResearch,
                      onTap: canSubmitProfile
                          ? () {
                              Navigator.of(sheetContext).pop();
                              unawaited(
                                  _enqueueExternalResearch(data, "profile"));
                            }
                          : null,
                    ),
                    _ResearchUpdateActionTile(
                      icon: Icons.event_note_outlined,
                      title: "刷新财报资料",
                      detail: institutionalStatus?.detail ??
                          "财报/盈利披露资料，完成后进入缓存供研究台使用。",
                      isBusy: _isSubmittingExternalResearch,
                      onTap: canSubmitInstitutional
                          ? () {
                              Navigator.of(sheetContext).pop();
                              unawaited(_enqueueExternalResearch(
                                  data, "institutional"));
                            }
                          : null,
                    ),
                    _ResearchUpdateActionTile(
                      icon: Icons.auto_awesome,
                      title: "重新生成研究结论",
                      detail: "不抓新资料，只用当前缓存重新跑智能快扫。",
                      onTap: () {
                        Navigator.of(sheetContext).pop();
                        _analysisController.runFresh();
                      },
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _StatusPill(
                          label: trust.label,
                          color: trust.color(sheetContext),
                        ),
                        _InfoChip(data.quoteStatusLabel),
                        if (data.priceHistoryChart != null)
                          _InfoChip(data.priceHistoryChart!.freshness.label),
                      ],
                    ),
                    if (_externalResearchMessage != null &&
                        _externalResearchMessage!.isNotEmpty) ...[
                      const SizedBox(height: 10),
                      Text(
                        _externalResearchMessage!,
                        style: Theme.of(sheetContext).textTheme.bodySmall,
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }

  Future<_ResearchRefreshSnapshot> _loadResearchRefreshSnapshot(
    MobileSecurityDetailSnapshot data,
  ) async {
    final responses = await Future.wait([
      widget.apiClient.getExternalResearchUsage(),
      widget.apiClient.getExternalResearchJobs(limit: 20),
    ]);
    return _ResearchRefreshSnapshot.fromResponses(
      usageResponse: responses[0],
      jobsResponse: responses[1],
      security: data,
    );
  }

  Future<void> _enqueueExternalResearch(
    MobileSecurityDetailSnapshot data,
    String source,
  ) async {
    setState(() {
      _isSubmittingExternalResearch = true;
      _externalResearchMessage = null;
    });

    try {
      final response = await widget.apiClient.enqueueExternalResearchJob(
        {
          "scope": "security",
          "mode": "quick",
          "cacheStrategy": "prefer-cache",
          "maxCacheAgeSeconds": 21600,
          "drainNow": true,
          "security": {
            if (data.securityId.isNotEmpty) "securityId": data.securityId,
            "symbol": data.symbol,
            if (data.exchange.isNotEmpty) "exchange": data.exchange,
            if (data.currency.isNotEmpty) "currency": data.currency,
            "name": data.name,
          },
        },
        source: source,
      );
      final payload = response["data"];
      final job = payload is Map<String, dynamic>
          ? payload["job"] as Map<String, dynamic>?
          : null;
      final targetKey = job?["targetKey"] as String?;
      _refreshDailyIntelligence();
      if (!mounted) return;
      setState(() {
        _externalResearchMessage = "已提交后台刷新。系统会轮询任务状态，等资料真正写入缓存后再自动更新研究结果。";
      });
      if (targetKey != null && targetKey.isNotEmpty) {
        unawaited(_waitForExternalResearchJobCompletion(
          targetKey,
          source: source,
        ));
      }
    } on LooApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _externalResearchMessage = error.message;
      });
    } finally {
      if (mounted) {
        setState(() {
          _isSubmittingExternalResearch = false;
        });
      }
    }
  }

  Future<void> _waitForExternalResearchJobCompletion(
    String targetKey, {
    required String source,
  }) async {
    String sourceLabel(String value) {
      return switch (value) {
        "profile" => "基本资料",
        "institutional" => "财报资料",
        _ => "资料",
      };
    }

    const attempts = 18;
    for (var index = 0; index < attempts; index += 1) {
      if (!mounted) {
        return;
      }
      await Future.delayed(const Duration(seconds: 2));
      if (!mounted) {
        return;
      }

      try {
        final response =
            await widget.apiClient.getExternalResearchJobs(limit: 8);
        final data = response["data"];
        final items = data is Map<String, dynamic> ? data["items"] : null;
        Map<String, dynamic>? latest;
        if (items is List) {
          for (final item in items) {
            if (item is Map<String, dynamic> &&
                item["targetKey"] == targetKey &&
                _externalResearchJobMatchesSource(
                  item,
                  source,
                  allowMissingSource: true,
                )) {
              latest = item;
              break;
            }
          }
        }
        final status = latest?["status"] as String?;
        final statusLabel = latest?["statusLabel"] as String?;
        final statusNote = latest?["statusNote"] as String?;
        final errorMessage = latest?["errorMessage"] as String?;
        if (status == null) {
          continue;
        }
        if (status == "queued" || status == "running") {
          if (index == attempts - 1 && mounted) {
            setState(() {
              _externalResearchMessage =
                  "资料任务仍在${status == "queued" ? "排队" : "运行"}，完成后研究卡片会自动更新。";
            });
          }
          continue;
        }

        if (mounted) {
          setState(() {
            _externalResearchRefreshRevision += 1;
            _externalResearchMessage = [
              sourceLabel(source),
              statusLabel,
              statusNote,
              errorMessage,
            ]
                .whereType<String>()
                .where((value) => value.isNotEmpty)
                .join(" · ");
          });
        }
        _refreshDailyIntelligence();
        return;
      } catch (_) {
        if (index == attempts - 1 && mounted) {
          setState(() {
            _externalResearchMessage = "已提交后台刷新，但任务状态暂时无法查询。你可以稍后再点一次重新生成。";
          });
        }
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
                ),
                const SizedBox(height: 12),
                _ResearchCockpitCard(
                  data,
                  isRefreshingQuote: _isRefreshingQuote,
                  isSubmittingExternalResearch: _isSubmittingExternalResearch,
                  externalResearchMessage: _externalResearchMessage,
                  onOpenUpdateSheet: () => _showResearchUpdateSheet(data),
                ),
                const SizedBox(height: 12),
                AiAnalysisCard(
                  apiClient: widget.apiClient,
                  controller: _analysisController,
                  title: "Loo国研究工作台",
                  description: "自动生成基础智能快扫：先看结论、护栏和组合适配；外部 GPT 只在你手动点增强时调用。",
                  autoRun: true,
                  showGenerateButton: false,
                  onCompleted: _refreshDailyIntelligence,
                  refreshKey: [
                    data.quoteTimestamp,
                    data.priceHistoryChart?.freshness.latestDate,
                    _externalResearchRefreshRevision.toString(),
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
                    final filteredSnapshot = intelligenceSnapshot.hasData
                        ? _filterIntelligenceForSecurity(
                            intelligenceSnapshot.data!,
                            data,
                          )
                        : null;
                    return Column(
                      children: [
                        DailyIntelligenceCard(
                          snapshot: filteredSnapshot,
                          isLoading: intelligenceSnapshot.connectionState ==
                              ConnectionState.waiting,
                          errorMessage: intelligenceSnapshot.hasError
                              ? intelligenceSnapshot.error.toString()
                              : null,
                        ),
                      ],
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
  const _SummaryCard(this.data);

  final MobileSecurityDetailSnapshot data;

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
            ],
          ),
        ),
      ),
    );
  }
}

class _ResearchCockpitCard extends StatelessWidget {
  const _ResearchCockpitCard(
    this.data, {
    required this.isRefreshingQuote,
    required this.isSubmittingExternalResearch,
    required this.onOpenUpdateSheet,
    this.externalResearchMessage,
  });

  final MobileSecurityDetailSnapshot data;
  final bool isRefreshingQuote;
  final bool isSubmittingExternalResearch;
  final String? externalResearchMessage;
  final VoidCallback onOpenUpdateSheet;

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
            const SizedBox(height: 12),
            _ResearchUpdateStatusBar(
              data: data,
              trust: trust,
              isRefreshingQuote: isRefreshingQuote,
              isSubmittingExternalResearch: isSubmittingExternalResearch,
              message: externalResearchMessage,
              onTap: onOpenUpdateSheet,
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

class _ResearchUpdateStatusBar extends StatelessWidget {
  const _ResearchUpdateStatusBar({
    required this.data,
    required this.trust,
    required this.isRefreshingQuote,
    required this.isSubmittingExternalResearch,
    required this.onTap,
    this.message,
  });

  final MobileSecurityDetailSnapshot data;
  final _SecurityDataTrust trust;
  final bool isRefreshingQuote;
  final bool isSubmittingExternalResearch;
  final String? message;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isBusy = isRefreshingQuote || isSubmittingExternalResearch;
    final theme = Theme.of(context);
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color:
              theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  Icon(
                    Icons.cloud_sync_outlined,
                    size: 18,
                    color: theme.colorScheme.primary,
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Text(
                      "研究资料状态",
                      style: theme.textTheme.titleSmall,
                    ),
                  ),
                  if (isBusy)
                    const SizedBox(
                      height: 16,
                      width: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  else
                    Text(
                      "更新",
                      style: theme.textTheme.labelLarge?.copyWith(
                        color: theme.colorScheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  const SizedBox(width: 4),
                  Icon(
                    Icons.chevron_right,
                    color: theme.colorScheme.primary,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _StatusPill(
                    label: trust.label,
                    color: trust.color(context),
                  ),
                  _InfoChip(data.quoteStatusLabel),
                  if (data.priceHistoryChart != null)
                    _InfoChip(data.priceHistoryChart!.freshness.label),
                ],
              ),
              if (message != null && message!.isNotEmpty) ...[
                const SizedBox(height: 8),
                Text(
                  message!,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.bodySmall,
                ),
              ],
            ],
          ),
        ),
      ),
    );
  }
}

class _ResearchRefreshStatusCard extends StatelessWidget {
  const _ResearchRefreshStatusCard({
    required this.status,
    required this.isLoading,
    this.errorMessage,
  });

  final _ResearchRefreshSnapshot? status;
  final bool isLoading;
  final String? errorMessage;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    if (isLoading) {
      return const _ResearchRefreshStatusShell(
        icon: Icons.hourglass_empty,
        title: "正在读取刷新状态",
        detail: "确认今日额度、缓存窗口和最近任务状态。",
      );
    }
    if (errorMessage != null && errorMessage!.isNotEmpty) {
      return const _ResearchRefreshStatusShell(
        icon: Icons.info_outline,
        title: "刷新状态暂时不可用",
        detail: "仍可尝试手动刷新；如果失败，错误会直接显示在研究台。",
      );
    }
    final snapshot = status;
    if (snapshot == null) {
      return const SizedBox.shrink();
    }
    final color = snapshot.canSubmit
        ? theme.colorScheme.primary
        : theme.colorScheme.error;
    return DecoratedBox(
      decoration: BoxDecoration(
        color:
            theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Icon(Icons.fact_check_outlined, size: 18, color: color),
                const SizedBox(width: 8),
                Expanded(
                  child: Text(
                    snapshot.statusLabel,
                    style: theme.textTheme.titleSmall,
                  ),
                ),
                _StatusPill(label: snapshot.quotaLabel, color: color),
              ],
            ),
            const SizedBox(height: 8),
            Text(snapshot.detail, style: theme.textTheme.bodySmall),
            const SizedBox(height: 8),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _InfoChip(snapshot.ttlLabel),
                if (snapshot.latestLabel.isNotEmpty)
                  _InfoChip(snapshot.latestLabel),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _ResearchRefreshStatusShell extends StatelessWidget {
  const _ResearchRefreshStatusShell({
    required this.icon,
    required this.title,
    required this.detail,
  });

  final IconData icon;
  final String title;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return DecoratedBox(
      decoration: BoxDecoration(
        color:
            theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.45),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: theme.colorScheme.outlineVariant),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Row(
          children: [
            Icon(icon, size: 18, color: theme.colorScheme.primary),
            const SizedBox(width: 8),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, style: theme.textTheme.titleSmall),
                  const SizedBox(height: 4),
                  Text(detail, style: theme.textTheme.bodySmall),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ResearchUpdateActionTile extends StatelessWidget {
  const _ResearchUpdateActionTile({
    required this.icon,
    required this.title,
    required this.detail,
    required this.onTap,
    this.isBusy = false,
  });

  final IconData icon;
  final String title;
  final String detail;
  final bool isBusy;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(title),
      subtitle: detail.isEmpty ? null : Text(detail),
      trailing: isBusy
          ? const SizedBox(
              height: 18,
              width: 18,
              child: CircularProgressIndicator(strokeWidth: 2),
            )
          : const Icon(Icons.chevron_right),
      enabled: onTap != null,
      onTap: onTap,
    );
  }
}

class _ResearchRefreshSnapshot {
  const _ResearchRefreshSnapshot({
    required this.statusLabel,
    required this.detail,
    required this.quotaLabel,
    required this.ttlLabel,
    required this.latestLabel,
    required this.canSubmit,
    required this.sources,
  });

  final String statusLabel;
  final String detail;
  final String quotaLabel;
  final String ttlLabel;
  final String latestLabel;
  final bool canSubmit;
  final Map<String, _ResearchSourceRefreshStatus> sources;

  _ResearchSourceRefreshStatus? source(String sourceId) => sources[sourceId];

  factory _ResearchRefreshSnapshot.fromResponses({
    required Map<String, dynamic> usageResponse,
    required Map<String, dynamic> jobsResponse,
    required MobileSecurityDetailSnapshot security,
  }) {
    final usageData = _readJsonMap(usageResponse["data"]);
    final policy = _readJsonMap(usageData["policy"]);
    final usage = _readJsonMap(usageData["usage"]);
    final jobsData = _readJsonMap(jobsResponse["data"]);
    final summary = _readJsonMap(jobsData["summary"]);
    final items = (jobsData["items"] as List?)
            ?.whereType<Map<String, dynamic>>()
            .toList() ??
        const <Map<String, dynamic>>[];

    final remainingRuns = _readOptionalInt(usage["remainingRuns"]);
    final dailyRunLimit = _readOptionalInt(usage["dailyRunLimit"]) ??
        _readOptionalInt(policy["dailyRunLimit"]);
    final defaultTtlSeconds = _readOptionalInt(policy["defaultTtlSeconds"]);
    final canRunLiveResearch = policy["canRunLiveResearch"] == true;
    final manualRefreshEnabled =
        policy["securityManualRefreshEnabled"] != false;
    final baseCanSubmit = canRunLiveResearch &&
        manualRefreshEnabled &&
        (remainingRuns == null || remainingRuns > 0);
    final ttlLabel = defaultTtlSeconds == null
        ? "缓存窗口待确认"
        : "缓存 ${_formatTtl(defaultTtlSeconds)}";
    final quotaLabel = dailyRunLimit == null
        ? "今日额度待确认"
        : "剩余 ${remainingRuns ?? "--"} / $dailyRunLimit";
    final latestLabel = (summary["latestStatusLabel"] as String?)?.trim() ?? "";

    final detail = !canRunLiveResearch
        ? "外部资料来源尚未完整启用；当前只能使用已缓存资料和本地快扫。"
        : !manualRefreshEnabled
            ? "单标的手动刷新当前关闭；等待后台任务写入缓存。"
            : remainingRuns == 0
                ? "今日外部资料刷新次数已用完；报价刷新不受这个额度影响。"
                : "点击基本资料或财报资料会提交后台任务，完成后再重新生成研究结论。";

    return _ResearchRefreshSnapshot(
      statusLabel: baseCanSubmit ? "可手动刷新外部资料" : "外部资料暂不可刷新",
      detail: detail,
      quotaLabel: quotaLabel,
      ttlLabel: ttlLabel,
      latestLabel: latestLabel,
      canSubmit: baseCanSubmit,
      sources: {
        for (final sourceId in const ["profile", "institutional"])
          sourceId: _ResearchSourceRefreshStatus.fromPolicyAndJobs(
            sourceId: sourceId,
            policy: policy,
            jobs: items,
            security: security,
            baseCanSubmit: baseCanSubmit,
            ttlLabel: ttlLabel,
            blockedDetail: detail,
          ),
      },
    );
  }
}

class _ResearchSourceRefreshStatus {
  const _ResearchSourceRefreshStatus({
    required this.sourceId,
    required this.label,
    required this.detail,
    required this.canSubmit,
  });

  final String sourceId;
  final String label;
  final String detail;
  final bool canSubmit;

  factory _ResearchSourceRefreshStatus.fromPolicyAndJobs({
    required String sourceId,
    required Map<String, dynamic> policy,
    required List<Map<String, dynamic>> jobs,
    required MobileSecurityDetailSnapshot security,
    required bool baseCanSubmit,
    required String ttlLabel,
    required String blockedDetail,
  }) {
    final policySources = (policy["sources"] as List?)
            ?.whereType<Map<String, dynamic>>()
            .toList() ??
        const <Map<String, dynamic>>[];
    final sourcePolicy = policySources.cast<Map<String, dynamic>?>().firstWhere(
          (source) => source?["id"] == sourceId,
          orElse: () => null,
        );
    final label = sourcePolicy?["label"] as String? ??
        _externalResearchSourceLabel(sourceId);
    final sourceEnabled = sourcePolicy?["enabled"] == true;
    final latest = jobs.cast<Map<String, dynamic>?>().firstWhere(
          (job) =>
              job != null &&
              _externalResearchJobMatchesSecurity(job, security) &&
              _externalResearchJobMatchesSource(job, sourceId),
          orElse: () => null,
        );
    final canSubmit = baseCanSubmit && sourceEnabled;
    final detail = !sourceEnabled
        ? "$label 暂未启用；不会显示成可刷新。"
        : !baseCanSubmit
            ? blockedDetail
            : latest == null
                ? "未见最近刷新；点击会消耗 1 次今日额度，完成后进入$ttlLabel。"
                : [
                    latest["statusLabel"] as String?,
                    _readJsonMap(latest["freshness"])["freshnessLabel"]
                        as String?,
                    latest["statusNote"] as String?,
                    latest["errorMessage"] as String?,
                  ]
                    .whereType<String>()
                    .where((value) => value.trim().isNotEmpty)
                    .join(" · ");

    return _ResearchSourceRefreshStatus(
      sourceId: sourceId,
      label: label,
      detail: detail,
      canSubmit: canSubmit,
    );
  }
}

String _externalResearchSourceLabel(String sourceId) {
  return switch (sourceId) {
    "profile" => "基本资料",
    "institutional" => "财报资料",
    _ => "外部资料",
  };
}

Map<String, dynamic> _readJsonMap(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return Map<String, dynamic>.from(value);
  }
  return const <String, dynamic>{};
}

int? _readOptionalInt(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  return int.tryParse(value?.toString() ?? "");
}

String _formatTtl(int seconds) {
  if (seconds < 3600) {
    return "${(seconds / 60).round()} 分钟";
  }
  if (seconds < 86400) {
    return "${(seconds / 3600).round()} 小时";
  }
  return "${(seconds / 86400).round()} 天";
}

bool _externalResearchJobMatchesSecurity(
  Map<String, dynamic> job,
  MobileSecurityDetailSnapshot security,
) {
  final identity = _readJsonMap(job["identity"]);
  final jobSecurityId = (identity["securityId"] as String?)?.trim();
  if (jobSecurityId != null &&
      jobSecurityId.isNotEmpty &&
      security.securityId.isNotEmpty) {
    return jobSecurityId == security.securityId;
  }

  final symbol = (identity["symbol"] as String?)?.trim().toUpperCase();
  if (symbol == null || symbol != security.symbol.trim().toUpperCase()) {
    return false;
  }

  final exchange = (identity["exchange"] as String?)?.trim().toUpperCase();
  final currency = (identity["currency"] as String?)?.trim().toUpperCase();
  final expectedExchange = security.exchange.trim().toUpperCase();
  final expectedCurrency = security.currency.trim().toUpperCase();
  final exchangeConflicts = exchange != null &&
      exchange.isNotEmpty &&
      expectedExchange.isNotEmpty &&
      exchange != expectedExchange;
  final currencyConflicts = currency != null &&
      currency.isNotEmpty &&
      expectedCurrency.isNotEmpty &&
      currency != expectedCurrency;
  return !exchangeConflicts && !currencyConflicts;
}

bool _externalResearchJobMatchesSource(
  Map<String, dynamic> job,
  String sourceId, {
  bool allowMissingSource = false,
}) {
  final sourceIds = (job["sourceIds"] as List?)?.whereType<String>().toList();
  if (sourceIds != null && sourceIds.isNotEmpty) {
    return sourceIds.contains(sourceId);
  }
  final sources = (job["sources"] as List?)?.whereType<Map<String, dynamic>>();
  if (sources != null) {
    final ids = sources
        .map((source) => source["id"] as String?)
        .whereType<String>()
        .toList();
    if (ids.isNotEmpty) {
      return ids.contains(sourceId);
    }
  }
  return allowMissingSource;
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

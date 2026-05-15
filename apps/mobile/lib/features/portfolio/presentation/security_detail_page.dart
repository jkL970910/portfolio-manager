import "dart:async";

import "package:flutter/material.dart";

import "../../../core/api/loo_api_client.dart";
import "../../../core/presentation/loo_components.dart";
import "../../../core/theme/loo_theme.dart";
import "../../shared/data/mobile_chart_models.dart";
import "../../shared/data/loo_minister_context_models.dart";
import "../../shared/data/mobile_models.dart";
import "../../shared/presentation/loo_charts.dart";
import "../../shared/presentation/loo_minister_scope.dart";
import "ai_analysis_card.dart";
import "detail_state_widgets.dart";

class SecurityDetailPage extends StatefulWidget {
  const SecurityDetailPage({
    required this.apiClient,
    required this.symbol,
    required this.fallbackTitle,
    this.securityId,
    this.exchange,
    this.currency,
    this.initialHoldingId,
    super.key,
  });

  final LooApiClient apiClient;
  final String symbol;
  final String fallbackTitle;
  final String? securityId;
  final String? exchange;
  final String? currency;
  final String? initialHoldingId;

  @override
  State<SecurityDetailPage> createState() => _SecurityDetailPageState();
}

class _SecurityDetailPageState extends State<SecurityDetailPage> {
  late Future<MobileSecurityDetailSnapshot?> _snapshot;
  bool _isRefreshingQuote = false;
  final Set<String> _runningResearchSources = <String>{};
  final Map<String, String> _runningResearchTargetKeys = <String, String>{};
  final Set<String> _completedResearchTargetKeys = <String>{};
  Timer? _externalResearchPollTimer;
  VoidCallback? _refreshResearchUpdateSheet;
  int _externalResearchRefreshRevision = 0;
  String? _externalResearchMessage;
  String? _securityId;
  String _selectedResearchScopeId = _ResearchScope.aggregateId;
  final AiAnalysisController _analysisController = AiAnalysisController();

  @override
  void initState() {
    super.initState();
    final initialHoldingId = widget.initialHoldingId?.trim();
    if (initialHoldingId != null && initialHoldingId.isNotEmpty) {
      _selectedResearchScopeId = initialHoldingId;
    }
    _snapshot = _loadSnapshot();
    _startExternalResearchPolling();
  }

  @override
  void dispose() {
    _externalResearchPollTimer?.cancel();
    _refreshResearchUpdateSheet = null;
    super.dispose();
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

  void _refresh() {
    setState(() {
      _snapshot = _loadSnapshot();
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
    var refreshStatus = _loadResearchRefreshSnapshot(data);
    final sheetFuture = showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      builder: (sheetContext) {
        return SafeArea(
          child: StatefulBuilder(
            builder: (sheetContext, setSheetState) {
              _refreshResearchUpdateSheet = () {
                refreshStatus = _loadResearchRefreshSnapshot(data);
                setSheetState(() {});
              };
              return FutureBuilder<_ResearchRefreshSnapshot>(
                future: refreshStatus,
                builder: (context, snapshot) {
                  final status = snapshot.data;
                  _syncRunningExternalResearchFromSnapshot(status);
                  final quoteAction =
                      data.researchRefreshAction("quote-history");
                  final profileAction = data.researchRefreshAction("profile");
                  final institutionalAction =
                      data.researchRefreshAction("institutional");
                  final isRefreshingProfile =
                      _isResearchSourceRunning("profile");
                  final isRefreshingInstitutional =
                      _isResearchSourceRunning("institutional");
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
                          isLoading: snapshot.connectionState ==
                              ConnectionState.waiting,
                          errorMessage: snapshot.hasError
                              ? snapshot.error.toString()
                              : null,
                        ),
                        const SizedBox(height: 10),
                        _ResearchUpdateActionTile(
                          icon: Icons.show_chart,
                          title: quoteAction?.label ?? "刷新报价与走势",
                          detail: quoteAction?.detail ??
                              [
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
                          title: profileAction?.label ?? "刷新基本资料",
                          detail: profileAction?.displayDetail ??
                              "目标价、PE、Beta、市值、52周区间等估值证据。",
                          isBusy: isRefreshingProfile,
                          onTap: !isRefreshingProfile &&
                                  (profileAction?.enabled ?? false)
                              ? () {
                                  unawaited(_runExternalResearchAction(
                                    sheetContext,
                                    data,
                                    profileAction!,
                                    onStateChanged: setSheetState,
                                    reloadRefreshStatus: () {
                                      refreshStatus =
                                          _loadResearchRefreshSnapshot(data);
                                    },
                                  ));
                                }
                              : null,
                        ),
                        _ResearchUpdateActionTile(
                          icon: Icons.event_note_outlined,
                          title: institutionalAction?.label ?? "刷新财报资料",
                          detail: institutionalAction?.displayDetail ??
                              "财报/盈利披露资料，完成后进入缓存供研究台使用。",
                          isBusy: isRefreshingInstitutional,
                          onTap: !isRefreshingInstitutional &&
                                  (institutionalAction?.enabled ?? false)
                              ? () {
                                  unawaited(_runExternalResearchAction(
                                    sheetContext,
                                    data,
                                    institutionalAction!,
                                    onStateChanged: setSheetState,
                                    reloadRefreshStatus: () {
                                      refreshStatus =
                                          _loadResearchRefreshSnapshot(data);
                                    },
                                  ));
                                }
                              : null,
                        ),
                        _ResearchUpdateActionTile(
                          icon: Icons.auto_awesome,
                          title: "重新生成研究结论",
                          detail: _isSubmittingExternalResearch
                              ? "资料刷新完成后会自动更新；也可以稍后手动重新生成。"
                              : "不抓新资料，只用当前缓存重新跑智能快扫。",
                          isBusy: _isSubmittingExternalResearch,
                          onTap: _isSubmittingExternalResearch
                              ? null
                              : () {
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
                              _InfoChip(
                                data.priceHistoryChart!.freshness.label,
                              ),
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
              );
            },
          ),
        );
      },
    );
    unawaited(sheetFuture.whenComplete(() {
      if (_refreshResearchUpdateSheet != null) {
        _refreshResearchUpdateSheet = null;
      }
    }));
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
    String source, {
    bool bypassCache = false,
    StateSetter? onStateChanged,
    VoidCallback? reloadRefreshStatus,
  }) async {
    setState(() {
      _runningResearchSources.add(source);
      _externalResearchMessage = null;
    });
    onStateChanged?.call(() {});

    try {
      final response = await widget.apiClient.enqueueExternalResearchJob(
        {
          "scope": "security",
          "mode": "quick",
          "cacheStrategy": bypassCache ? "refresh" : "prefer-cache",
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
      if (!mounted) return;
      setState(() {
        _externalResearchMessage = "已提交后台刷新。系统会轮询任务状态，等资料真正写入缓存后再自动更新研究结果。";
        if (targetKey != null && targetKey.isNotEmpty) {
          _runningResearchTargetKeys[source] = targetKey;
        }
      });
      reloadRefreshStatus?.call();
      onStateChanged?.call(() {});
      if (targetKey != null && targetKey.isNotEmpty) {
        _startExternalResearchPolling();
        unawaited(_pollExternalResearchJobs());
      } else if (mounted) {
        setState(() {
          _runningResearchSources.remove(source);
        });
        reloadRefreshStatus?.call();
        onStateChanged?.call(() {});
      }
    } on LooApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _runningResearchSources.remove(source);
        _runningResearchTargetKeys.remove(source);
        _externalResearchMessage = error.message;
      });
      reloadRefreshStatus?.call();
      onStateChanged?.call(() {});
    }
  }

  Future<void> _runExternalResearchAction(
    BuildContext sheetContext,
    MobileSecurityDetailSnapshot data,
    MobileResearchRefreshAction action, {
    required StateSetter onStateChanged,
    required VoidCallback reloadRefreshStatus,
  }) async {
    if (action.sourceId == null) {
      return;
    }
    if (action.cache.confirmationRequired) {
      final confirmed = await showDialog<bool>(
        context: sheetContext,
        builder: (context) {
          return AlertDialog(
            title: Text(action.cache.label),
            content: Text(
              action.cache.confirmationMessage ??
                  "资料仍在有效期内，继续刷新会消耗这类资料的每日额度。是否继续？",
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text("取消"),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text("继续刷新"),
              ),
            ],
          );
        },
      );
      if (confirmed != true) {
        return;
      }
    }
    await _enqueueExternalResearch(
      data,
      action.sourceId!,
      bypassCache: action.cache.confirmationRequired,
      onStateChanged: onStateChanged,
      reloadRefreshStatus: reloadRefreshStatus,
    );
  }

  bool _isResearchSourceRunning(String source) =>
      _runningResearchSources.contains(source);

  bool get _isSubmittingExternalResearch => _runningResearchSources.isNotEmpty;

  void _startExternalResearchPolling() {
    _externalResearchPollTimer ??=
        Timer.periodic(const Duration(seconds: 2), (_) {
      if (_runningResearchSources.isEmpty) {
        return;
      }
      unawaited(_pollExternalResearchJobs());
    });
  }

  Future<void> _pollExternalResearchJobs() async {
    if (_runningResearchSources.isEmpty || !mounted) {
      return;
    }

    String sourceLabel(String value) {
      return switch (value) {
        "profile" => "基本资料",
        "institutional" => "财报资料",
        _ => "资料",
      };
    }

    try {
      final response =
          await widget.apiClient.getExternalResearchJobs(limit: 12);
      final data = response["data"];
      final items = data is Map<String, dynamic> ? data["items"] : null;
      if (items is! List) {
        return;
      }

      final nextRunningSources = Set<String>.of(_runningResearchSources);
      String? nextMessage;
      var completedAny = false;
      for (final source in List<String>.of(_runningResearchSources)) {
        final targetKey = _runningResearchTargetKeys[source];
        Map<String, dynamic>? latest;
        for (final item in items) {
          if (item is! Map<String, dynamic>) {
            continue;
          }
          final sameTarget = targetKey != null && targetKey.isNotEmpty
              ? item["targetKey"] == targetKey
              : false;
          if (sameTarget &&
              _externalResearchJobMatchesSource(
                item,
                source,
                allowMissingSource: true,
              )) {
            latest = item;
            break;
          }
        }
        final status = latest?["status"] as String?;
        final statusLabel = latest?["statusLabel"] as String?;
        final statusNote = latest?["statusNote"] as String?;
        final resultLabel = latest?["resultLabel"] as String?;
        final resultDetail = latest?["resultDetail"] as String?;
        final errorMessage = latest?["errorMessage"] as String?;
        if (status == null || status == "queued" || status == "running") {
          nextMessage =
              "${sourceLabel(source)}刷新${status == "queued" ? "排队中" : "运行中"}，完成后会自动更新研究台。";
          continue;
        }

        nextRunningSources.remove(source);
        if (targetKey != null && targetKey.isNotEmpty) {
          _completedResearchTargetKeys.add(targetKey);
        }
        completedAny = true;
        nextMessage = [
          sourceLabel(source),
          resultLabel ?? statusLabel,
          resultDetail ?? statusNote,
          if (resultDetail == null) errorMessage,
        ].whereType<String>().where((value) => value.isNotEmpty).join(" · ");
      }

      if (!mounted) {
        return;
      }
      setState(() {
        _runningResearchSources
          ..clear()
          ..addAll(nextRunningSources);
        _runningResearchTargetKeys.removeWhere(
          (source, targetKey) =>
              !nextRunningSources.contains(source) ||
              _completedResearchTargetKeys.contains(targetKey),
        );
        if (completedAny) {
          _externalResearchRefreshRevision += 1;
        }
        if (nextMessage != null && nextMessage.isNotEmpty) {
          _externalResearchMessage = nextMessage;
        }
      });
      if (completedAny) {
        _refreshResearchUpdateSheet?.call();
      }
    } catch (_) {
      if (mounted && _externalResearchMessage == null) {
        setState(() {
          _externalResearchMessage = "已提交后台刷新，但任务状态暂时无法查询。你可以稍后再点一次重新生成。";
        });
      }
    }
  }

  void _syncRunningExternalResearchFromSnapshot(
    _ResearchRefreshSnapshot? snapshot,
  ) {
    if (snapshot == null || !mounted) {
      return;
    }
    final nextRunningSources = <String>{};
    final nextTargetKeys = <String, String>{};
    for (final entry in snapshot.sources.entries) {
      final targetKey = entry.value.runningTargetKey;
      if (targetKey == null ||
          targetKey.isEmpty ||
          _completedResearchTargetKeys.contains(targetKey)) {
        continue;
      }
      nextRunningSources.add(entry.key);
      nextTargetKeys[entry.key] = targetKey;
    }
    if (nextRunningSources.isEmpty) {
      return;
    }
    final changed = !nextRunningSources
        .every((source) => _runningResearchSources.contains(source));
    if (!changed) {
      return;
    }
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _runningResearchSources.addAll(nextRunningSources);
        _runningResearchTargetKeys.addAll(nextTargetKeys);
      });
      _startExternalResearchPolling();
      unawaited(_pollExternalResearchJobs());
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.fallbackTitle)),
      body: FutureBuilder<MobileSecurityDetailSnapshot?>(
        future: _snapshot,
        builder: (context, snapshot) {
          if (snapshot.connectionState == ConnectionState.waiting) {
            return const LooPageGradient(
              child: Center(child: CircularProgressIndicator()),
            );
          }

          if (snapshot.hasError) {
            return LooPageGradient(
              child: DetailErrorState(
                title: "标的详情暂时打不开",
                message: snapshot.error.toString(),
                onRetry: _refresh,
              ),
            );
          }

          if (!snapshot.hasData) {
            return LooPageGradient(
              child: DetailNotFoundState(
                title: "没有找到这个标的",
                message: "这个标的可能尚未被解析，或当前账户里已经没有相关持仓。",
                onRetry: _refresh,
              ),
            );
          }

          final data = snapshot.data!;
          final priceHistoryChart = data.priceHistoryChart;
          final scopes = _ResearchScope.fromData(data);
          final selectedScope = scopes.firstWhere(
            (scope) => scope.id == _selectedResearchScopeId,
            orElse: () => scopes.first,
          );
          return RefreshIndicator(
            onRefresh: () async => _refresh(),
            child: LooPageGradient(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
                children: [
                  _SecurityHeroFactsCard(
                    data,
                    priceHistoryChart: priceHistoryChart,
                  ),
                  if (priceHistoryChart != null) ...[
                    const SizedBox(height: 12),
                    _PerformanceChartCard(chart: priceHistoryChart),
                  ],
                  const SizedBox(height: 12),
                  if (data.heldPosition == null)
                    const _UnheldPositionCard()
                  else
                    _PositionScopeSection(
                      data: data,
                      scopes: scopes,
                      selectedScope: selectedScope,
                      onSelectScope: (scopeId) => setState(
                        () => _selectedResearchScopeId = scopeId,
                      ),
                    ),
                  const SizedBox(height: 12),
                  _ResearchWorkbenchSection(
                    data,
                    aiAnalysisCard: AiAnalysisCard(
                      apiClient: widget.apiClient,
                      controller: _analysisController,
                      title: "Loo国研究工作台",
                      description:
                          "基于标的事实、资料状态和你的组合上下文生成结论；GPT 增强只在你手动点击时作为解释层。",
                      autoRun: true,
                      showGenerateButton: false,
                      refreshKey: [
                        data.quoteTimestamp,
                        data.priceHistoryChart?.freshness.latestDate,
                        _externalResearchRefreshRevision.toString(),
                      ]
                          .where((part) => part != null && part.isNotEmpty)
                          .join("|"),
                      payload: {
                        "scope": "security",
                        "mode": "quick",
                        "security": {
                          if (data.securityId.isNotEmpty)
                            "securityId": data.securityId,
                          "symbol": data.symbol,
                          if (data.exchange.isNotEmpty)
                            "exchange": data.exchange,
                          if (data.currency.isNotEmpty)
                            "currency": data.currency,
                          "name": data.name,
                        },
                      },
                    ),
                    onOpenUpdateSheet: () => _showResearchUpdateSheet(data),
                    isRefreshingQuote: _isRefreshingQuote,
                    isSubmittingExternalResearch: _isSubmittingExternalResearch,
                    externalResearchMessage: _externalResearchMessage,
                  ),
                ],
              ),
            ),
          );
        },
      ),
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
    required this.researchRefreshActions,
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
  final List<MobileResearchRefreshAction> researchRefreshActions;

  MobileResearchRefreshAction? researchRefreshAction(String id) {
    for (final action in researchRefreshActions) {
      if (action.id == id) return action;
    }
    return null;
  }

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
      researchRefreshActions: readJsonList(json, "researchRefreshActions")
          .map(MobileResearchRefreshAction.fromJson)
          .toList(),
    );
  }
}

class MobileResearchRefreshAction {
  const MobileResearchRefreshAction({
    required this.id,
    required this.label,
    required this.detail,
    required this.providerLabel,
    required this.estimatedCalls,
    required this.quotaLabel,
    required this.enabled,
    required this.disabledReason,
    required this.sourceId,
    required this.cache,
  });

  final String id;
  final String label;
  final String detail;
  final String providerLabel;
  final int estimatedCalls;
  final String? quotaLabel;
  final bool enabled;
  final String? disabledReason;
  final String? sourceId;
  final MobileResearchRefreshActionCache cache;

  String get displayDetail {
    return [
      if (!enabled && disabledReason != null) disabledReason,
      detail,
      if (providerLabel.isNotEmpty) "来源：$providerLabel",
      if (estimatedCalls > 0) "预计 $estimatedCalls 次调用",
      quotaLabel,
      cache.label,
      if (cache.lastUpdatedAtLabel != null) "最近尝试 ${cache.lastUpdatedAtLabel}",
      cache.detail,
    ].whereType<String>().where((value) => value.trim().isNotEmpty).join("；");
  }

  factory MobileResearchRefreshAction.fromJson(Map<String, dynamic> json) {
    return MobileResearchRefreshAction(
      id: json["id"] as String? ?? "",
      label: json["label"] as String? ?? "刷新资料",
      detail: json["detail"] as String? ?? "",
      providerLabel: json["providerLabel"] as String? ?? "",
      estimatedCalls: _readOptionalInt(json["estimatedCalls"]) ?? 0,
      quotaLabel: json["quotaLabel"] as String?,
      enabled: json["enabled"] == true,
      disabledReason: json["disabledReason"] as String?,
      sourceId: json["sourceId"] as String?,
      cache: MobileResearchRefreshActionCache.fromJson(json["cache"]),
    );
  }
}

class MobileResearchRefreshActionCache {
  const MobileResearchRefreshActionCache({
    required this.status,
    required this.label,
    required this.detail,
    required this.lastUpdatedAt,
    required this.ttlLabel,
    required this.confirmationRequired,
    required this.confirmationMessage,
  });

  final String status;
  final String label;
  final String detail;
  final String? lastUpdatedAt;
  final String? ttlLabel;
  final bool confirmationRequired;
  final String? confirmationMessage;

  String? get lastUpdatedAtLabel =>
      _formatExternalResearchJobTime(lastUpdatedAt);

  factory MobileResearchRefreshActionCache.fromJson(Object? value) {
    final json = _readJsonMap(value);
    return MobileResearchRefreshActionCache(
      status: json["status"] as String? ?? "unknown",
      label: json["label"] as String? ?? "状态待确认",
      detail: json["detail"] as String? ?? "",
      lastUpdatedAt: json["lastUpdatedAt"] as String?,
      ttlLabel: json["ttlLabel"] as String?,
      confirmationRequired: json["confirmationRequired"] == true,
      confirmationMessage: json["confirmationMessage"] as String?,
    );
  }
}

class _SecurityHeroFactsCard extends StatelessWidget {
  const _SecurityHeroFactsCard(
    this.data, {
    required this.priceHistoryChart,
  });

  final MobileSecurityDetailSnapshot data;
  final MobileChartSeries? priceHistoryChart;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final tokens = context.looTokens;
    final freshnessColor = _freshnessColor(context, data.freshnessVariant);
    final displayName = _securityDisplayName(data);
    final quoteStatusText = data.quoteTimestamp.isEmpty
        ? data.quoteStatusLabel
        : "${data.quoteStatusLabel} · ${data.quoteTimestamp}";

    return LooGlassCard(
      isHero: true,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                data.symbol,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: theme.textTheme.displaySmall,
              ),
              if (displayName.isNotEmpty) ...[
                const SizedBox(height: 6),
                Text(
                  displayName,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: theme.textTheme.titleMedium?.copyWith(
                    color: tokens.mutedText,
                  ),
                ),
              ],
              const SizedBox(height: 10),
              Align(
                alignment: Alignment.centerLeft,
                child: ConstrainedBox(
                  constraints: const BoxConstraints(maxWidth: 320),
                  child: _StatusPill(
                    label: quoteStatusText,
                    color: freshnessColor,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 18),
          Text(
            data.lastPrice,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: theme.textTheme.headlineMedium,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (data.subtitle.isNotEmpty) _InfoChip(data.subtitle),
            ],
          ),
          const SizedBox(height: 14),
          _MetricGrid(data),
        ],
      ),
    );
  }
}

String _securityDisplayName(MobileSecurityDetailSnapshot data) {
  final name = data.name.trim();
  final symbol = data.symbol.trim();
  if (name.isEmpty || name == "--") {
    return "";
  }
  if (symbol.isNotEmpty && name.toUpperCase() == symbol.toUpperCase()) {
    return "";
  }
  return name;
}

class _ResearchWorkbenchSection extends StatefulWidget {
  const _ResearchWorkbenchSection(
    this.data, {
    required this.aiAnalysisCard,
    required this.onOpenUpdateSheet,
    required this.isRefreshingQuote,
    required this.isSubmittingExternalResearch,
    this.externalResearchMessage,
  });

  final MobileSecurityDetailSnapshot data;
  final Widget aiAnalysisCard;
  final VoidCallback onOpenUpdateSheet;
  final bool isRefreshingQuote;
  final bool isSubmittingExternalResearch;
  final String? externalResearchMessage;

  @override
  State<_ResearchWorkbenchSection> createState() =>
      _ResearchWorkbenchSectionState();
}

class _ResearchWorkbenchSectionState extends State<_ResearchWorkbenchSection> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(tokens.radiusMd),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Row(
              children: [
                const Expanded(
                  child: _SectionHeader(title: "Loo国研究台", trailing: "高级"),
                ),
                AnimatedRotation(
                  turns: _expanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOutCubic,
                  child: Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: tokens.mutedText,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          Text(
            widget.data.heldPosition == null
                ? "候选适配、估值证据和关键价位。"
                : "组合适配、估值证据和关键价位。",
            maxLines: _expanded ? 3 : 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.mutedText,
                ),
          ),
          const SizedBox(height: 12),
          _ResearchUpdateStatusBar(
            data: widget.data,
            isRefreshingQuote: widget.isRefreshingQuote,
            isSubmittingExternalResearch: widget.isSubmittingExternalResearch,
            message: widget.externalResearchMessage,
            onTap: widget.onOpenUpdateSheet,
          ),
          if (_expanded) ...[
            const SizedBox(height: 12),
            _QuickScanPanel(child: widget.aiAnalysisCard),
          ],
        ],
      ),
    );
  }
}

class _QuickScanPanel extends StatelessWidget {
  const _QuickScanPanel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const Padding(
          padding: EdgeInsets.fromLTRB(4, 2, 4, 10),
          child: _SectionHeader(title: "智能研究结论", trailing: "可增强解释"),
        ),
        child,
      ],
    );
  }
}

class _ResearchScope {
  const _ResearchScope({
    required this.id,
    required this.label,
    this.account,
    this.holding,
  });

  static const aggregateId = "aggregate";

  final String id;
  final String label;
  final MobileHeldAccountSummary? account;
  final MobileHoldingCard? holding;

  bool get isAggregate => id == aggregateId;

  static List<_ResearchScope> fromData(MobileSecurityDetailSnapshot data) {
    final scopes = <_ResearchScope>[
      const _ResearchScope(id: aggregateId, label: "总览"),
    ];
    final holdingsById = {
      for (final holding in data.relatedHoldings) holding.id: holding,
    };
    final accounts = data.heldPosition?.accountSummaries ?? const [];
    for (final account in accounts) {
      final holding = holdingsById[account.holdingId];
      scopes.add(
        _ResearchScope(
          id: account.holdingId.isNotEmpty
              ? account.holdingId
              : "account-${account.accountLabel}",
          label: account.accountLabel.isNotEmpty ? account.accountLabel : "账户",
          account: account,
          holding: holding,
        ),
      );
    }
    return scopes;
  }
}

class _ResearchScopeTabs extends StatelessWidget {
  const _ResearchScopeTabs({
    required this.scopes,
    required this.selectedScopeId,
    required this.onSelected,
  });

  final List<_ResearchScope> scopes;
  final String selectedScopeId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    if (scopes.length <= 1) {
      return const SizedBox.shrink();
    }
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: scopes.map((scope) {
          final selected = scope.id == selectedScopeId;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: ChoiceChip(
              label: Text(scope.label),
              selected: selected,
              onSelected: (_) => onSelected(scope.id),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _PositionScopeSection extends StatelessWidget {
  const _PositionScopeSection({
    required this.data,
    required this.scopes,
    required this.selectedScope,
    required this.onSelectScope,
  });

  final MobileSecurityDetailSnapshot data;
  final List<_ResearchScope> scopes;
  final _ResearchScope selectedScope;
  final ValueChanged<String> onSelectScope;

  @override
  Widget build(BuildContext context) {
    return _CollapsiblePositionScopeSection(
      data: data,
      scopes: scopes,
      selectedScope: selectedScope,
      onSelectScope: onSelectScope,
    );
  }
}

class _CollapsiblePositionScopeSection extends StatefulWidget {
  const _CollapsiblePositionScopeSection({
    required this.data,
    required this.scopes,
    required this.selectedScope,
    required this.onSelectScope,
  });

  final MobileSecurityDetailSnapshot data;
  final List<_ResearchScope> scopes;
  final _ResearchScope selectedScope;
  final ValueChanged<String> onSelectScope;

  @override
  State<_CollapsiblePositionScopeSection> createState() =>
      _CollapsiblePositionScopeSectionState();
}

class _CollapsiblePositionScopeSectionState
    extends State<_CollapsiblePositionScopeSection> {
  var _expanded = false;

  @override
  Widget build(BuildContext context) {
    final data = widget.data;
    if (data.heldPosition == null) {
      return const SizedBox.shrink();
    }
    final tokens = context.looTokens;
    return LooGlassCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          InkWell(
            borderRadius: BorderRadius.circular(tokens.radiusMd),
            onTap: () => setState(() => _expanded = !_expanded),
            child: Row(
              children: [
                const Expanded(
                  child: _SectionHeader(title: "我的仓位", trailing: "持仓层"),
                ),
                AnimatedRotation(
                  turns: _expanded ? 0.5 : 0,
                  duration: const Duration(milliseconds: 180),
                  curve: Curves.easeOutCubic,
                  child: Icon(
                    Icons.keyboard_arrow_down_rounded,
                    color: tokens.mutedText,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(height: 6),
          _PositionScopeSummary(
            data: data,
            selectedScope: widget.selectedScope,
          ),
          if (_expanded) ...[
            const SizedBox(height: 12),
            _ResearchScopeTabs(
              scopes: widget.scopes,
              selectedScopeId: widget.selectedScope.id,
              onSelected: widget.onSelectScope,
            ),
            const SizedBox(height: 12),
            if (!widget.selectedScope.isAggregate &&
                widget.selectedScope.account != null)
              Column(
                children: [
                  _AnalysisCard(
                    data.analysis,
                    account: widget.selectedScope.account,
                  ),
                  const SizedBox(height: 12),
                  _AccountScopeCard(
                    widget.selectedScope.account!,
                    holding: widget.selectedScope.holding,
                  ),
                ],
              )
            else ...[
              _AnalysisCard(data.analysis),
              const SizedBox(height: 12),
              _HeldPositionBreakdownCard(
                data.heldPosition!,
                onOpenHolding: widget.onSelectScope,
              ),
            ],
          ],
        ],
      ),
    );
  }
}

class _UnheldPositionCard extends StatelessWidget {
  const _UnheldPositionCard();

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return LooGlassCard(
      padding: EdgeInsets.all(tokens.gapMd),
      child: Row(
        children: [
          Container(
            height: 38,
            width: 38,
            decoration: BoxDecoration(
              color: tokens.accent.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(tokens.radiusMd),
            ),
            child: Icon(
              Icons.visibility_outlined,
              size: 20,
              color: tokens.accent,
            ),
          ),
          SizedBox(width: tokens.gapMd),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text("未持有", style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 4),
                Text(
                  "当前按候选标的处理；持仓层分析会在加入组合后显示。",
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: tokens.mutedText,
                      ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AnalysisCard extends StatelessWidget {
  const _AnalysisCard(this.analysis, {this.account});

  final MobileSecurityAnalysis analysis;
  final MobileHeldAccountSummary? account;

  @override
  Widget build(BuildContext context) {
    final isAccountScope = account != null;
    final currentAllocation = isAccountScope
        ? (account!.accountAssetClassAllocation.isNotEmpty
            ? account!.accountAssetClassAllocation
            : "0%")
        : analysis.currentAllocation;
    final currentAllocationPct = isAccountScope
        ? account!.accountAssetClassAllocationPct
        : analysis.currentAllocationPct;
    final shareLabel = isAccountScope ? "本标的账户占比" : "本标的组合占比";
    final shareValue =
        isAccountScope ? account!.accountShare : analysis.portfolioShare;
    final sharePct = isAccountScope
        ? _parsePercent(account!.accountShare)
        : analysis.portfolioSharePct;
    return _InnerPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(
            title: "底层暴露配置",
            trailing: isAccountScope ? "账户视角" : "组合视角",
          ),
          const SizedBox(height: 6),
          Text(
            isAccountScope
                ? "${analysis.assetClassLabel} 在当前账户里的占比，不等同于整个组合占比。"
                : "${analysis.assetClassLabel} 按底层经济暴露计算，不只看上市国家或交易币种。",
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: context.looTokens.mutedText,
                ),
          ),
          const SizedBox(height: 12),
          _ProgressMetric(
            label: "目标占比",
            value: analysis.targetAllocation,
            progress: analysis.targetAllocationPct / 100,
          ),
          _ProgressMetric(
            label: isAccountScope ? "账户内同类暴露" : "组合内同类暴露",
            value: currentAllocation,
            progress: currentAllocationPct / 100,
          ),
          _ProgressMetric(
            label: shareLabel,
            value: shareValue,
            progress: sharePct / 100,
          ),
          const SizedBox(height: 4),
          Text(
            isAccountScope ? "用于判断这个账户是否已经过度集中。" : "偏离：${analysis.driftLabel}",
            style: Theme.of(context).textTheme.titleMedium,
          ),
        ],
      ),
    );
  }
}

class _ResearchUpdateStatusBar extends StatelessWidget {
  const _ResearchUpdateStatusBar({
    required this.data,
    required this.isRefreshingQuote,
    required this.isSubmittingExternalResearch,
    required this.onTap,
    this.message,
  });

  final MobileSecurityDetailSnapshot data;
  final bool isRefreshingQuote;
  final bool isSubmittingExternalResearch;
  final String? message;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isBusy = isRefreshingQuote || isSubmittingExternalResearch;
    final theme = Theme.of(context);
    final detail = [
      data.quoteStatusLabel,
      data.priceHistoryChart?.freshness.label,
    ].whereType<String>().where((value) => value.isNotEmpty).join(" · ");
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: onTap,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color:
              theme.colorScheme.surfaceContainerHighest.withValues(alpha: 0.38),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: theme.colorScheme.outlineVariant),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Icon(
                Icons.cloud_sync_outlined,
                size: 18,
                color: theme.colorScheme.primary,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text("资料更新", style: theme.textTheme.titleSmall),
                    if ((message ?? detail).isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        message ?? detail,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: context.looTokens.mutedText,
                        ),
                      ),
                    ],
                  ],
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
        ),
      ),
    );
  }
}

class _PositionScopeSummary extends StatelessWidget {
  const _PositionScopeSummary({
    required this.data,
    required this.selectedScope,
  });

  final MobileSecurityDetailSnapshot data;
  final _ResearchScope selectedScope;

  @override
  Widget build(BuildContext context) {
    final position = data.heldPosition;
    if (position == null) {
      return const SizedBox.shrink();
    }
    final parts = selectedScope.account == null
        ? [
            if (position.value.isNotEmpty) position.value,
            if (position.gainLoss.isNotEmpty) position.gainLoss,
            if (position.portfolioShare.isNotEmpty) position.portfolioShare,
          ]
        : [
            if (selectedScope.account!.value.isNotEmpty)
              selectedScope.account!.value,
            if (selectedScope.account!.gainLoss.isNotEmpty)
              selectedScope.account!.gainLoss,
            if (selectedScope.account!.accountShare.isNotEmpty)
              "账户内 ${selectedScope.account!.accountShare}",
          ];
    return Text(
      parts.where((part) => part.isNotEmpty).join(" · "),
      maxLines: 2,
      overflow: TextOverflow.ellipsis,
      style: Theme.of(context).textTheme.bodySmall?.copyWith(
            color: context.looTokens.mutedText,
          ),
    );
  }
}

class _AccountScopeCard extends StatelessWidget {
  const _AccountScopeCard(this.account, {this.holding});

  final MobileHeldAccountSummary account;
  final MobileHoldingCard? holding;

  @override
  Widget build(BuildContext context) {
    final details = [
      if (account.accountType.isNotEmpty) account.accountType,
      if (account.accountShare.isNotEmpty) "账户内占比 ${account.accountShare}",
      if (account.positionShare.isNotEmpty) "总仓位占比 ${account.positionShare}",
    ];
    return _InnerPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _SectionHeader(title: account.accountLabel, trailing: "账户诊断"),
          if (details.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              details.join(" · "),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _MiniMetric(label: "市值", value: account.value),
              _MiniMetric(label: "盈亏", value: account.gainLoss),
              _MiniMetric(label: "账户内占比", value: account.accountShare),
              _MiniMetric(label: "总仓位占比", value: account.positionShare),
            ],
          ),
          if (holding != null && holding!.detail.isNotEmpty) ...[
            const SizedBox(height: 12),
            Text(
              holding!.detail,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: context.looTokens.mutedText,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

class _HeldPositionBreakdownCard extends StatelessWidget {
  const _HeldPositionBreakdownCard(
    this.position, {
    required this.onOpenHolding,
  });

  final MobileHeldPosition position;
  final ValueChanged<String> onOpenHolding;

  @override
  Widget build(BuildContext context) {
    final accounts = position.accountSummaries
        .where((account) => account.positionSharePct > 0)
        .take(6)
        .toList();
    return _InnerPanel(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const _SectionHeader(title: "持仓拆分", trailing: "我的仓位"),
          const SizedBox(height: 8),
          Text(position.value, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              if (position.gainLoss.isNotEmpty) _InfoChip(position.gainLoss),
              if (position.quantity.isNotEmpty && position.quantity != "--")
                _InfoChip(position.quantity),
              if (position.portfolioShare.isNotEmpty)
                _InfoChip("组合 ${position.portfolioShare}"),
              if (position.accountCount.isNotEmpty)
                _InfoChip("${position.accountCount} 个账户"),
            ],
          ),
          if (accounts.isNotEmpty) ...[
            const SizedBox(height: 12),
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
            const SizedBox(height: 10),
            ...accounts.map(
              (account) => _AccountBreakdownRow(
                account,
                onTap: account.holdingId.isEmpty
                    ? null
                    : () => onOpenHolding(account.holdingId),
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _AccountBreakdownRow extends StatelessWidget {
  const _AccountBreakdownRow(this.account, {required this.onTap});

  final MobileHeldAccountSummary account;
  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final detailParts = [
      if (account.accountShare.isNotEmpty) "账户内 ${account.accountShare}",
      if (account.value.isNotEmpty) account.value,
      if (account.gainLoss.isNotEmpty) "盈亏 ${account.gainLoss}",
    ];
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: InkWell(
        borderRadius: BorderRadius.circular(12),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      [
                        account.accountLabel,
                        account.accountType,
                      ].where((item) => item.isNotEmpty).join(" · "),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    if (detailParts.isNotEmpty) ...[
                      const SizedBox(height: 3),
                      Text(
                        detailParts.join(" · "),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context)
                            .textTheme
                            .bodySmall
                            ?.copyWith(color: tokens.mutedText),
                      ),
                    ],
                  ],
                ),
              ),
              Text(
                account.positionShare,
                style: Theme.of(context).textTheme.titleSmall,
              ),
              const SizedBox(width: 6),
              Icon(
                Icons.arrow_forward_rounded,
                size: 16,
                color: context.looTokens.mutedText,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MiniMetric extends StatelessWidget {
  const _MiniMetric({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.22),
        borderRadius: BorderRadius.circular(tokens.radiusMd),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        child: SizedBox(
          width: 116,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: tokens.mutedText,
                    ),
              ),
              const SizedBox(height: 5),
              Text(
                value.isEmpty ? "--" : value,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleSmall,
              ),
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
        detail: "确认缓存窗口和最近任务状态。",
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
    required this.ttlLabel,
    required this.latestLabel,
    required this.canSubmit,
    required this.sources,
  });

  final String statusLabel;
  final String detail;
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
        ? "外部资料额度待确认"
        : "外部资料额度剩余 ${remainingRuns ?? "--"} / $dailyRunLimit";
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
            quotaLabel: quotaLabel,
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
    required this.runningTargetKey,
  });

  final String sourceId;
  final String label;
  final String detail;
  final bool canSubmit;
  final String? runningTargetKey;

  factory _ResearchSourceRefreshStatus.fromPolicyAndJobs({
    required String sourceId,
    required Map<String, dynamic> policy,
    required List<Map<String, dynamic>> jobs,
    required MobileSecurityDetailSnapshot security,
    required bool baseCanSubmit,
    required String ttlLabel,
    required String quotaLabel,
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
    final latestStatus = latest?["status"] as String?;
    final runningTargetKey =
        latestStatus == "queued" || latestStatus == "running"
            ? (latest?["targetKey"] as String?)
            : null;
    final latestTime = _formatExternalResearchJobTime(
      latest?["finishedAt"] ?? latest?["startedAt"] ?? latest?["createdAt"],
    );
    final detail = runningTargetKey != null && runningTargetKey.isNotEmpty
        ? "$label 正在后台刷新；完成后会自动更新研究台。"
        : !sourceEnabled
            ? "$label 暂未启用；不会显示成可刷新。"
            : !baseCanSubmit
                ? blockedDetail
                : latest == null
                    ? "未见最近刷新；$quotaLabel；完成后进入$ttlLabel。"
                    : [
                        quotaLabel,
                        latest["resultLabel"] as String? ??
                            latest["statusLabel"] as String?,
                        latestTime == null ? null : "最近尝试 $latestTime",
                        if (latest["status"] == "succeeded")
                          _readJsonMap(latest["freshness"])["freshnessLabel"]
                              as String?,
                        latest["resultDetail"] as String? ??
                            latest["statusNote"] as String?,
                        if (latest["resultDetail"] == null)
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
      runningTargetKey: runningTargetKey,
    );
  }
}

String? _formatExternalResearchJobTime(Object? value) {
  final raw = value?.toString();
  if (raw == null || raw.trim().isEmpty) {
    return null;
  }
  final parsed = DateTime.tryParse(raw);
  if (parsed == null) {
    return raw;
  }
  final local = parsed.toLocal();
  String two(int number) => number.toString().padLeft(2, "0");
  return "${local.month}月${local.day}日 ${two(local.hour)}:${two(local.minute)}";
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
        label: "可用于快扫",
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
    this.rawDate,
  });

  final String label;
  final String value;
  final double chartValue;
  final String? rawDate;

  factory MobileSecurityPerformancePoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];

    return MobileSecurityPerformancePoint(
      label: json["label"] as String? ?? "未知表现",
      value: rawValue is num
          ? rawValue.toStringAsFixed(2)
          : rawValue?.toString() ?? "--",
      chartValue: rawValue is num ? rawValue.toDouble() : 0,
      rawDate: json["rawDate"] as String?,
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
      rawDate: json["rawDate"] as String?,
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
    required this.holdingId,
    required this.accountId,
    required this.accountLabel,
    required this.accountType,
    required this.value,
    required this.positionShare,
    required this.positionSharePct,
    required this.accountShare,
    required this.accountAssetClassAllocation,
    required this.accountAssetClassAllocationPct,
    required this.gainLoss,
  });

  final String holdingId;
  final String accountId;
  final String accountLabel;
  final String accountType;
  final String value;
  final String positionShare;
  final double positionSharePct;
  final String accountShare;
  final String accountAssetClassAllocation;
  final double accountAssetClassAllocationPct;
  final String gainLoss;

  factory MobileHeldAccountSummary.fromJson(Map<String, dynamic> json) {
    return MobileHeldAccountSummary(
      holdingId: json["holdingId"] as String? ?? "",
      accountId: json["accountId"] as String? ?? "",
      accountLabel: json["accountLabel"] as String? ?? "未知账户",
      accountType: json["accountType"] as String? ?? "",
      value: json["value"] as String? ?? "--",
      positionShare: json["positionShare"] as String? ?? "--",
      positionSharePct: _readDouble(json["positionSharePct"]),
      accountShare: json["accountShare"] as String? ?? "",
      accountAssetClassAllocation:
          json["accountAssetClassAllocation"] as String? ?? "",
      accountAssetClassAllocationPct:
          _readDouble(json["accountAssetClassAllocationPct"]),
      gainLoss: json["gainLoss"] as String? ?? "",
    );
  }
}

class _MetricGrid extends StatefulWidget {
  const _MetricGrid(this.data);

  final MobileSecurityDetailSnapshot data;

  @override
  State<_MetricGrid> createState() => _MetricGridState();
}

class _MetricGridState extends State<_MetricGrid> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    final metrics = _buildMetrics(widget.data);

    if (metrics.isEmpty) {
      return const SizedBox.shrink();
    }

    final visibleMetrics = _expanded ? metrics : metrics.take(4).toList();
    final hiddenCount = metrics.length - visibleMetrics.length;

    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - 8) / 2;
        return Column(
          children: [
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: visibleMetrics
                  .map(
                    (metric) => SizedBox(
                      width: width,
                      child: _MetricCard(metric),
                    ),
                  )
                  .toList(),
            ),
            if (metrics.length > 4) ...[
              SizedBox(height: tokens.gapSm),
              Align(
                alignment: Alignment.centerLeft,
                child: TextButton.icon(
                  style: TextButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                    padding: EdgeInsets.zero,
                    foregroundColor: tokens.accent,
                    tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  ),
                  onPressed: () => setState(() => _expanded = !_expanded),
                  icon: Icon(
                    _expanded
                        ? Icons.keyboard_arrow_up_rounded
                        : Icons.keyboard_arrow_down_rounded,
                    size: 18,
                  ),
                  label: Text(_expanded ? "收起补充信息" : "展开 $hiddenCount 项补充信息"),
                ),
              ),
            ],
          ],
        );
      },
    );
  }

  List<_MetricDatum> _buildMetrics(MobileSecurityDetailSnapshot data) {
    final held = data.heldPosition;
    return [
      _MetricDatum("最新价格", data.lastPrice),
      if (data.assetClass.isNotEmpty) _MetricDatum("资产属性", data.assetClass),
      if (data.sector.isNotEmpty) _MetricDatum("行业", data.sector),
      if (data.exchange.isNotEmpty || data.currency.isNotEmpty)
        _MetricDatum(
          "交易市场",
          [data.exchange, data.currency]
              .where((item) => item.trim().isNotEmpty)
              .join(" · "),
        ),
      if (data.priceHistoryChart != null)
        _MetricDatum("价格历史", data.priceHistoryChart!.freshness.label),
      if (data.facts.isNotEmpty)
        ...data.facts.take(3).map(
              (fact) => _MetricDatum(fact.label, fact.value),
            ),
      if (held == null)
        _MetricDatum("相关持仓", "${data.relatedHoldings.length} 个"),
    ].where((item) => item.value.isNotEmpty && item.value != "--").toList();
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
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.36),
        borderRadius: BorderRadius.circular(tokens.radiusMd),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 9),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              metric.label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: tokens.mutedText,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              metric.value,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontSize: 15,
                    fontWeight: FontWeight.w700,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SectionHeader extends StatelessWidget {
  const _SectionHeader({required this.title, this.trailing});

  final String title;
  final String? trailing;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Expanded(
          child: Text(title, style: Theme.of(context).textTheme.titleLarge),
        ),
        if (trailing != null && trailing!.isNotEmpty)
          Text(
            trailing!,
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  color: context.looTokens.accent,
                ),
          ),
      ],
    );
  }
}

class _InnerPanel extends StatelessWidget {
  const _InnerPanel({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final tokens = context.looTokens;
    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.26),
        borderRadius: BorderRadius.circular(tokens.radiusMd),
        border: Border.all(color: tokens.cardBorder),
      ),
      child: Padding(
        padding: EdgeInsets.all(tokens.gapMd),
        child: child,
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
    final points = chart.points
        .map((point) => (
              label: point.label,
              displayValue: point.displayValue,
              chartValue: point.value,
              rawDate: DateTime.tryParse(point.rawDate ?? ""),
            ))
        .toList();
    if (points.length < 2) {
      return const SizedBox.shrink();
    }
    return LooGlassCard(
      child: LooTrendChart(
        title: "价格走势",
        points: points
            .map(
              (point) => LooTrendPoint(
                label: point.label,
                displayValue: point.displayValue,
                value: point.chartValue,
                rawDate: point.rawDate,
              ),
            )
            .toList(),
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
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
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

double _parsePercent(String value) {
  final normalized = value.replaceAll("%", "").replaceAll("+", "").trim();
  return double.tryParse(normalized) ?? 0;
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

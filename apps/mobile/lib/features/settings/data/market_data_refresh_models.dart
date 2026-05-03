class MarketDataRefreshStatus {
  const MarketDataRefreshStatus({
    required this.latestStatusLabel,
    required this.latestProviderStatusLabel,
    required this.latestFxLabel,
    required this.latestFxFreshnessLabel,
    required this.latestManualStatusLabel,
    required this.latestManualProviderStatusLabel,
    required this.latestManualFxLabel,
    required this.latestManualFxFreshnessLabel,
    required this.freshnessPolicy,
    required this.items,
  });

  final String latestStatusLabel;
  final String latestProviderStatusLabel;
  final String? latestFxLabel;
  final String? latestFxFreshnessLabel;
  final String latestManualStatusLabel;
  final String latestManualProviderStatusLabel;
  final String? latestManualFxLabel;
  final String? latestManualFxFreshnessLabel;
  final MobileFreshnessPolicy freshnessPolicy;
  final List<MarketDataRefreshRunItem> items;

  factory MarketDataRefreshStatus.fromApiResponse(Map<String, dynamic> json) {
    final data = json["data"];
    final payload =
        data is Map<String, dynamic> ? data : const <String, dynamic>{};
    return MarketDataRefreshStatus.fromJson(payload);
  }

  factory MarketDataRefreshStatus.fromJson(Map<String, dynamic> json) {
    final summary = json["summary"] is Map<String, dynamic>
        ? json["summary"] as Map<String, dynamic>
        : const <String, dynamic>{};
    final rawItems = json["items"];
    String? readSummaryString(String key) {
      final value = summary[key];
      return value is String ? value : null;
    }

    return MarketDataRefreshStatus(
      latestStatusLabel: readSummaryString("latestStatusLabel") ?? "还没有刷新记录",
      latestProviderStatusLabel:
          readSummaryString("latestProviderStatusLabel") ?? "尚未执行过行情刷新。",
      latestFxLabel: readSummaryString("latestFxLabel"),
      latestFxFreshnessLabel: readSummaryString("latestFxFreshnessLabel"),
      latestManualStatusLabel: readSummaryString("latestManualStatusLabel") ??
          readSummaryString("latestStatusLabel") ??
          "还没有手动刷新记录",
      latestManualProviderStatusLabel:
          readSummaryString("latestManualProviderStatusLabel") ??
              readSummaryString("latestProviderStatusLabel") ??
              "尚未执行过手动行情刷新。",
      latestManualFxLabel: readSummaryString("latestManualFxLabel") ??
          readSummaryString("latestFxLabel"),
      latestManualFxFreshnessLabel:
          readSummaryString("latestManualFxFreshnessLabel") ??
              readSummaryString("latestFxFreshnessLabel"),
      freshnessPolicy: MobileFreshnessPolicy.fromJson(
        json["freshnessPolicy"] is Map<String, dynamic>
            ? json["freshnessPolicy"] as Map<String, dynamic>
            : const <String, dynamic>{},
      ),
      items: rawItems is List
          ? rawItems
              .whereType<Map<String, dynamic>>()
              .map(MarketDataRefreshRunItem.fromJson)
              .toList()
          : const [],
    );
  }
}

class MobileFreshnessPolicy {
  const MobileFreshnessPolicy({
    required this.quoteTtlLabel,
    required this.fxTtlLabel,
    required this.historyTtlLabel,
    required this.externalIntelligenceTtlLabel,
    required this.workerBoundaryLabel,
    required this.items,
  });

  final String quoteTtlLabel;
  final String fxTtlLabel;
  final String historyTtlLabel;
  final String externalIntelligenceTtlLabel;
  final String workerBoundaryLabel;
  final List<MobileFreshnessPolicyItem> items;

  factory MobileFreshnessPolicy.fromJson(Map<String, dynamic> json) {
    final summary = json["summary"] is Map<String, dynamic>
        ? json["summary"] as Map<String, dynamic>
        : const <String, dynamic>{};
    final rawItems = json["items"];
    String readSummary(String key, String fallback) {
      final value = summary[key];
      return value is String && value.isNotEmpty ? value : fallback;
    }

    return MobileFreshnessPolicy(
      quoteTtlLabel: readSummary("quoteTtlLabel", "30 分钟"),
      fxTtlLabel: readSummary("fxTtlLabel", "12 小时"),
      historyTtlLabel: readSummary("historyTtlLabel", "30 分钟"),
      externalIntelligenceTtlLabel:
          readSummary("externalIntelligenceTtlLabel", "6 小时"),
      workerBoundaryLabel: readSummary(
        "workerBoundaryLabel",
        "行情、FX、历史和外部情报都应走 worker/cache；手机页面只读状态或手动确认触发。",
      ),
      items: rawItems is List
          ? rawItems
              .whereType<Map<String, dynamic>>()
              .map(MobileFreshnessPolicyItem.fromJson)
              .toList()
          : const [],
    );
  }
}

class MobileFreshnessPolicyItem {
  const MobileFreshnessPolicyItem({
    required this.id,
    required this.label,
    required this.ttlLabel,
    required this.sourceLabel,
    required this.usageLabel,
    required this.staleBehaviorLabel,
    required this.workerTarget,
    required this.userActionLabel,
  });

  final String id;
  final String label;
  final String ttlLabel;
  final String sourceLabel;
  final String usageLabel;
  final String staleBehaviorLabel;
  final bool workerTarget;
  final String userActionLabel;

  factory MobileFreshnessPolicyItem.fromJson(Map<String, dynamic> json) {
    return MobileFreshnessPolicyItem(
      id: json["id"] as String? ?? "unknown",
      label: json["label"] as String? ?? "数据策略",
      ttlLabel: json["ttlLabel"] as String? ?? "TTL 未知",
      sourceLabel: json["sourceLabel"] as String? ?? "来源待确认",
      usageLabel: json["usageLabel"] as String? ?? "用途待确认",
      staleBehaviorLabel:
          json["staleBehaviorLabel"] as String? ?? "过期后会显示边界说明。",
      workerTarget: json["workerTarget"] == true,
      userActionLabel: json["userActionLabel"] as String? ?? "请在对应页面手动确认。",
    );
  }
}

class MarketDataRefreshRunItem {
  const MarketDataRefreshRunItem({
    required this.scopeLabel,
    required this.status,
    required this.statusLabel,
    required this.triggeredBy,
    required this.triggerLabel,
    required this.sampledSymbolCount,
    required this.refreshedHoldingCount,
    required this.missingQuoteCount,
    required this.historyPointCount,
    required this.snapshotRecorded,
    required this.fxRateLabel,
    required this.fxFreshnessLabel,
    required this.providerStatusLabel,
    required this.providerLimitLabels,
    required this.createdAt,
    required this.durationMs,
  });

  final String scopeLabel;
  final String status;
  final String statusLabel;
  final String triggeredBy;
  final String triggerLabel;
  final int sampledSymbolCount;
  final int refreshedHoldingCount;
  final int missingQuoteCount;
  final int historyPointCount;
  final bool snapshotRecorded;
  final String? fxRateLabel;
  final String? fxFreshnessLabel;
  final String providerStatusLabel;
  final List<String> providerLimitLabels;
  final DateTime? createdAt;
  final int? durationMs;

  String get createdAtLabel {
    final value = createdAt;
    if (value == null) {
      return "时间未知";
    }
    final local = value.toLocal();
    String two(int number) => number.toString().padLeft(2, "0");
    return "${local.month}/${local.day} ${two(local.hour)}:${two(local.minute)}";
  }

  String get durationLabel {
    final value = durationMs;
    if (value == null) {
      return "耗时未知";
    }
    if (value < 1000) {
      return "${value}ms";
    }
    return "${(value / 1000).toStringAsFixed(1)}s";
  }

  String get subtitle {
    return [
      "$triggerLabel · $createdAtLabel · $durationLabel",
      if (isSkippedWorker) "这是后台 worker 的预算保护跳过，不代表手动行情刷新失败。",
      "检查 $sampledSymbolCount 个标的；刷新 $refreshedHoldingCount 笔持仓；缺失 $missingQuoteCount；历史 $historyPointCount 条；${snapshotRecorded ? "已记录快照" : "未记录快照"}",
      if (fxRateLabel != null && fxRateLabel!.isNotEmpty) fxRateLabel!,
      if (fxFreshnessLabel != null && fxFreshnessLabel!.isNotEmpty)
        fxFreshnessLabel!,
      ...providerLimitLabels,
      providerStatusLabel,
    ].join("\n");
  }

  String get titleLabel {
    return "$triggerLabel · $scopeLabel · $statusLabel";
  }

  bool get isSkippedWorker {
    return triggeredBy == "worker" && status == "skipped";
  }

  factory MarketDataRefreshRunItem.fromJson(Map<String, dynamic> json) {
    final rawCreatedAt = json["createdAt"];
    final rawProviderLimits = json["providerLimits"];
    return MarketDataRefreshRunItem(
      scopeLabel: json["scopeLabel"] as String? ?? "组合行情",
      status: json["status"] as String? ?? "unknown",
      statusLabel: json["statusLabel"] as String? ?? "状态未知",
      triggeredBy: json["triggeredBy"] as String? ?? "system",
      triggerLabel: json["triggerLabel"] as String? ?? "系统刷新",
      sampledSymbolCount: json["sampledSymbolCount"] as int? ?? 0,
      refreshedHoldingCount: json["refreshedHoldingCount"] as int? ?? 0,
      missingQuoteCount: json["missingQuoteCount"] as int? ?? 0,
      historyPointCount: json["historyPointCount"] as int? ?? 0,
      snapshotRecorded: json["snapshotRecorded"] == true,
      fxRateLabel: json["fxRateLabel"] as String?,
      fxFreshnessLabel: json["fxFreshnessLabel"] as String?,
      providerStatusLabel:
          json["providerStatusLabel"] as String? ?? "没有 provider 状态说明。",
      providerLimitLabels: rawProviderLimits is List
          ? rawProviderLimits
              .whereType<Map<String, dynamic>>()
              .where((item) => item["limited"] == true)
              .map((item) {
              final provider = item["provider"] as String? ?? "provider";
              final retryAfter = item["retryAfterSeconds"] as int?;
              return retryAfter == null
                  ? "$provider 已限流"
                  : "$provider 已限流，约 $retryAfter 秒后重试";
            }).toList()
          : const [],
      createdAt:
          rawCreatedAt is String ? DateTime.tryParse(rawCreatedAt) : null,
      durationMs: json["durationMs"] as int?,
    );
  }
}

class WorkerStatusCenter {
  const WorkerStatusCenter({
    required this.title,
    required this.statusLabel,
    required this.nextRunLabel,
    required this.tasks,
    required this.providerUsage,
  });

  final String title;
  final String statusLabel;
  final String nextRunLabel;
  final List<WorkerTaskStatus> tasks;
  final List<ProviderUsageItem> providerUsage;

  factory WorkerStatusCenter.fromApiResponse(Map<String, dynamic> json) {
    final data = json["data"];
    final payload =
        data is Map<String, dynamic> ? data : const <String, dynamic>{};
    return WorkerStatusCenter.fromJson(payload);
  }

  factory WorkerStatusCenter.fromJson(Map<String, dynamic> json) {
    final summary = json["summary"] is Map<String, dynamic>
        ? json["summary"] as Map<String, dynamic>
        : const <String, dynamic>{};
    final rawTasks = json["tasks"];
    final rawProviderUsage = json["providerUsage"];
    return WorkerStatusCenter(
      title: summary["title"] as String? ?? "云端后台任务中心",
      statusLabel:
          summary["statusLabel"] as String? ?? "行情、标的资料和外部研究由后台任务统一管理。",
      nextRunLabel: summary["nextRunLabel"] as String? ?? "下一次运行时间待确认。",
      tasks: rawTasks is List
          ? rawTasks
              .whereType<Map<String, dynamic>>()
              .map(WorkerTaskStatus.fromJson)
              .toList()
          : const [],
      providerUsage: rawProviderUsage is List
          ? rawProviderUsage
              .whereType<Map<String, dynamic>>()
              .map(ProviderUsageItem.fromJson)
              .toList()
          : const [],
    );
  }
}

class WorkerTaskStatus {
  const WorkerTaskStatus({
    required this.id,
    required this.title,
    required this.status,
    required this.statusLabel,
    required this.note,
    required this.metricsLabel,
    required this.lastFinishedAt,
  });

  final String id;
  final String title;
  final String status;
  final String statusLabel;
  final String note;
  final String metricsLabel;
  final DateTime? lastFinishedAt;

  String get lastFinishedAtLabel {
    final value = lastFinishedAt;
    if (value == null) {
      return "最近运行时间未知";
    }
    final local = value.toLocal();
    String two(int number) => number.toString().padLeft(2, "0");
    return "${local.month}/${local.day} ${two(local.hour)}:${two(local.minute)}";
  }

  factory WorkerTaskStatus.fromJson(Map<String, dynamic> json) {
    final rawLastFinishedAt = json["lastFinishedAt"];
    return WorkerTaskStatus(
      id: json["id"] as String? ?? "unknown",
      title: json["title"] as String? ?? "后台任务",
      status: json["status"] as String? ?? "unknown",
      statusLabel: json["statusLabel"] as String? ?? "状态未知",
      note: json["note"] as String? ?? "暂无说明。",
      metricsLabel: json["metricsLabel"] as String? ?? "指标待确认",
      lastFinishedAt: rawLastFinishedAt is String
          ? DateTime.tryParse(rawLastFinishedAt)
          : null,
    );
  }
}

class ProviderUsageItem {
  const ProviderUsageItem({
    required this.provider,
    required this.endpoint,
    required this.usageDate,
    required this.requestCount,
    required this.successCount,
    required this.failureCount,
    required this.skippedCount,
    required this.quotaLimit,
    required this.label,
  });

  final String provider;
  final String endpoint;
  final String usageDate;
  final int requestCount;
  final int successCount;
  final int failureCount;
  final int skippedCount;
  final int? quotaLimit;
  final String label;

  String get compactLabel {
    final quota =
        quotaLimit != null && quotaLimit! > 0 ? " / 上限 $quotaLimit" : "";
    return "$provider：请求 $requestCount$quota，成功 $successCount，失败 $failureCount，跳过 $skippedCount";
  }

  factory ProviderUsageItem.fromJson(Map<String, dynamic> json) {
    return ProviderUsageItem(
      provider: json["provider"] as String? ?? "provider",
      endpoint: json["endpoint"] as String? ?? "unknown",
      usageDate: json["usageDate"] as String? ?? "",
      requestCount: json["requestCount"] as int? ?? 0,
      successCount: json["successCount"] as int? ?? 0,
      failureCount: json["failureCount"] as int? ?? 0,
      skippedCount: json["skippedCount"] as int? ?? 0,
      quotaLimit: json["quotaLimit"] as int?,
      label: json["label"] as String? ?? "暂无用量记录。",
    );
  }
}

class SecurityMetadataReviewSnapshot {
  const SecurityMetadataReviewSnapshot({
    required this.title,
    required this.statusLabel,
    required this.actionLabel,
    required this.totalCount,
    required this.manualCount,
    required this.lowConfidenceCount,
    required this.reviewCount,
    required this.items,
    required this.allItems,
  });

  final String title;
  final String statusLabel;
  final String actionLabel;
  final int totalCount;
  final int manualCount;
  final int lowConfidenceCount;
  final int reviewCount;
  final List<SecurityMetadataItem> items;
  final List<SecurityMetadataItem> allItems;

  factory SecurityMetadataReviewSnapshot.fromApiResponse(
      Map<String, dynamic> json) {
    final data = json["data"];
    final payload =
        data is Map<String, dynamic> ? data : const <String, dynamic>{};
    return SecurityMetadataReviewSnapshot.fromJson(payload);
  }

  factory SecurityMetadataReviewSnapshot.fromJson(Map<String, dynamic> json) {
    final summary = json["summary"] is Map<String, dynamic>
        ? json["summary"] as Map<String, dynamic>
        : const <String, dynamic>{};
    final rawItems = json["items"];
    return SecurityMetadataReviewSnapshot(
      title: summary["title"] as String? ?? "高级：标的资料可信度",
      statusLabel: summary["statusLabel"] as String? ?? "标的资料状态待确认。",
      actionLabel: summary["actionLabel"] as String? ?? "发现分类异常时可人工锁定。",
      totalCount: summary["totalCount"] as int? ?? 0,
      manualCount: summary["manualCount"] as int? ?? 0,
      lowConfidenceCount: summary["lowConfidenceCount"] as int? ?? 0,
      reviewCount: summary["reviewCount"] as int? ?? 0,
      items: rawItems is List
          ? rawItems
              .whereType<Map<String, dynamic>>()
              .map(SecurityMetadataItem.fromJson)
              .toList()
          : const [],
      allItems: json["allItems"] is List
          ? (json["allItems"] as List)
              .whereType<Map<String, dynamic>>()
              .map(SecurityMetadataItem.fromJson)
              .toList()
          : const [],
    );
  }
}

class SecurityMetadataItem {
  const SecurityMetadataItem({
    required this.securityId,
    required this.symbol,
    required this.name,
    required this.exchange,
    required this.currency,
    required this.securityType,
    required this.economicAssetClass,
    required this.economicSector,
    required this.exposureRegion,
    required this.metadataSource,
    required this.metadataSourceLabel,
    required this.metadataConfidence,
    required this.metadataConfidenceLabel,
    required this.metadataAsOfLabel,
    required this.metadataConfirmedAtLabel,
    required this.metadataNotes,
    required this.holdingCount,
    required this.locked,
    required this.statusLabel,
  });

  final String securityId;
  final String symbol;
  final String name;
  final String exchange;
  final String currency;
  final String? securityType;
  final String economicAssetClass;
  final String economicSector;
  final String exposureRegion;
  final String metadataSource;
  final String metadataSourceLabel;
  final int metadataConfidence;
  final String metadataConfidenceLabel;
  final String metadataAsOfLabel;
  final String? metadataConfirmedAtLabel;
  final String metadataNotes;
  final int holdingCount;
  final bool locked;
  final String statusLabel;

  String get identityLabel => "$symbol · $exchange · $currency";

  String get detailLabel {
    return [
      economicAssetClass,
      if (economicSector.isNotEmpty) economicSector,
      if (exposureRegion.isNotEmpty) exposureRegion,
      "$metadataSourceLabel $metadataConfidence 分",
    ].join(" · ");
  }

  factory SecurityMetadataItem.fromJson(Map<String, dynamic> json) {
    return SecurityMetadataItem(
      securityId: json["securityId"] as String? ?? "",
      symbol: json["symbol"] as String? ?? "--",
      name: json["name"] as String? ?? "未知标的",
      exchange: json["exchange"] as String? ?? "",
      currency: json["currency"] as String? ?? "",
      securityType: json["securityType"] as String?,
      economicAssetClass: json["economicAssetClass"] as String? ?? "待确认",
      economicSector: json["economicSector"] as String? ?? "",
      exposureRegion: json["exposureRegion"] as String? ?? "",
      metadataSource: json["metadataSource"] as String? ?? "heuristic",
      metadataSourceLabel: json["metadataSourceLabel"] as String? ?? "系统推断",
      metadataConfidence: json["metadataConfidence"] as int? ?? 45,
      metadataConfidenceLabel:
          json["metadataConfidenceLabel"] as String? ?? "待复核",
      metadataAsOfLabel: json["metadataAsOfLabel"] as String? ?? "时间未知",
      metadataConfirmedAtLabel: json["metadataConfirmedAtLabel"] as String?,
      metadataNotes: json["metadataNotes"] as String? ?? "",
      holdingCount: json["holdingCount"] as int? ?? 0,
      locked: json["locked"] == true,
      statusLabel: json["statusLabel"] as String? ?? "状态待确认",
    );
  }
}

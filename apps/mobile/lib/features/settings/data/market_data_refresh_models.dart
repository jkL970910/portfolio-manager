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
      latestManualStatusLabel:
          readSummaryString("latestManualStatusLabel") ??
              readSummaryString("latestStatusLabel") ??
              "还没有手动刷新记录",
      latestManualProviderStatusLabel:
          readSummaryString("latestManualProviderStatusLabel") ??
              readSummaryString("latestProviderStatusLabel") ??
              "尚未执行过手动行情刷新。",
      latestManualFxLabel:
          readSummaryString("latestManualFxLabel") ??
              readSummaryString("latestFxLabel"),
      latestManualFxFreshnessLabel:
          readSummaryString("latestManualFxFreshnessLabel") ??
              readSummaryString("latestFxFreshnessLabel"),
      items: rawItems is List
          ? rawItems
              .whereType<Map<String, dynamic>>()
              .map(MarketDataRefreshRunItem.fromJson)
              .toList()
          : const [],
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
      if (isSkippedWorker)
        "这是后台 worker 的预算保护跳过，不代表手动行情刷新失败。",
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

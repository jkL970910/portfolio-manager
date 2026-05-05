import "../../shared/data/mobile_models.dart";

class MobileDailyIntelligenceSnapshot {
  const MobileDailyIntelligenceSnapshot({
    required this.generatedAt,
    required this.disclaimer,
    required this.manualTriggerOnly,
    required this.scheduledOverviewEnabled,
    required this.securityManualRefreshEnabled,
    required this.items,
    required this.emptyTitle,
    required this.emptyDetail,
  });

  final String generatedAt;
  final String disclaimer;
  final bool manualTriggerOnly;
  final bool scheduledOverviewEnabled;
  final bool securityManualRefreshEnabled;
  final List<MobileDailyIntelligenceItem> items;
  final String emptyTitle;
  final String emptyDetail;

  factory MobileDailyIntelligenceSnapshot.fromJson(Map<String, dynamic> json) {
    final policy = json["policy"] is Map<String, dynamic>
        ? json["policy"] as Map<String, dynamic>
        : const <String, dynamic>{};
    final emptyState = json["emptyState"] is Map<String, dynamic>
        ? json["emptyState"] as Map<String, dynamic>
        : const <String, dynamic>{};

    return MobileDailyIntelligenceSnapshot(
      generatedAt: json["generatedAt"] as String? ?? "",
      disclaimer: policy["disclaimer"] as String? ??
          "Loo国今日秘闻只展示已缓存资料；页面加载不会触发实时外部 API。",
      manualTriggerOnly: policy["manualTriggerOnly"] as bool? ?? true,
      scheduledOverviewEnabled:
          policy["scheduledOverviewEnabled"] as bool? ?? false,
      securityManualRefreshEnabled:
          policy["securityManualRefreshEnabled"] as bool? ?? true,
      items: readJsonList(json, "items")
          .map(MobileDailyIntelligenceItem.fromJson)
          .toList(),
      emptyTitle: emptyState["title"] as String? ?? "暂时没有可用秘闻",
      emptyDetail:
          emptyState["detail"] as String? ?? "先运行 AI 快扫或缓存外部研究，系统不会自动抓取新闻或论坛。",
    );
  }
}

class MobileDailyIntelligenceItem {
  const MobileDailyIntelligenceItem({
    required this.id,
    required this.title,
    required this.summary,
    required this.sourceLabel,
    required this.sourceType,
    required this.sourceMode,
    required this.confidenceLabel,
    required this.freshnessLabel,
    required this.relevanceLabel,
    required this.generatedAt,
    required this.expiresAt,
    required this.identity,
    required this.reason,
    required this.keyPoints,
    required this.riskFlags,
    required this.actions,
    required this.sources,
  });

  final String id;
  final String title;
  final String summary;
  final String sourceLabel;
  final String sourceType;
  final String sourceMode;
  final String confidenceLabel;
  final String freshnessLabel;
  final String relevanceLabel;
  final String generatedAt;
  final String? expiresAt;
  final MobileDailyIntelligenceIdentity identity;
  final String reason;
  final List<String> keyPoints;
  final List<String> riskFlags;
  final List<MobileDailyIntelligenceAction> actions;
  final List<MobileDailyIntelligenceSource> sources;

  bool get canOpenSecurity => identity.symbol.isNotEmpty;

  String get identityLabel {
    final parts = [
      identity.symbol,
      identity.exchange,
      identity.currency,
    ].where((part) => part.isNotEmpty).toList();
    return parts.isEmpty ? "组合级情报" : parts.join(" · ");
  }

  factory MobileDailyIntelligenceItem.fromJson(Map<String, dynamic> json) {
    return MobileDailyIntelligenceItem(
      id: json["id"] as String? ?? "",
      title: json["title"] as String? ?? "Loo国秘闻",
      summary: json["summary"] as String? ?? "",
      sourceLabel: json["sourceLabel"] as String? ?? "缓存情报",
      sourceType: json["sourceType"] as String? ?? "analysis",
      sourceMode: json["sourceMode"] as String? ?? "local",
      confidenceLabel: json["confidenceLabel"] as String? ?? "可信度待校准",
      freshnessLabel: json["freshnessLabel"] as String? ?? "新鲜度待校准",
      relevanceLabel: json["relevanceLabel"] as String? ?? "相关度待校准",
      generatedAt: json["generatedAt"] as String? ?? "",
      expiresAt: json["expiresAt"] as String?,
      identity: MobileDailyIntelligenceIdentity.fromJson(json["identity"]),
      reason: json["reason"] as String? ?? "",
      keyPoints: (json["keyPoints"] as List?)?.whereType<String>().toList() ??
          const [],
      riskFlags: (json["riskFlags"] as List?)?.whereType<String>().toList() ??
          const [],
      actions: readJsonList(json, "actions")
          .map(MobileDailyIntelligenceAction.fromJson)
          .toList(),
      sources: readJsonList(json, "sources")
          .map(MobileDailyIntelligenceSource.fromJson)
          .toList(),
    );
  }
}

class MobileDailyIntelligenceIdentity {
  const MobileDailyIntelligenceIdentity({
    required this.securityId,
    required this.symbol,
    required this.exchange,
    required this.currency,
    required this.underlyingId,
  });

  final String securityId;
  final String symbol;
  final String exchange;
  final String currency;
  final String underlyingId;

  factory MobileDailyIntelligenceIdentity.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileDailyIntelligenceIdentity(
      securityId: json["securityId"] as String? ?? "",
      symbol: json["symbol"] as String? ?? "",
      exchange: json["exchange"] as String? ?? "",
      currency: json["currency"] as String? ?? "",
      underlyingId: json["underlyingId"] as String? ?? "",
    );
  }
}

class MobileDailyIntelligenceAction {
  const MobileDailyIntelligenceAction({
    required this.label,
    required this.type,
    required this.payload,
  });

  final String label;
  final String type;
  final Map<String, String> payload;

  factory MobileDailyIntelligenceAction.fromJson(Map<String, dynamic> json) {
    final rawPayload = json["payload"];
    final payload = rawPayload is Map<String, dynamic>
        ? rawPayload.map((key, value) => MapEntry(key, value.toString()))
        : const <String, String>{};
    return MobileDailyIntelligenceAction(
      label: json["label"] as String? ?? "",
      type: json["type"] as String? ?? "",
      payload: payload,
    );
  }
}

class MobileDailyIntelligenceSource {
  const MobileDailyIntelligenceSource({
    required this.title,
    required this.sourceType,
    required this.date,
    required this.url,
  });

  final String title;
  final String sourceType;
  final String date;
  final String url;

  String get label {
    return [
      title,
      if (date.isNotEmpty) date,
    ].join(" · ");
  }

  factory MobileDailyIntelligenceSource.fromJson(Map<String, dynamic> json) {
    return MobileDailyIntelligenceSource(
      title: json["title"] as String? ?? "来源",
      sourceType: json["sourceType"] as String? ?? "source",
      date: json["date"] as String? ?? "",
      url: json["url"] as String? ?? "",
    );
  }
}

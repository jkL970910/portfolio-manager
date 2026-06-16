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
          "Loo国今日秘闻只展示已准备好的每日资料；页面加载不会临时抓取新闻。",
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
          emptyState["detail"] as String? ?? "今日还没有生成秘闻；请稍后刷新或手动运行每日更新。",
    );
  }
}

class MobileDailyIntelligenceAiSummary {
  const MobileDailyIntelligenceAiSummary({
    required this.itemId,
    required this.generatedAt,
    required this.headline,
    required this.coreSummary,
    required this.sourceSummary,
    required this.affectedSectors,
    required this.affectedSecurities,
    required this.relatedFields,
    required this.affectedHoldings,
    required this.portfolioImpact,
    required this.watchPoints,
    required this.cached,
    required this.expiresAt,
  });

  final String itemId;
  final String generatedAt;
  final String headline;
  final String coreSummary;
  final String sourceSummary;
  final List<MobileDailyIntelligenceImpactEntry> affectedSectors;
  final List<MobileDailyIntelligenceImpactEntry> affectedSecurities;
  final List<String> relatedFields;
  final List<MobileDailyIntelligenceAffectedHolding> affectedHoldings;
  final String portfolioImpact;
  final List<String> watchPoints;
  final bool cached;
  final String expiresAt;

  factory MobileDailyIntelligenceAiSummary.fromJson(Map<String, dynamic> json) {
    return MobileDailyIntelligenceAiSummary(
      itemId: json["itemId"] as String? ?? "",
      generatedAt: json["generatedAt"] as String? ?? "",
      headline: json["headline"] as String? ?? "Loo皇总结",
      coreSummary: json["coreSummary"] as String? ?? "",
      sourceSummary: json["sourceSummary"] as String? ??
          json["coreSummary"] as String? ??
          "",
      affectedSectors: readJsonList(json, "affectedSectors")
          .map(MobileDailyIntelligenceImpactEntry.fromJson)
          .toList(),
      affectedSecurities: readJsonList(json, "affectedSecurities")
          .map(MobileDailyIntelligenceImpactEntry.fromJson)
          .toList(),
      relatedFields:
          (json["relatedFields"] as List?)?.whereType<String>().toList() ??
              const [],
      affectedHoldings: readJsonList(json, "affectedHoldings")
          .map(MobileDailyIntelligenceAffectedHolding.fromJson)
          .toList(),
      portfolioImpact: json["portfolioImpact"] as String? ?? "",
      watchPoints:
          (json["watchPoints"] as List?)?.whereType<String>().toList() ??
              const [],
      cached: json["cached"] as bool? ?? false,
      expiresAt: json["expiresAt"] as String? ?? "",
    );
  }
}

class MobileDailyIntelligenceImpactEntry {
  const MobileDailyIntelligenceImpactEntry({
    required this.label,
    required this.reason,
  });

  final String label;
  final String reason;

  factory MobileDailyIntelligenceImpactEntry.fromJson(
      Map<String, dynamic> json) {
    return MobileDailyIntelligenceImpactEntry(
      label: json["label"] as String? ?? "",
      reason: json["reason"] as String? ?? "",
    );
  }
}

class MobileDailyIntelligenceAffectedHolding {
  const MobileDailyIntelligenceAffectedHolding({
    required this.symbol,
    required this.reason,
  });

  final String symbol;
  final String reason;

  factory MobileDailyIntelligenceAffectedHolding.fromJson(
      Map<String, dynamic> json) {
    return MobileDailyIntelligenceAffectedHolding(
      symbol: json["symbol"] as String? ?? "",
      reason: json["reason"] as String? ?? "",
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

  String get displayTypeLabel {
    if (sourceType == "market-sentiment") {
      return "市场脉搏";
    }
    if (sourceType == "institutional") {
      final normalizedTitle = title.toLowerCase();
      if (normalizedTitle.contains("财报") ||
          normalizedTitle.contains("earnings")) {
        return "财报资料";
      }
      return "标的资料";
    }
    if (sourceType == "analysis") {
      return "AI分析";
    }
    if (sourceType == "market-data") {
      return "行情资料";
    }
    if (sourceType == "news") {
      return "新闻公告";
    }
    return "外部资料";
  }

  String get identityLabel {
    final parts = [
      identity.symbol,
      identity.exchange,
      identity.currency,
    ].where((part) => part.isNotEmpty).toList();
    return parts.isEmpty ? "组合级情报" : parts.join(" · ");
  }

  String get compactFreshnessLabel {
    final parts = freshnessLabel
        .split("·")
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .toList();
    if (parts.isEmpty) {
      return "";
    }
    return parts.first;
  }

  String get compactMetaLabel {
    final parts = [
      identityLabel,
      compactFreshnessLabel,
    ].where((part) => part.isNotEmpty).toList();
    return parts.join(" · ");
  }

  List<String> get visibleRiskFlags {
    return riskFlags.where((risk) {
      final normalized = risk.toLowerCase();
      return !normalized.contains("不代表实时买卖建议") &&
          !normalized.contains("not investment advice") &&
          !normalized.contains("只说明") &&
          !normalized.contains("需要结合持仓");
    }).toList();
  }

  String get primarySourceUrl {
    for (final source in sources) {
      if (source.url.isNotEmpty) {
        return source.url;
      }
    }
    return "";
  }

  String get primarySourceLabel {
    if (sources.isEmpty) {
      return sourceLabel;
    }
    return sources.first.label;
  }

  String get cleanedTitle {
    final trimmed = title.trim();
    final source = primarySourceLabel.trim();
    if (source.isEmpty) {
      return trimmed;
    }
    return _stripRepeatedPrefix(trimmed, source);
  }

  String get subtitleLabel {
    final labels = <String>[
      displayTypeLabel,
      identity.symbol,
    ].map((value) => value.trim()).where((value) => value.isNotEmpty).toList();
    final deduped = <String>[];
    for (final label in labels) {
      if (!deduped.any((existing) => _sameLooseLabel(existing, label))) {
        deduped.add(label);
      }
    }
    return deduped.join(" · ");
  }

  static String _stripRepeatedPrefix(String value, String prefix) {
    var result = value;
    while (true) {
      final normalizedValue = _normalizeLooseLabel(result);
      final normalizedPrefix = _normalizeLooseLabel(prefix);
      if (normalizedPrefix.isEmpty ||
          !normalizedValue.startsWith(normalizedPrefix)) {
        break;
      }
      result = result.substring(prefix.length).trimLeft();
      result = result.replaceFirst(RegExp(r"^[-–—:：·\s]+"), "").trimLeft();
      if (result.isEmpty) {
        return value;
      }
    }
    return result;
  }

  static bool _sameLooseLabel(String a, String b) {
    return _normalizeLooseLabel(a) == _normalizeLooseLabel(b);
  }

  static String _normalizeLooseLabel(String value) {
    return value
        .toLowerCase()
        .replaceAll(RegExp(r"[^a-z0-9\u4e00-\u9fa5]+"), "");
  }

  factory MobileDailyIntelligenceItem.fromJson(Map<String, dynamic> json) {
    return MobileDailyIntelligenceItem(
      id: json["id"] as String? ?? "",
      title: json["title"] as String? ?? "Loo国秘闻",
      summary: json["summary"] as String? ?? "",
      sourceLabel: json["sourceLabel"] as String? ?? "每日资料",
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

class MobileMetric {
  const MobileMetric({
    required this.label,
    required this.value,
    required this.detail,
  });

  final String label;
  final String value;
  final String detail;

  factory MobileMetric.fromJson(Map<String, dynamic> json) {
    return MobileMetric(
      label: json["label"] as String? ?? "未知指标",
      value: json["value"] as String? ?? "--",
      detail: json["detail"] as String? ?? "",
    );
  }
}

class MobileAccountCard {
  const MobileAccountCard({
    required this.id,
    required this.name,
    required this.value,
    required this.detail,
    required this.typeId,
  });

  final String id;
  final String name;
  final String value;
  final String detail;
  final String typeId;

  factory MobileAccountCard.fromJson(Map<String, dynamic> json) {
    return MobileAccountCard(
      id: json["id"] as String? ?? "",
      name: json["name"] as String? ?? "未知账户",
      value: json["value"] as String? ?? "--",
      detail: (json["caption"] as String?) ??
          (json["typeLabel"] as String?) ??
          (json["institution"] as String?) ??
          "",
      typeId: json["typeId"] as String? ?? "",
    );
  }
}

class MobileHoldingCard {
  const MobileHoldingCard({
    required this.id,
    required this.symbol,
    required this.name,
    required this.value,
    required this.detail,
    required this.accountType,
  });

  final String id;
  final String symbol;
  final String name;
  final String value;
  final String detail;
  final String accountType;

  factory MobileHoldingCard.fromJson(Map<String, dynamic> json) {
    final symbol = json["symbol"] as String? ?? "--";
    final account = json["account"] as String? ?? "";
    final weight =
        json["weight"] as String? ?? json["portfolioShare"] as String? ?? "";

    return MobileHoldingCard(
      id: json["id"] as String? ?? symbol,
      symbol: symbol,
      name: json["name"] as String? ?? "未知标的",
      value: json["value"] as String? ?? "--",
      detail: [account, weight].where((item) => item.isNotEmpty).join(" · "),
      accountType: json["accountType"] as String? ?? "",
    );
  }
}

class MobileFact {
  const MobileFact({
    required this.label,
    required this.value,
    required this.detail,
  });

  final String label;
  final String value;
  final String detail;

  factory MobileFact.fromJson(Map<String, dynamic> json) {
    return MobileFact(
      label: json["label"] as String? ?? "未知事实",
      value: json["value"] as String? ?? "--",
      detail: json["detail"] as String? ?? "",
    );
  }
}

class MobileFxContext {
  const MobileFxContext({
    required this.label,
    required this.note,
    required this.asOf,
    required this.source,
    required this.freshness,
  });

  final String label;
  final String note;
  final String? asOf;
  final String source;
  final String freshness;

  bool get hasContent => label.isNotEmpty || note.isNotEmpty;

  String get statusLabel {
    return switch (freshness) {
      "fresh" => "最新",
      "stale" => "可能过期",
      "fallback" => "保守兜底",
      _ => "未知",
    };
  }

  factory MobileFxContext.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileFxContext(
      label: json["fxRateLabel"] as String? ?? "",
      note: json["fxNote"] as String? ?? "",
      asOf: json["fxAsOf"] as String?,
      source: json["fxSource"] as String? ?? "",
      freshness: json["fxFreshness"] as String? ?? "fallback",
    );
  }
}

List<Map<String, dynamic>> readJsonList(Map<String, dynamic> json, String key) {
  final value = json[key];
  if (value is! List) {
    return const [];
  }

  return value.whereType<Map<String, dynamic>>().toList();
}

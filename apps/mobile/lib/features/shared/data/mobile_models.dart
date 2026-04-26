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
  });

  final String id;
  final String name;
  final String value;
  final String detail;

  factory MobileAccountCard.fromJson(Map<String, dynamic> json) {
    return MobileAccountCard(
      id: json["id"] as String? ?? "",
      name: json["name"] as String? ?? "未知账户",
      value: json["value"] as String? ?? "--",
      detail: (json["caption"] as String?) ??
          (json["typeLabel"] as String?) ??
          (json["institution"] as String?) ??
          "",
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
  });

  final String id;
  final String symbol;
  final String name;
  final String value;
  final String detail;

  factory MobileHoldingCard.fromJson(Map<String, dynamic> json) {
    final symbol = json["symbol"] as String? ?? "--";
    final account = json["account"] as String? ?? "";
    final weight = json["weight"] as String? ?? json["portfolioShare"] as String? ?? "";

    return MobileHoldingCard(
      id: json["id"] as String? ?? symbol,
      symbol: symbol,
      name: json["name"] as String? ?? "未知标的",
      value: json["value"] as String? ?? "--",
      detail: [account, weight].where((item) => item.isNotEmpty).join(" · "),
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

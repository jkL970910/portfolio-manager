class MobileChartPoint {
  const MobileChartPoint({
    required this.label,
    required this.value,
    required this.displayValue,
    required this.rawDate,
  });

  final String label;
  final double value;
  final String displayValue;
  final String? rawDate;

  factory MobileChartPoint.fromJson(Map<String, dynamic> json) {
    final rawValue = json["value"];
    return MobileChartPoint(
      label: json["displayLabel"] as String? ??
          json["rawDate"] as String? ??
          "未知日期",
      value: rawValue is num ? rawValue.toDouble() : 0,
      displayValue:
          json["displayValue"] as String? ?? rawValue?.toString() ?? "--",
      rawDate: json["rawDate"] as String?,
    );
  }
}

class MobileChartSeries {
  const MobileChartSeries({
    required this.title,
    required this.valueType,
    required this.sourceMode,
    required this.freshness,
    required this.points,
    required this.notes,
  });

  final String title;
  final String valueType;
  final String sourceMode;
  final MobileChartFreshness freshness;
  final List<MobileChartPoint> points;
  final List<String> notes;

  static MobileChartSeries? fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    final rawPoints = json["points"];
    final points = rawPoints is List
        ? rawPoints
            .whereType<Map<String, dynamic>>()
            .map(MobileChartPoint.fromJson)
            .toList()
        : const <MobileChartPoint>[];

    if (points.length < 2) return null;

    return MobileChartSeries(
      title: json["title"] as String? ?? "走势",
      valueType: json["valueType"] as String? ?? "index",
      sourceMode: json["sourceMode"] as String? ?? "local",
      freshness: MobileChartFreshness.fromJson(json["freshness"]),
      points: points,
      notes: (json["notes"] as List?)?.whereType<String>().toList() ?? const [],
    );
  }
}

class MobileChartFreshness {
  const MobileChartFreshness({
    required this.status,
    required this.label,
    required this.latestDate,
    required this.detail,
  });

  final String status;
  final String label;
  final String? latestDate;
  final String detail;

  factory MobileChartFreshness.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileChartFreshness(
      status: json["status"] as String? ?? "fallback",
      label: json["label"] as String? ?? "参考曲线",
      latestDate: json["latestDate"] as String?,
      detail: json["detail"] as String? ?? "请确认数据来源和更新时间。",
    );
  }
}

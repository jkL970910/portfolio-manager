class MobileOnboardingState {
  const MobileOnboardingState({
    required this.version,
    required this.skippedAll,
    required this.completed,
    required this.progress,
    required this.checklist,
    required this.coachMarks,
    required this.autoCompleted,
    this.completedAt,
    this.lastPromptedAt,
  });

  final String version;
  final bool skippedAll;
  final bool completed;
  final MobileOnboardingProgress progress;
  final Map<String, String> checklist;
  final Map<String, String> coachMarks;
  final List<String> autoCompleted;
  final String? completedAt;
  final String? lastPromptedAt;

  bool get shouldShowChecklist => !completed && !skippedAll;

  String statusFor(String key) => checklist[key] ?? "pending";

  String coachStatusFor(String key) => coachMarks[key] ?? "pending";

  factory MobileOnboardingState.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileOnboardingState(
      version: json["version"] as String? ?? "mvp-2026-05",
      skippedAll: json["skippedAll"] as bool? ?? false,
      completed: json["completed"] as bool? ?? false,
      progress: MobileOnboardingProgress.fromJson(json["progress"]),
      checklist: _stringMap(json["checklist"]),
      coachMarks: _stringMap(json["coachMarks"]),
      autoCompleted:
          (json["autoCompleted"] as List?)?.whereType<String>().toList() ??
              const [],
      completedAt: json["completedAt"] as String?,
      lastPromptedAt: json["lastPromptedAt"] as String?,
    );
  }
}

class MobileOnboardingProgress {
  const MobileOnboardingProgress({
    required this.completed,
    required this.total,
    required this.percent,
  });

  final int completed;
  final int total;
  final int percent;

  factory MobileOnboardingProgress.fromJson(Object? value) {
    final json =
        value is Map<String, dynamic> ? value : const <String, dynamic>{};
    return MobileOnboardingProgress(
      completed: (json["completed"] as num?)?.toInt() ?? 0,
      total: (json["total"] as num?)?.toInt() ?? 6,
      percent: (json["percent"] as num?)?.toInt() ?? 0,
    );
  }
}

Map<String, String> _stringMap(Object? value) {
  if (value is! Map<String, dynamic>) {
    return const {};
  }
  return value.map(
    (key, rawValue) => MapEntry(key, rawValue is String ? rawValue : "pending"),
  );
}

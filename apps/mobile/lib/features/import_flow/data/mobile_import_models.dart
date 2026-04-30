import "../../shared/data/mobile_models.dart";

class MobileImportSnapshot {
  const MobileImportSnapshot({
    required this.manualSteps,
    required this.actionCards,
    required this.accounts,
    required this.notes,
  });

  final List<MobileImportStep> manualSteps;
  final List<MobileImportAction> actionCards;
  final List<MobileImportAccount> accounts;
  final List<String> notes;

  factory MobileImportSnapshot.fromJson(Map<String, dynamic> json) {
    return MobileImportSnapshot(
      manualSteps: readJsonList(json, "manualSteps")
          .map(MobileImportStep.fromJson)
          .toList(),
      actionCards: readJsonList(json, "actionCards")
          .map(MobileImportAction.fromJson)
          .toList(),
      accounts: readJsonList(json, "existingAccounts")
          .map(MobileImportAccount.fromJson)
          .toList(),
      notes: (json["notes"] as List?)?.whereType<String>().toList() ?? const [],
    );
  }
}

class MobileImportStep {
  const MobileImportStep({
    required this.title,
    required this.description,
  });

  final String title;
  final String description;

  factory MobileImportStep.fromJson(Map<String, dynamic> json) {
    return MobileImportStep(
      title: json["title"] as String? ?? "导入步骤",
      description: json["description"] as String? ?? "",
    );
  }
}

class MobileImportAction {
  const MobileImportAction({
    required this.label,
    required this.title,
    required this.description,
  });

  final String label;
  final String title;
  final String description;

  factory MobileImportAction.fromJson(Map<String, dynamic> json) {
    return MobileImportAction(
      label: json["label"] as String? ?? "入口",
      title: json["title"] as String? ?? "手动导入",
      description: json["description"] as String? ?? "",
    );
  }
}

class MobileImportAccount {
  const MobileImportAccount({
    required this.id,
    required this.displayName,
    required this.value,
    required this.detail,
  });

  final String id;
  final String displayName;
  final String value;
  final String detail;

  factory MobileImportAccount.fromJson(Map<String, dynamic> json) {
    return MobileImportAccount(
      id: json["id"] as String? ?? "",
      displayName: json["displayName"] as String? ??
          json["nickname"] as String? ??
          "未知账户",
      value: json["value"] as String? ?? "--",
      detail: json["detail"] as String? ?? "",
    );
  }
}

class MobileSecurityCandidate {
  const MobileSecurityCandidate({
    required this.symbol,
    required this.name,
    required this.type,
    this.exchange,
    this.currency,
    this.country,
  });

  final String symbol;
  final String name;
  final String type;
  final String? exchange;
  final String? currency;
  final String? country;

  factory MobileSecurityCandidate.fromJson(Map<String, dynamic> json) {
    return MobileSecurityCandidate(
      symbol: json["symbol"] as String? ?? "--",
      name: json["name"] as String? ?? "未知标的",
      type: json["type"] as String? ?? "Unknown",
      exchange: json["exchange"] as String?,
      currency: json["currency"] as String?,
      country: json["country"] as String?,
    );
  }
}

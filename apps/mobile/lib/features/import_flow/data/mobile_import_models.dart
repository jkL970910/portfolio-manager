import "../../shared/data/mobile_models.dart";

class MobileImportSnapshot {
  const MobileImportSnapshot({
    required this.manualSteps,
    required this.actionCards,
    required this.brokerageProviders,
    required this.accounts,
    required this.notes,
  });

  final List<MobileImportStep> manualSteps;
  final List<MobileImportAction> actionCards;
  final List<MobileBrokerageProvider> brokerageProviders;
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
      brokerageProviders: readJsonList(json, "brokerageProviders")
          .map(MobileBrokerageProvider.fromJson)
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

class MobileBrokerageProvider {
  const MobileBrokerageProvider({
    required this.id,
    required this.name,
    required this.status,
    required this.statusLabel,
    required this.description,
    required this.primaryUse,
    required this.setupItems,
    required this.limitations,
  });

  final String id;
  final String name;
  final String status;
  final String statusLabel;
  final String description;
  final String primaryUse;
  final List<String> setupItems;
  final List<String> limitations;

  factory MobileBrokerageProvider.fromJson(Map<String, dynamic> json) {
    return MobileBrokerageProvider(
      id: json["id"] as String? ?? "",
      name: json["name"] as String? ?? "券商导入",
      status: json["status"] as String? ?? "feasibility-check",
      statusLabel: json["statusLabel"] as String? ?? "待验证",
      description: json["description"] as String? ?? "",
      primaryUse: json["primaryUse"] as String? ?? "",
      setupItems: (json["setupItems"] as List?)?.whereType<String>().toList() ??
          const [],
      limitations:
          (json["limitations"] as List?)?.whereType<String>().toList() ??
              const [],
    );
  }
}

class MobileImportAccount {
  const MobileImportAccount({
    required this.id,
    required this.displayName,
    required this.value,
    required this.detail,
    required this.holdingCount,
  });

  final String id;
  final String displayName;
  final String value;
  final String detail;
  final int holdingCount;

  factory MobileImportAccount.fromJson(Map<String, dynamic> json) {
    return MobileImportAccount(
      id: json["id"] as String? ?? "",
      displayName: json["displayName"] as String? ??
          json["nickname"] as String? ??
          "未知账户",
      value: json["value"] as String? ?? "--",
      detail: json["detail"] as String? ?? "",
      holdingCount: (json["holdingCount"] as num?)?.toInt() ?? 0,
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

class MobileIbkrFlexPreview {
  const MobileIbkrFlexPreview({
    required this.draftId,
    required this.accountCount,
    required this.holdingCount,
    required this.title,
    required this.subtitle,
    required this.warnings,
    required this.accounts,
  });

  final String draftId;
  final int accountCount;
  final int holdingCount;
  final String title;
  final String subtitle;
  final List<String> warnings;
  final List<MobileIbkrFlexAccount> accounts;

  factory MobileIbkrFlexPreview.fromJson(Map<String, dynamic> json) {
    final summary = json["summary"] is Map<String, dynamic>
        ? json["summary"] as Map<String, dynamic>
        : const <String, dynamic>{};
    return MobileIbkrFlexPreview(
      draftId: json["draftId"] as String? ?? "",
      accountCount: (json["accountCount"] as num?)?.toInt() ?? 0,
      holdingCount: (json["holdingCount"] as num?)?.toInt() ?? 0,
      title: summary["title"] as String? ?? "IBKR 预览",
      subtitle: summary["subtitle"] as String? ?? "",
      warnings: (summary["warnings"] as List?)?.whereType<String>().toList() ??
          const [],
      accounts: readJsonList(json, "accounts")
          .map(MobileIbkrFlexAccount.fromJson)
          .toList(),
    );
  }

  List<MobileIbkrFlexAccount> get importableAccounts =>
      accounts.where((account) => account.hasImportableHoldings).toList();

  List<MobileIbkrFlexAccount> get readyAccounts => importableAccounts;

  List<MobileIbkrFlexAccount> get reviewAccounts =>
      accounts.where((account) => !account.isReady).toList();
}

class MobileSnapTradePortal {
  const MobileSnapTradePortal({
    required this.redirectUri,
    this.sessionId,
  });

  final String redirectUri;
  final String? sessionId;

  factory MobileSnapTradePortal.fromJson(Map<String, dynamic> json) {
    return MobileSnapTradePortal(
      redirectUri: json["redirectUri"] as String? ?? "",
      sessionId: json["sessionId"] as String?,
    );
  }
}

class MobileBrokerageConnection {
  const MobileBrokerageConnection({
    required this.id,
    required this.provider,
    required this.displayName,
    required this.status,
    required this.queryId,
    required this.tokenLast4,
    required this.tokenExpiresAt,
    required this.autoSyncEnabled,
    required this.lastSyncedAt,
    required this.lastSyncStatus,
    required this.lastSyncError,
    required this.lastDraftId,
  });

  final String id;
  final String provider;
  final String displayName;
  final String status;
  final String queryId;
  final String? tokenLast4;
  final String tokenExpiresAt;
  final bool autoSyncEnabled;
  final String? lastSyncedAt;
  final String? lastSyncStatus;
  final String? lastSyncError;
  final String? lastDraftId;

  factory MobileBrokerageConnection.fromJson(Map<String, dynamic> json) {
    return MobileBrokerageConnection(
      id: json["id"] as String? ?? "",
      provider: json["provider"] as String? ?? "ibkr-flex",
      displayName: json["displayName"] as String? ?? "IBKR Flex",
      status: json["status"] as String? ?? "active",
      queryId: json["queryId"] as String? ?? "",
      tokenLast4: json["tokenLast4"] as String?,
      tokenExpiresAt: json["tokenExpiresAt"] as String? ?? "",
      autoSyncEnabled: json["autoSyncEnabled"] as bool? ?? false,
      lastSyncedAt: json["lastSyncedAt"] as String?,
      lastSyncStatus: json["lastSyncStatus"] as String?,
      lastSyncError: json["lastSyncError"] as String?,
      lastDraftId: json["lastDraftId"] as String?,
    );
  }

  bool get isUsable => status == "active";
}

class MobileIbkrFlexAccount {
  const MobileIbkrFlexAccount({
    required this.accountId,
    required this.accountType,
    required this.currency,
    required this.netLiquidation,
    required this.cash,
    required this.holdings,
  });

  final String accountId;
  final String accountType;
  final String currency;
  final num? netLiquidation;
  final num? cash;
  final List<MobileIbkrFlexHolding> holdings;

  factory MobileIbkrFlexAccount.fromJson(Map<String, dynamic> json) {
    return MobileIbkrFlexAccount(
      accountId: json["accountId"] as String? ?? "IBKR",
      accountType: json["accountType"] as String? ?? "IBKR",
      currency: json["currency"] as String? ?? "CAD",
      netLiquidation: json["netLiquidation"] as num?,
      cash: json["cash"] as num?,
      holdings: readJsonList(json, "holdings")
          .map(MobileIbkrFlexHolding.fromJson)
          .toList(),
    );
  }

  bool get isReady =>
      holdings.every((holding) => holding.isImportable);

  bool get hasImportableHoldings =>
      holdings.any((holding) => holding.isImportable);

  bool get hasWritableHoldings => hasImportableHoldings;

  int get reviewHoldingCount =>
      holdings.where((holding) => !holding.isImportable).length;
}

class MobileIbkrFlexHolding {
  const MobileIbkrFlexHolding({
    required this.symbol,
    required this.description,
    required this.currency,
    required this.quantity,
    required this.price,
    required this.marketValue,
    required this.assetCategory,
    required this.exchange,
    required this.identityStatus,
    required this.warnings,
  });

  final String symbol;
  final String description;
  final String currency;
  final num quantity;
  final num? price;
  final num? marketValue;
  final String assetCategory;
  final String? exchange;
  final String identityStatus;
  final List<String> warnings;

  factory MobileIbkrFlexHolding.fromJson(Map<String, dynamic> json) {
    return MobileIbkrFlexHolding(
      symbol: json["symbol"] as String? ?? "--",
      description: json["description"] as String? ?? "",
      currency: json["currency"] as String? ?? "CAD",
      quantity: json["quantity"] as num? ?? 0,
      price: json["price"] as num?,
      marketValue: json["marketValue"] as num?,
      assetCategory: json["assetCategory"] as String? ?? "Unknown",
      exchange: json["exchange"] as String?,
      identityStatus: json["identityStatus"] as String? ?? "needs_review",
      warnings:
          (json["warnings"] as List?)?.whereType<String>().toList() ?? const [],
    );
  }

  bool get isImportable =>
      identityStatus == "ready" || identityStatus == "other_asset";

  bool get isOtherAssetCandidate {
    final text = "$symbol $description $assetCategory".toLowerCase();
    return assetCategory.toUpperCase() == "OTHER" ||
        assetCategory.toUpperCase() == "METAL" ||
        text.contains("gold") ||
        text.contains("precious") ||
        text.contains("bullion");
  }
}

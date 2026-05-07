const looMinisterContextVersion = "0.1";

class LooMinisterSecurityIdentity {
  const LooMinisterSecurityIdentity({
    required this.symbol,
    this.securityId,
    this.exchange,
    this.currency,
    this.name,
    this.provider,
    this.securityType,
  });

  final String symbol;
  final String? securityId;
  final String? exchange;
  final String? currency;
  final String? name;
  final String? provider;
  final String? securityType;

  bool get hasCompleteListingIdentity {
    final hasExchange = exchange != null && exchange!.isNotEmpty;
    final hasCurrency = currency == "CAD" || currency == "USD";
    return hasExchange == hasCurrency;
  }

  Map<String, dynamic> toJson() {
    return {
      if (securityId != null && securityId!.isNotEmpty)
        "securityId": securityId,
      "symbol": symbol,
      if (exchange != null && exchange!.isNotEmpty) "exchange": exchange,
      if (currency != null && currency!.isNotEmpty) "currency": currency,
      if (name != null && name!.isNotEmpty) "name": name,
      if (provider != null && provider!.isNotEmpty) "provider": provider,
      if (securityType != null && securityType!.isNotEmpty)
        "securityType": securityType,
    };
  }
}

class LooMinisterFact {
  const LooMinisterFact({
    required this.id,
    required this.label,
    required this.value,
    this.detail,
    this.source = "portfolio-data",
  });

  final String id;
  final String label;
  final String value;
  final String? detail;
  final String source;

  Map<String, dynamic> toJson() {
    return {
      "id": id,
      "label": label,
      "value": value,
      if (detail != null && detail!.isNotEmpty) "detail": detail,
      "source": source,
    };
  }
}

class LooMinisterDataFreshness {
  const LooMinisterDataFreshness({
    this.portfolioAsOf,
    this.quotesAsOf,
    this.fxAsOf,
    this.chartFreshness = "unknown",
    this.sourceMode = "local",
  });

  final String? portfolioAsOf;
  final String? quotesAsOf;
  final String? fxAsOf;
  final String chartFreshness;
  final String sourceMode;

  bool get isHonestReferenceState {
    return !(sourceMode == "local" && chartFreshness == "reference");
  }

  Map<String, dynamic> toJson() {
    return {
      "portfolioAsOf": portfolioAsOf,
      "quotesAsOf": quotesAsOf,
      "fxAsOf": fxAsOf,
      "chartFreshness": chartFreshness,
      "sourceMode": sourceMode,
    };
  }
}

class LooMinisterSubject {
  const LooMinisterSubject({
    this.accountId,
    this.holdingId,
    this.recommendationRunId,
    this.security,
  });

  final String? accountId;
  final String? holdingId;
  final String? recommendationRunId;
  final LooMinisterSecurityIdentity? security;

  Map<String, dynamic> toJson() {
    return {
      if (accountId != null && accountId!.isNotEmpty) "accountId": accountId,
      if (holdingId != null && holdingId!.isNotEmpty) "holdingId": holdingId,
      if (recommendationRunId != null && recommendationRunId!.isNotEmpty)
        "recommendationRunId": recommendationRunId,
      if (security != null) "security": security!.toJson(),
    };
  }
}

class LooMinisterRecentSubject {
  const LooMinisterRecentSubject({
    required this.symbol,
    this.securityId,
    this.exchange,
    this.currency,
    this.name,
    this.source = "recent-subject-stack",
  });

  final String symbol;
  final String? securityId;
  final String? exchange;
  final String? currency;
  final String? name;
  final String source;

  String get stableKey {
    return [
      securityId?.trim().toUpperCase() ?? "",
      symbol.trim().toUpperCase(),
      exchange?.trim().toUpperCase() ?? "",
      currency?.trim().toUpperCase() ?? "",
    ].join("|");
  }

  Map<String, dynamic> toJson() {
    return {
      if (securityId != null && securityId!.isNotEmpty)
        "securityId": securityId,
      "symbol": symbol,
      if (exchange != null && exchange!.isNotEmpty) "exchange": exchange,
      if (currency != null && currency!.isNotEmpty) "currency": currency,
      if (name != null && name!.isNotEmpty) "name": name,
      "source": source,
    };
  }
}

class LooMinisterSuggestedAction {
  const LooMinisterSuggestedAction({
    required this.id,
    required this.label,
    required this.actionType,
    this.detail,
    this.target = const <String, dynamic>{},
    this.requiresConfirmation = false,
    this.authorityBoundary =
        "大臣只能建议此动作；执行前必须由用户确认并走后端校验。",
  });

  final String id;
  final String label;
  final String actionType;
  final String? detail;
  final Map<String, dynamic> target;
  final bool requiresConfirmation;
  final String authorityBoundary;

  bool get isSafeConfirmationState {
    const mutatingActions = {
      "create-draft",
      "update-preferences",
      "refresh-data",
      "run-analysis",
    };
    return !mutatingActions.contains(actionType) || requiresConfirmation;
  }

  Map<String, dynamic> toJson() {
    return {
      "id": id,
      "label": label,
      if (detail != null && detail!.isNotEmpty) "detail": detail,
      "actionType": actionType,
      "target": target,
      "requiresConfirmation": requiresConfirmation,
      "authorityBoundary": authorityBoundary,
    };
  }
}

class LooMinisterPageContext {
  const LooMinisterPageContext({
    required this.page,
    required this.title,
    required this.asOf,
    this.displayCurrency = "CAD",
    this.subject = const LooMinisterSubject(),
    this.dataFreshness = const LooMinisterDataFreshness(),
    this.facts = const [],
    this.warnings = const [],
    this.allowedActions = const [],
  });

  final String page;
  final String title;
  final String asOf;
  final String displayCurrency;
  final LooMinisterSubject subject;
  final LooMinisterDataFreshness dataFreshness;
  final List<LooMinisterFact> facts;
  final List<String> warnings;
  final List<LooMinisterSuggestedAction> allowedActions;

  bool get isValidLocalShape {
    if (!dataFreshness.isHonestReferenceState) return false;
    if (subject.security != null &&
        !subject.security!.hasCompleteListingIdentity) {
      return false;
    }
    if (page == "account-detail" &&
        (subject.accountId == null || subject.accountId!.isEmpty)) {
      return false;
    }
    if (page == "holding-detail" &&
        (subject.holdingId == null || subject.holdingId!.isEmpty)) {
      return false;
    }
    if (page == "security-detail" && subject.security == null) {
      return false;
    }
    return allowedActions.every((action) => action.isSafeConfirmationState);
  }

  Map<String, dynamic> toJson() {
    return {
      "version": looMinisterContextVersion,
      "page": page,
      "locale": "zh",
      "title": title,
      "asOf": asOf,
      "displayCurrency": displayCurrency,
      "subject": subject.toJson(),
      "dataFreshness": dataFreshness.toJson(),
      "facts": facts.map((fact) => fact.toJson()).toList(),
      "warnings": warnings,
      "allowedActions":
          allowedActions.map((action) => action.toJson()).toList(),
    };
  }
}

class LooMinisterQuestionRequest {
  const LooMinisterQuestionRequest({
    required this.pageContext,
    required this.question,
    this.recentSubjects = const [],
    this.answerStyle = "beginner",
    this.cacheStrategy = "prefer-cache",
    this.includeExternalResearch = false,
  });

  final LooMinisterPageContext pageContext;
  final String question;
  final List<LooMinisterRecentSubject> recentSubjects;
  final String answerStyle;
  final String cacheStrategy;
  final bool includeExternalResearch;

  Map<String, dynamic> toJson() {
    return {
      "pageContext": pageContext.toJson(),
      "question": question,
      "recentSubjects":
          recentSubjects.map((subject) => subject.toJson()).toList(),
      "answerStyle": answerStyle,
      "cacheStrategy": cacheStrategy,
      "includeExternalResearch": includeExternalResearch,
    };
  }
}

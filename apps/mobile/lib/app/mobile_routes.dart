class MobileRoutes {
  const MobileRoutes._();

  static const overview = "/overview";
  static const portfolio = "/portfolio";
  static const portfolioAccounts = "/portfolio/accounts";
  static const portfolioHoldings = "/portfolio/holdings";
  static const recommendations = "/recommendations";
  static const importFlow = "/import";
  static const settings = "/settings";

  static String accountDetail(String accountId) {
    return "/portfolio/accounts/${_encode(accountId)}";
  }

  static String holdingDetail(String holdingId) {
    return "/portfolio/holdings/${_encode(holdingId)}";
  }

  static String securityDetail({
    required String symbol,
    String? securityId,
    String? exchange,
    String? currency,
  }) {
    final params = <String, String>{
      if (securityId != null && securityId.trim().isNotEmpty)
        "securityId": securityId.trim(),
      if (exchange != null && exchange.trim().isNotEmpty)
        "exchange": exchange.trim(),
      if (currency != null && currency.trim().isNotEmpty)
        "currency": currency.trim(),
    };
    final query = params.isEmpty
        ? ""
        : "?${params.entries.map((entry) => "${_encode(entry.key)}=${_encode(entry.value)}").join("&")}";
    return "/securities/${_encode(symbol)}$query";
  }

  static String _encode(String value) {
    return Uri.encodeComponent(value.trim());
  }
}

String decodeRouteParam(String value) {
  return Uri.decodeComponent(value);
}

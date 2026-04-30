import "dart:convert";

import "package:http/http.dart" as http;

import "../config/app_config.dart";

typedef AccessTokenRefresh = Future<String?> Function();
typedef UnauthorizedHandler = Future<void> Function();

class LooApiException implements Exception {
  const LooApiException(this.message, {this.statusCode});

  final String message;
  final int? statusCode;

  @override
  String toString() => message;
}

class LooApiClient {
  LooApiClient({
    http.Client? httpClient,
    String? baseUrl,
    String accessToken = AppConfig.accessToken,
    AccessTokenRefresh? refreshAccessToken,
    UnauthorizedHandler? onUnauthorized,
  })  : _httpClient = httpClient ?? http.Client(),
        _baseUri = Uri.parse(baseUrl ?? AppConfig.apiBaseUrl),
        _accessToken = accessToken,
        _refreshAccessToken = refreshAccessToken,
        _onUnauthorized = onUnauthorized;

  final http.Client _httpClient;
  final Uri _baseUri;
  final AccessTokenRefresh? _refreshAccessToken;
  final UnauthorizedHandler? _onUnauthorized;
  String _accessToken;

  Future<Map<String, dynamic>> getMobileHome() {
    return _getJson("/api/mobile/home");
  }

  Future<Map<String, dynamic>> getPortfolioOverview() {
    return _getJson("/api/mobile/portfolio/overview");
  }

  Future<Map<String, dynamic>> getPortfolioHealth({String? accountId}) {
    final query = accountId == null || accountId.isEmpty
        ? ""
        : "?account=${Uri.encodeQueryComponent(accountId)}";
    return _getJson("/api/mobile/portfolio/health$query");
  }

  Future<Map<String, dynamic>> createAnalyzerQuickScan(
      Map<String, dynamic> payload) {
    return _postJson("/api/mobile/analysis/quick-scan", body: payload);
  }

  Future<Map<String, dynamic>> getRecentAnalyzerRuns({int limit = 5}) {
    return _getJson("/api/mobile/analysis/recent?limit=$limit");
  }

  Future<Map<String, dynamic>> getExternalResearchPolicy() {
    return _getJson("/api/mobile/analysis/external-research-policy");
  }

  Future<Map<String, dynamic>> getExternalResearchUsage() {
    return _getJson("/api/mobile/analysis/external-research-usage");
  }

  Future<Map<String, dynamic>> getExternalResearchJobs({int limit = 5}) {
    return _getJson(
        "/api/mobile/analysis/external-research-jobs/recent?limit=$limit");
  }

  Future<Map<String, dynamic>> askLooMinister(Map<String, dynamic> payload) {
    return _postJson("/api/mobile/minister/ask", body: payload);
  }

  Future<Map<String, dynamic>> getRecommendations() {
    return _getJson("/api/mobile/recommendations");
  }

  Future<Map<String, dynamic>> createRecommendationRun(
      double contributionAmountCad) {
    return _postJson(
      "/api/mobile/recommendations/runs",
      body: {"contributionAmountCad": contributionAmountCad},
    );
  }

  Future<Map<String, dynamic>> getImportGuide() {
    return _getJson("/api/mobile/import");
  }

  Future<Map<String, dynamic>> resolveSecurity(String symbol) {
    return _getJson(
        "/api/mobile/market-data/resolve?symbol=${Uri.encodeQueryComponent(symbol)}");
  }

  Future<Map<String, dynamic>> searchSecurities(String query) {
    return _getJson(
        "/api/mobile/market-data/search?query=${Uri.encodeQueryComponent(query)}");
  }

  Future<Map<String, dynamic>> createManualAccount({
    required String accountType,
    required String institution,
    required String nickname,
    required String currency,
    required double contributionRoomCad,
    required double initialMarketValueAmount,
  }) {
    return _postJson(
      "/api/mobile/import/accounts",
      body: {
        "accountType": accountType,
        "institution": institution,
        "nickname": nickname,
        "currency": currency,
        "contributionRoomCad": contributionRoomCad,
        "initialMarketValueAmount": initialMarketValueAmount,
      },
    );
  }

  Future<Map<String, dynamic>> createManualHolding({
    required String accountId,
    required String symbol,
    required String name,
    required String currency,
    required String assetClass,
    required String sector,
    required String securityType,
    required String exchange,
    required double quantity,
    required double avgCostPerShareAmount,
    required double lastPriceAmount,
    required double marketValueAmount,
  }) {
    return _postJson(
      "/api/mobile/import/accounts/${Uri.encodeComponent(accountId)}/holdings",
      body: {
        "symbol": symbol,
        "name": name,
        "currency": currency,
        "assetClass": assetClass,
        "sector": sector,
        "securityType": securityType,
        "exchange": exchange,
        "quantity": quantity,
        "avgCostPerShareAmount": avgCostPerShareAmount,
        "lastPriceAmount": lastPriceAmount,
        "marketValueAmount": marketValueAmount,
      },
    );
  }

  Future<Map<String, dynamic>> getPortfolioAccountDetail(String accountId) {
    return _getJson(
        "/api/mobile/portfolio/accounts/${Uri.encodeComponent(accountId)}");
  }

  Future<Map<String, dynamic>> getPortfolioHoldingDetail(String holdingId) {
    return _getJson(
        "/api/mobile/portfolio/holdings/${Uri.encodeComponent(holdingId)}");
  }

  Future<Map<String, dynamic>> getPortfolioSecurityDetail(
    String symbol, {
    String? exchange,
    String? currency,
  }) {
    final query = {
      if (exchange != null && exchange.isNotEmpty) "exchange": exchange,
      if (currency != null && currency.isNotEmpty) "currency": currency,
    };
    final suffix = query.isEmpty ? "" : "?${Uri(queryParameters: query).query}";
    return _getJson(
        "/api/mobile/portfolio/securities/${Uri.encodeComponent(symbol)}$suffix");
  }

  Future<void> deletePortfolioAccount(String accountId) async {
    await _deleteJson(
        "/api/mobile/portfolio/accounts/${Uri.encodeComponent(accountId)}/manage");
  }

  Future<Map<String, dynamic>> updatePortfolioAccount({
    required String accountId,
    required String nickname,
    required String institution,
    required String type,
    required String currency,
    required double contributionRoomCad,
  }) {
    return _patchJson(
      "/api/mobile/portfolio/accounts/${Uri.encodeComponent(accountId)}/manage",
      body: {
        "nickname": nickname,
        "institution": institution,
        "type": type,
        "currency": currency,
        "contributionRoomCad": contributionRoomCad,
      },
    );
  }

  Future<void> deletePortfolioHolding(String holdingId) async {
    await _deleteJson(
        "/api/mobile/portfolio/holdings/${Uri.encodeComponent(holdingId)}/manage");
  }

  Future<Map<String, dynamic>> updatePortfolioHolding({
    required String holdingId,
    required String name,
    required String currency,
    required double quantity,
    required double avgCostPerShareAmount,
    required double lastPriceAmount,
    required double marketValueAmount,
    required String assetClass,
    required String sector,
    required String securityType,
    required String exchange,
  }) {
    return _patchJson(
      "/api/mobile/portfolio/holdings/${Uri.encodeComponent(holdingId)}/manage",
      body: {
        "name": name,
        "currency": currency,
        "quantity": quantity,
        "avgCostPerShareAmount": avgCostPerShareAmount,
        "lastPriceAmount": lastPriceAmount,
        "marketValueAmount": marketValueAmount,
        "assetClassOverride": assetClass,
        "sectorOverride": sector,
        "securityTypeOverride": securityType,
        "exchangeOverride": exchange,
      },
    );
  }

  Future<Map<String, dynamic>> updateDisplayCurrency(String currency) {
    return _patchJson(
      "/api/mobile/settings/display-currency",
      body: {"currency": currency},
    );
  }

  Future<Map<String, dynamic>> getInvestmentPreferences() {
    return _getJson("/api/mobile/settings/preferences");
  }

  Future<Map<String, dynamic>> getAiMinisterSettings() {
    return _getJson("/api/mobile/settings/ai-minister");
  }

  Future<Map<String, dynamic>> updateAiMinisterSettings(
      Map<String, dynamic> payload) {
    return _patchJson("/api/mobile/settings/ai-minister", body: payload);
  }

  Future<Map<String, dynamic>> updateInvestmentPreferences(
      Map<String, dynamic> payload) {
    return _patchJson("/api/mobile/settings/preferences", body: payload);
  }

  Future<Map<String, dynamic>> saveGuidedPreferenceDraft(
      Map<String, dynamic> payload) {
    return _patchJson("/api/mobile/settings/guided-draft", body: payload);
  }

  Future<Map<String, dynamic>> addWatchlistSymbol(String symbol) {
    return _postJson(
      "/api/mobile/settings/watchlist",
      body: {"symbol": symbol},
    );
  }

  Future<Map<String, dynamic>> removeWatchlistSymbol(String symbol) {
    return _deleteJsonWithBody(
      "/api/mobile/settings/watchlist",
      body: {"symbol": symbol},
    );
  }

  Future<Map<String, dynamic>> refreshPortfolioQuotes() {
    return _postJson("/api/mobile/portfolio/refresh-prices");
  }

  Future<Map<String, dynamic>> getMarketDataRefreshRuns({int limit = 5}) {
    return _getJson("/api/mobile/market-data/refresh-runs/recent?limit=$limit");
  }

  Future<Map<String, dynamic>> login({
    required String email,
    required String password,
  }) {
    return _postJson(
      "/api/mobile/auth/login",
      body: {
        "email": email,
        "password": password,
      },
      retryOnUnauthorized: false,
    );
  }

  Future<Map<String, dynamic>> refreshSession(String refreshToken) {
    return _postJson(
      "/api/mobile/auth/refresh",
      body: {
        "refreshToken": refreshToken,
      },
      retryOnUnauthorized: false,
    );
  }

  Future<void> logout() async {
    await _postJson("/api/mobile/auth/logout");
  }

  Future<Map<String, dynamic>> _getJson(String path) async {
    final uri = _baseUri.resolve(path);
    var response = await _httpClient.get(uri, headers: _headers);

    if (response.statusCode == 401 && _refreshAccessToken != null) {
      final refreshedToken = await _refreshAccessToken();
      if (refreshedToken != null && refreshedToken.isNotEmpty) {
        _accessToken = refreshedToken;
        response = await _httpClient.get(uri, headers: _headers);
      }
    }

    if (response.statusCode == 401 && _onUnauthorized != null) {
      await _onUnauthorized();
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw LooApiException(
        _readErrorMessage(response.body),
        statusCode: response.statusCode,
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const LooApiException("接口返回格式不正确。");
    }

    return decoded;
  }

  Future<Map<String, dynamic>> _postJson(
    String path, {
    Map<String, dynamic>? body,
    bool retryOnUnauthorized = true,
  }) async {
    final uri = _baseUri.resolve(path);
    var response = await _httpClient.post(
      uri,
      headers: {
        ..._headers,
        "Content-Type": "application/json",
      },
      body: jsonEncode(body ?? const <String, dynamic>{}),
    );

    if (response.statusCode == 401 &&
        retryOnUnauthorized &&
        _refreshAccessToken != null) {
      final refreshedToken = await _refreshAccessToken();
      if (refreshedToken != null && refreshedToken.isNotEmpty) {
        _accessToken = refreshedToken;
        response = await _httpClient.post(
          uri,
          headers: {
            ..._headers,
            "Content-Type": "application/json",
          },
          body: jsonEncode(body ?? const <String, dynamic>{}),
        );
      }
    }

    if (response.statusCode == 401 &&
        retryOnUnauthorized &&
        _onUnauthorized != null) {
      await _onUnauthorized();
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw LooApiException(
        _readErrorMessage(response.body),
        statusCode: response.statusCode,
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const LooApiException("接口返回格式不正确。");
    }

    return decoded;
  }

  Future<Map<String, dynamic>> _patchJson(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = _baseUri.resolve(path);
    var response = await _httpClient.patch(
      uri,
      headers: {
        ..._headers,
        "Content-Type": "application/json",
      },
      body: jsonEncode(body ?? const <String, dynamic>{}),
    );

    if (response.statusCode == 401 && _refreshAccessToken != null) {
      final refreshedToken = await _refreshAccessToken();
      if (refreshedToken != null && refreshedToken.isNotEmpty) {
        _accessToken = refreshedToken;
        response = await _httpClient.patch(
          uri,
          headers: {
            ..._headers,
            "Content-Type": "application/json",
          },
          body: jsonEncode(body ?? const <String, dynamic>{}),
        );
      }
    }

    if (response.statusCode == 401 && _onUnauthorized != null) {
      await _onUnauthorized();
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw LooApiException(
        _readErrorMessage(response.body),
        statusCode: response.statusCode,
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const LooApiException("接口返回格式不正确。");
    }

    return decoded;
  }

  Future<Map<String, dynamic>> _deleteJson(String path) async {
    final uri = _baseUri.resolve(path);
    var response = await _httpClient.delete(uri, headers: _headers);

    if (response.statusCode == 401 && _refreshAccessToken != null) {
      final refreshedToken = await _refreshAccessToken();
      if (refreshedToken != null && refreshedToken.isNotEmpty) {
        _accessToken = refreshedToken;
        response = await _httpClient.delete(uri, headers: _headers);
      }
    }

    if (response.statusCode == 401 && _onUnauthorized != null) {
      await _onUnauthorized();
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw LooApiException(
        _readErrorMessage(response.body),
        statusCode: response.statusCode,
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const LooApiException("接口返回格式不正确。");
    }

    return decoded;
  }

  Future<Map<String, dynamic>> _deleteJsonWithBody(
    String path, {
    Map<String, dynamic>? body,
  }) async {
    final uri = _baseUri.resolve(path);
    var request = http.Request("DELETE", uri)
      ..headers.addAll({
        ..._headers,
        "Content-Type": "application/json",
      })
      ..body = jsonEncode(body ?? const <String, dynamic>{});
    var response =
        await http.Response.fromStream(await _httpClient.send(request));

    if (response.statusCode == 401 && _refreshAccessToken != null) {
      final refreshedToken = await _refreshAccessToken();
      if (refreshedToken != null && refreshedToken.isNotEmpty) {
        _accessToken = refreshedToken;
        request = http.Request("DELETE", uri)
          ..headers.addAll({
            ..._headers,
            "Content-Type": "application/json",
          })
          ..body = jsonEncode(body ?? const <String, dynamic>{});
        response =
            await http.Response.fromStream(await _httpClient.send(request));
      }
    }

    if (response.statusCode == 401 && _onUnauthorized != null) {
      await _onUnauthorized();
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw LooApiException(
        _readErrorMessage(response.body),
        statusCode: response.statusCode,
      );
    }

    final decoded = jsonDecode(response.body);
    if (decoded is! Map<String, dynamic>) {
      throw const LooApiException("接口返回格式不正确。");
    }

    return decoded;
  }

  Map<String, String> get _headers {
    return {
      "Accept": "application/json",
      if (_accessToken.isNotEmpty) "Authorization": "Bearer $_accessToken",
    };
  }

  String _readErrorMessage(String body) {
    try {
      final decoded = jsonDecode(body);
      if (decoded is Map<String, dynamic> && decoded["error"] is String) {
        return decoded["error"] as String;
      }
    } catch (_) {
      return "接口请求失败。";
    }

    return "接口请求失败。";
  }
}

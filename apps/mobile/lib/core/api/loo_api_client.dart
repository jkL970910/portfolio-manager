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

  Future<Map<String, dynamic>> getRecommendations() {
    return _getJson("/api/mobile/recommendations");
  }

  Future<Map<String, dynamic>> getImportGuide() {
    return _getJson("/api/mobile/import");
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

  Future<Map<String, dynamic>> getPortfolioSecurityDetail(String symbol) {
    return _getJson(
        "/api/mobile/portfolio/securities/${Uri.encodeComponent(symbol)}");
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
    final uri = _baseUri.replace(path: path);
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
    final uri = _baseUri.replace(path: path);
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

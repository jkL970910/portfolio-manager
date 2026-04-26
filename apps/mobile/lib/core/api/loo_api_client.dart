import "dart:convert";

import "package:http/http.dart" as http;

import "../config/app_config.dart";

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
    String baseUrl = AppConfig.apiBaseUrl,
    String accessToken = AppConfig.accessToken,
  })  : _httpClient = httpClient ?? http.Client(),
        _baseUri = Uri.parse(baseUrl),
        _accessToken = accessToken;

  final http.Client _httpClient;
  final Uri _baseUri;
  final String _accessToken;

  Future<Map<String, dynamic>> getMobileHome() {
    return _getJson("/api/mobile/home");
  }

  Future<Map<String, dynamic>> getPortfolioOverview() {
    return _getJson("/api/mobile/portfolio/overview");
  }

  Future<Map<String, dynamic>> _getJson(String path) async {
    final uri = _baseUri.replace(path: path);
    final response = await _httpClient.get(uri, headers: _headers);

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

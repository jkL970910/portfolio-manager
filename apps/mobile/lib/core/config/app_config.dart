import "web_origin_stub.dart" if (dart.library.html) "web_origin_web.dart";

class AppConfig {
  const AppConfig._();

  static String get apiBaseUrl {
    const configured = String.fromEnvironment("LOO_API_BASE_URL");
    if (configured.isNotEmpty) {
      return configured;
    }

    return currentWebOrigin() ?? "http://localhost:3000";
  }

  static const accessToken = String.fromEnvironment("LOO_ACCESS_TOKEN");
}

class AppConfig {
  const AppConfig._();

  static const apiBaseUrl = String.fromEnvironment(
    "LOO_API_BASE_URL",
    defaultValue: "http://localhost:3000",
  );

  static const accessToken = String.fromEnvironment("LOO_ACCESS_TOKEN");
}

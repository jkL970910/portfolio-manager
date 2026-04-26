class MobileAuthSession {
  const MobileAuthSession({
    required this.viewerId,
    required this.viewerName,
    required this.email,
    required this.accessToken,
    required this.refreshToken,
  });

  final String viewerId;
  final String viewerName;
  final String email;
  final String accessToken;
  final String refreshToken;

  factory MobileAuthSession.fromApiResponse(Map<String, dynamic> response) {
    final data = response["data"];
    if (data is! Map<String, dynamic>) {
      throw const FormatException("登录响应缺少 data。");
    }

    final viewer = data["viewer"];
    final auth = data["auth"];
    if (viewer is! Map<String, dynamic> || auth is! Map<String, dynamic>) {
      throw const FormatException("登录响应缺少 viewer 或 auth。");
    }

    return MobileAuthSession(
      viewerId: viewer["id"] as String? ?? "",
      viewerName: viewer["displayName"] as String? ?? "Loo国居民",
      email: viewer["email"] as String? ?? "",
      accessToken: auth["accessToken"] as String? ?? "",
      refreshToken: auth["refreshToken"] as String? ?? "",
    );
  }

  Map<String, String> toStorage() {
    return {
      "viewerId": viewerId,
      "viewerName": viewerName,
      "email": email,
      "accessToken": accessToken,
      "refreshToken": refreshToken,
    };
  }

  factory MobileAuthSession.fromStorage(Map<String, String> storage) {
    return MobileAuthSession(
      viewerId: storage["viewerId"] ?? "",
      viewerName: storage["viewerName"] ?? "Loo国居民",
      email: storage["email"] ?? "",
      accessToken: storage["accessToken"] ?? "",
      refreshToken: storage["refreshToken"] ?? "",
    );
  }
}

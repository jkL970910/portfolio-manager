import "package:shared_preferences/shared_preferences.dart";

import "mobile_auth_session.dart";

class MobileAuthStore {
  static const _viewerIdKey = "loo.viewerId";
  static const _viewerNameKey = "loo.viewerName";
  static const _emailKey = "loo.email";
  static const _accessTokenKey = "loo.accessToken";
  static const _refreshTokenKey = "loo.refreshToken";

  Future<MobileAuthSession?> load() async {
    final preferences = await SharedPreferences.getInstance();
    final accessToken = preferences.getString(_accessTokenKey);
    final refreshToken = preferences.getString(_refreshTokenKey);

    if ((accessToken == null || accessToken.isEmpty) && (refreshToken == null || refreshToken.isEmpty)) {
      return null;
    }

    return MobileAuthSession.fromStorage({
      "viewerId": preferences.getString(_viewerIdKey) ?? "",
      "viewerName": preferences.getString(_viewerNameKey) ?? "Loo国居民",
      "email": preferences.getString(_emailKey) ?? "",
      "accessToken": accessToken ?? "",
      "refreshToken": refreshToken ?? "",
    });
  }

  Future<void> save(MobileAuthSession session) async {
    final preferences = await SharedPreferences.getInstance();
    final values = session.toStorage();

    await preferences.setString(_viewerIdKey, values["viewerId"] ?? "");
    await preferences.setString(_viewerNameKey, values["viewerName"] ?? "Loo国居民");
    await preferences.setString(_emailKey, values["email"] ?? "");
    await preferences.setString(_accessTokenKey, values["accessToken"] ?? "");
    await preferences.setString(_refreshTokenKey, values["refreshToken"] ?? "");
  }

  Future<void> clear() async {
    final preferences = await SharedPreferences.getInstance();
    await preferences.remove(_viewerIdKey);
    await preferences.remove(_viewerNameKey);
    await preferences.remove(_emailKey);
    await preferences.remove(_accessTokenKey);
    await preferences.remove(_refreshTokenKey);
  }
}

import "package:flutter_secure_storage/flutter_secure_storage.dart";

import "mobile_auth_session.dart";

abstract class MobileKeyValueStore {
  Future<String?> read(String key);
  Future<void> write(String key, String value);
  Future<void> delete(String key);
}

class SecureMobileKeyValueStore implements MobileKeyValueStore {
  const SecureMobileKeyValueStore({
    FlutterSecureStorage storage = const FlutterSecureStorage(
      aOptions: AndroidOptions(encryptedSharedPreferences: true),
      webOptions: WebOptions(
        dbName: "loo_wealth_secure_storage",
        publicKey: "loo_wealth_mobile",
      ),
    ),
  }) : _storage = storage;

  final FlutterSecureStorage _storage;

  @override
  Future<String?> read(String key) {
    return _storage.read(key: key);
  }

  @override
  Future<void> write(String key, String value) {
    return _storage.write(key: key, value: value);
  }

  @override
  Future<void> delete(String key) {
    return _storage.delete(key: key);
  }
}

class MobileAuthStore {
  MobileAuthStore({
    MobileKeyValueStore keyValueStore = const SecureMobileKeyValueStore(),
  }) : _keyValueStore = keyValueStore;

  static const _viewerIdKey = "loo.viewerId";
  static const _viewerNameKey = "loo.viewerName";
  static const _emailKey = "loo.email";
  static const _baseCurrencyKey = "loo.baseCurrency";
  static const _accessTokenKey = "loo.accessToken";
  static const _refreshTokenKey = "loo.refreshToken";

  final MobileKeyValueStore _keyValueStore;

  Future<MobileAuthSession?> load() async {
    final accessToken = await _keyValueStore.read(_accessTokenKey);
    final refreshToken = await _keyValueStore.read(_refreshTokenKey);

    if (accessToken == null ||
        accessToken.isEmpty ||
        refreshToken == null ||
        refreshToken.isEmpty) {
      return null;
    }

    return MobileAuthSession.fromStorage({
      "viewerId": await _keyValueStore.read(_viewerIdKey) ?? "",
      "viewerName": await _keyValueStore.read(_viewerNameKey) ?? "Loo国居民",
      "email": await _keyValueStore.read(_emailKey) ?? "",
      "baseCurrency": await _keyValueStore.read(_baseCurrencyKey) ?? "CAD",
      "accessToken": accessToken,
      "refreshToken": refreshToken,
    });
  }

  Future<void> save(MobileAuthSession session) async {
    final values = session.toStorage();

    await _keyValueStore.write(_viewerIdKey, values["viewerId"] ?? "");
    await _keyValueStore.write(
        _viewerNameKey, values["viewerName"] ?? "Loo国居民");
    await _keyValueStore.write(_emailKey, values["email"] ?? "");
    await _keyValueStore.write(
        _baseCurrencyKey, values["baseCurrency"] ?? "CAD");
    await _keyValueStore.write(_accessTokenKey, values["accessToken"] ?? "");
    await _keyValueStore.write(_refreshTokenKey, values["refreshToken"] ?? "");
  }

  Future<void> clear() async {
    await _keyValueStore.delete(_viewerIdKey);
    await _keyValueStore.delete(_viewerNameKey);
    await _keyValueStore.delete(_emailKey);
    await _keyValueStore.delete(_baseCurrencyKey);
    await _keyValueStore.delete(_accessTokenKey);
    await _keyValueStore.delete(_refreshTokenKey);
  }
}

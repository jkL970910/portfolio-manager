import "../auth/mobile_auth_store.dart";
import "loo_theme.dart";

class LooThemeStore {
  LooThemeStore({
    MobileKeyValueStore keyValueStore = const SecureMobileKeyValueStore(),
  }) : _keyValueStore = keyValueStore;

  static const _themeModeKey = "loo.themeMode";

  final MobileKeyValueStore _keyValueStore;

  Future<LooThemeMode> load() async {
    final stored = await _keyValueStore.read(_themeModeKey);
    return LooThemeModeX.fromStorageValue(stored);
  }

  Future<void> save(LooThemeMode mode) {
    return _keyValueStore.write(_themeModeKey, mode.storageValue);
  }
}

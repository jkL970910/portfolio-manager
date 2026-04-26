import "package:flutter_test/flutter_test.dart";

import "package:loo_wealth_mobile/app/app.dart";
import "package:loo_wealth_mobile/core/auth/mobile_auth_store.dart";

class MemoryKeyValueStore implements MobileKeyValueStore {
  final _values = <String, String>{};

  @override
  Future<void> delete(String key) async {
    _values.remove(key);
  }

  @override
  Future<String?> read(String key) async {
    return _values[key];
  }

  @override
  Future<void> write(String key, String value) async {
    _values[key] = value;
  }
}

void main() {
  testWidgets("renders the Loo login shell", (WidgetTester tester) async {
    await tester.pumpWidget(
      LooWealthApp(
        authStore: MobileAuthStore(keyValueStore: MemoryKeyValueStore()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text("进入 Loo国"), findsOneWidget);
    expect(find.text("邮箱"), findsOneWidget);
    expect(find.text("密码"), findsOneWidget);
    expect(find.text("召唤 Loo皇"), findsOneWidget);
  });
}

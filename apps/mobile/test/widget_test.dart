import "package:flutter_test/flutter_test.dart";
import "package:shared_preferences/shared_preferences.dart";

import "package:loo_wealth_mobile/app/app.dart";

void main() {
  testWidgets("renders the Loo login shell", (WidgetTester tester) async {
    SharedPreferences.setMockInitialValues({});

    await tester.pumpWidget(const LooWealthApp());
    await tester.pumpAndSettle();

    expect(find.text("进入 Loo国"), findsOneWidget);
    expect(find.text("邮箱"), findsOneWidget);
    expect(find.text("密码"), findsOneWidget);
    expect(find.text("召唤 Loo皇"), findsOneWidget);
  });
}

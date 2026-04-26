import "package:flutter_test/flutter_test.dart";

import "package:loo_wealth_mobile/app/app.dart";

void main() {
  testWidgets("renders the Loo mobile shell", (WidgetTester tester) async {
    await tester.pumpWidget(const LooWealthApp());

    expect(find.text("总览"), findsWidgets);
    expect(find.text("组合"), findsOneWidget);
    expect(find.text("推荐"), findsOneWidget);
    expect(find.text("导入"), findsOneWidget);
    expect(find.text("设置"), findsOneWidget);

    await tester.tap(find.text("组合"));
    await tester.pump();

    expect(find.text("组合御览"), findsOneWidget);
  });
}

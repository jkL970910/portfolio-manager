import "package:flutter_test/flutter_test.dart";
import "package:loo_wealth_mobile/features/shared/data/loo_minister_context_models.dart";

void main() {
  const now = "2026-04-30T04:00:00.000Z";

  test("serializes overview minister context for cross-page Q&A", () {
    const context = LooMinisterPageContext(
      page: "overview",
      title: "Loo国总览",
      asOf: now,
      facts: [
        LooMinisterFact(
          id: "net-worth",
          label: "总资产",
          value: "CAD 100,000",
        ),
      ],
    );

    final json = context.toJson();

    expect(context.isValidLocalShape, isTrue);
    expect(json["version"], looMinisterContextVersion);
    expect(json["locale"], "zh");
    expect((json["facts"] as List).single["id"], "net-worth");
  });

  test("keeps security identity as symbol plus exchange plus currency", () {
    const usdCommon = LooMinisterSecurityIdentity(
      symbol: "AMZN",
      exchange: "NASDAQ",
      currency: "USD",
      name: "Amazon.com",
    );
    const cadListed = LooMinisterSecurityIdentity(
      symbol: "AMZN",
      exchange: "NEO",
      currency: "CAD",
      name: "Amazon CDR",
    );

    expect(usdCommon.toJson()["symbol"], cadListed.toJson()["symbol"]);
    expect(usdCommon.toJson(), isNot(cadListed.toJson()));
    expect(usdCommon.hasCompleteListingIdentity, isTrue);
    expect(cadListed.hasCompleteListingIdentity, isTrue);
  });

  test("rejects partial local security identity", () {
    const context = LooMinisterPageContext(
      page: "security-detail",
      title: "VFV",
      asOf: now,
      subject: LooMinisterSubject(
        security: LooMinisterSecurityIdentity(
          symbol: "VFV",
          exchange: "TSX",
        ),
      ),
    );

    expect(context.isValidLocalShape, isFalse);
  });

  test("requires confirmation for mutating minister actions", () {
    const unsafeAction = LooMinisterSuggestedAction(
      id: "apply-preferences",
      label: "应用新的投资偏好",
      actionType: "update-preferences",
    );
    const safeAction = LooMinisterSuggestedAction(
      id: "open-health",
      label: "查看健康分",
      actionType: "navigate",
      target: {"page": "portfolio-health"},
    );

    expect(unsafeAction.isSafeConfirmationState, isFalse);
    expect(safeAction.isSafeConfirmationState, isTrue);
  });

  test("does not let reference curves masquerade as local real data", () {
    const context = LooMinisterPageContext(
      page: "portfolio",
      title: "组合御览",
      asOf: now,
      dataFreshness: LooMinisterDataFreshness(
        chartFreshness: "reference",
        sourceMode: "local",
      ),
    );

    expect(context.isValidLocalShape, isFalse);
  });
}

import "package:flutter_test/flutter_test.dart";
import "package:loo_wealth_mobile/features/settings/data/registered_room_entry.dart";

void main() {
  test("computes remaining room from opening room and YTD net contribution", () {
    expect(
      computeRemainingRegisteredRoomCad(
        openingRoomCad: 20000,
        netContributionYtdCad: 3500,
      ),
      16500,
    );
  });

  test("clamps remaining room at zero", () {
    expect(
      computeRemainingRegisteredRoomCad(
        openingRoomCad: 5000,
        netContributionYtdCad: 7000,
      ),
      0,
    );
  });

  test("parses blank registered room input as null", () {
    expect(parseRegisteredRoomNumber("   "), isNull);
  });
}

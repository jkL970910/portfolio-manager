import "package:flutter_test/flutter_test.dart";
import "package:loo_wealth_mobile/features/settings/data/registered_room_entry.dart";

void main() {
  test("parses blank registered room input as null", () {
    expect(parseRegisteredRoomNumber("   "), isNull);
  });

  test("parses registered room number directly", () {
    expect(parseRegisteredRoomNumber("14646.25"), 14646.25);
  });

  test("computes remaining room from total room and YTD contribution", () {
    expect(
      computeRemainingRegisteredRoomCad(
        totalRoomCad: 14646,
        contributedYtdCad: 7223,
      ),
      7423,
    );
  });

  test("clamps remaining room when contribution exceeds total room", () {
    expect(
      computeRemainingRegisteredRoomCad(
        totalRoomCad: 8000,
        contributedYtdCad: 12000,
      ),
      0,
    );
  });
}

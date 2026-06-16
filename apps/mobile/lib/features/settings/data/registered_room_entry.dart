double? parseRegisteredRoomNumber(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) {
    return null;
  }
  return double.tryParse(trimmed);
}

double computeRemainingRegisteredRoomCad({
  required double totalRoomCad,
  required double contributedYtdCad,
}) {
  final remaining = totalRoomCad - contributedYtdCad;
  return remaining < 0 ? 0 : remaining;
}

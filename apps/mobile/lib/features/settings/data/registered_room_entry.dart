double? parseRegisteredRoomNumber(String value) {
  final trimmed = value.trim();
  if (trimmed.isEmpty) {
    return null;
  }
  return double.tryParse(trimmed);
}

double computeRemainingRegisteredRoomCad({
  required double openingRoomCad,
  required double netContributionYtdCad,
}) {
  final remaining = openingRoomCad - netContributionYtdCad;
  return remaining < 0 ? 0 : remaining;
}

import assert from "node:assert/strict";
import test from "node:test";

import { createPreferenceFactorsDraft } from "@/lib/backend/preference-factor-draft";

test("preference factor draft maps beginner narrative into structured factors", async () => {
  const result = await createPreferenceFactorsDraft("user_test", {
    narrative:
      "我想更激进一点，偏科技和能源股，未来 5 年可能买房，同时希望做税务优化。",
  });

  assert.equal(result.data.sourceMode, "local");
  assert.equal(result.data.preferenceFactors.behavior.riskCapacity, "high");
  assert.ok(
    result.data.preferenceFactors.sectorTilts.preferredSectors.includes(
      "Technology",
    ),
  );
  assert.ok(
    result.data.preferenceFactors.sectorTilts.preferredSectors.includes(
      "Energy",
    ),
  );
  assert.equal(
    result.data.preferenceFactors.lifeGoals.homePurchase.enabled,
    true,
  );
  assert.equal(
    result.data.preferenceFactors.taxStrategy.taxableTaxSensitivity,
    "high",
  );
});

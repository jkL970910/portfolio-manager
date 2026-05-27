import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_PREFERENCE_FACTORS } from "@/lib/backend/preference-factors";
import {
  deriveStrategyProfileFromAnswers,
  getDefaultTargetAllocationForRisk,
  inferStrategyModeFromProfile,
} from "@/lib/backend/recommendation-v4/strategy-policy";

test("aggressive risk preset materially increases US equity target", () => {
  const growth = getDefaultTargetAllocationForRisk("Growth");
  const aggressive = getDefaultTargetAllocationForRisk("Aggressive");

  const growthUs = growth.find((item) => item.assetClass === "US Equity")?.targetPct;
  const aggressiveUs = aggressive.find((item) => item.assetClass === "US Equity")?.targetPct;
  const aggressiveDefense = aggressive
    .filter((item) => item.assetClass === "Fixed Income" || item.assetClass === "Cash")
    .reduce((sum, item) => sum + item.targetPct, 0);

  assert.equal(growthUs, 50);
  assert.equal(aggressiveUs, 65);
  assert.equal(aggressiveDefense, 15);
});

test("questionnaire maps long horizon high drawdown tech conviction to aggressive tech strategy", () => {
  const strategy = deriveStrategyProfileFromAnswers({
    horizon: "long",
    drawdownTolerance: "very_high",
    cashNeed: "low",
    usTechConviction: "high",
    concentrationTolerance: "high",
    accountComplexity: "tax_aware",
  });

  assert.equal(strategy.mode, "aggressive_us_tech");
  assert.equal(strategy.riskProfile, "Aggressive");
  assert.equal(
    strategy.targetAllocation.find((item) => item.assetClass === "US Equity")?.targetPct,
    65,
  );
});

test("strategy inference recognizes explicit tech-heavy profile", () => {
  const mode = inferStrategyModeFromProfile({
    riskProfile: "Growth",
    targetAllocation: [
      { assetClass: "Canadian Equity", targetPct: 5 },
      { assetClass: "US Equity", targetPct: 65 },
      { assetClass: "International Equity", targetPct: 15 },
      { assetClass: "Fixed Income", targetPct: 5 },
      { assetClass: "Cash", targetPct: 10 },
    ],
    preferenceFactors: {
      ...DEFAULT_PREFERENCE_FACTORS,
      sectorTilts: {
        ...DEFAULT_PREFERENCE_FACTORS.sectorTilts,
        preferredSectors: ["Technology", "Semiconductors"],
        styleTilts: ["Growth"],
      },
    },
  });

  assert.equal(mode, "aggressive_us_tech");
});

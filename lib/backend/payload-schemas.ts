import { z } from "zod";

const allocationTargetSchema = z.object({
  assetClass: z.string().min(1),
  targetPct: z.number().int().min(0).max(100)
});

export const preferenceProfileInputSchema = z.object({
  riskProfile: z.enum(["Conservative", "Balanced", "Growth"]),
  targetAllocation: z.array(allocationTargetSchema).min(1),
  accountFundingPriority: z.array(z.enum(["TFSA", "RRSP", "FHSA", "Taxable"]))
    .min(1)
    .refine((items) => new Set(items).size === items.length, "Account priorities must be unique."),
  taxAwarePlacement: z.boolean(),
  cashBufferTargetCad: z.number().min(0).max(1000000),
  transitionPreference: z.enum(["stay-close", "gradual", "direct"]),
  recommendationStrategy: z.enum(["tax-aware", "target-first", "balanced"]),
  rebalancingTolerancePct: z.number().int().min(0).max(50),
  watchlistSymbols: z.array(z.string().trim().min(1).max(32)).max(20)
}).superRefine((value, context) => {
  const total = value.targetAllocation.reduce((sum, target) => sum + target.targetPct, 0);
  if (total !== 100) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["targetAllocation"],
      message: "Target allocation must sum to 100."
    });
  }
});

export const registerUserInputSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  email: z.string().trim().email(),
  password: z.string().min(8).max(128)
});

export const importJobCreateSchema = z.object({
  fileName: z.string().trim().min(3).max(255),
  sourceType: z.enum(["csv"]).default("csv"),
  csvContent: z.string().min(1).max(2_000_000).optional(),
  fieldMapping: z.record(z.string().min(1), z.string().min(1)).optional(),
  importMode: z.enum(["replace", "merge"]).default("replace")
});

export const recommendationRunCreateSchema = z.object({
  contributionAmountCad: z.number().positive().max(1000000)
});

export type PreferenceProfileInputPayload = z.infer<typeof preferenceProfileInputSchema>;
export type RegisterUserInputPayload = z.infer<typeof registerUserInputSchema>;
export type ImportJobCreatePayload = z.infer<typeof importJobCreateSchema>;
export type RecommendationRunCreatePayload = z.infer<typeof recommendationRunCreateSchema>;

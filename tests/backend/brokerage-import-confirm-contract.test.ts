import assert from "node:assert/strict";
import test from "node:test";
import { brokerageImportDraftConfirmInputSchema } from "@/lib/backend/payload-schemas";

test("brokerage confirm defaults to safe snapshot merge mode", () => {
  const parsed = brokerageImportDraftConfirmInputSchema.parse({
    draftId: "11111111-1111-4111-8111-111111111111",
    selectedAccountIds: ["TFSA-1"],
  });

  assert.equal(parsed.confirmMode, "snapshot_merge");
});

test("brokerage confirm accepts explicit snapshot replace mode", () => {
  const parsed = brokerageImportDraftConfirmInputSchema.parse({
    draftId: "11111111-1111-4111-8111-111111111111",
    selectedAccountIds: ["TFSA-1"],
    confirmMode: "snapshot_replace",
  });

  assert.equal(parsed.confirmMode, "snapshot_replace");
});

test("brokerage confirm rejects unknown snapshot modes", () => {
  assert.throws(() =>
    brokerageImportDraftConfirmInputSchema.parse({
      draftId: "11111111-1111-4111-8111-111111111111",
      confirmMode: "force_delete",
    }),
  );
});

import { compatTier, palette, agentStateMeta } from "../theme";

test("compatTier maps scores to the right tiers (mirrors backend thresholds)", () => {
  expect(compatTier(90).key).toBe("alta");
  expect(compatTier(73).key).toBe("alta");
  expect(compatTier(60).key).toBe("media");
  expect(compatTier(52).key).toBe("media");
  expect(compatTier(20).key).toBe("baja");
  expect(compatTier(undefined).key).toBe("baja");
});

test("palette returns distinct light/dark surfaces", () => {
  expect(palette(false).surface).not.toBe(palette(true).surface);
  expect(palette(false).primary).toBeTruthy();
});

test("agentStateMeta covers the human-facing operational states", () => {
  expect(agentStateMeta.WAITING_FOR_USER.label).toMatch(/decisión/i);
  expect(agentStateMeta.COMPLETED.label).toBeTruthy();
});

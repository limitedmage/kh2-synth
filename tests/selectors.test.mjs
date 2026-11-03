import { test } from "node:test";
import assert from "node:assert/strict";
import planner from "../src/planner.js";
import { wishlistAvailability } from "../src/selectors.js";

test("Mythril Shard readiness is independent of competing wishlist items and their order", () => {
  const state = {
    ...planner.defaults(), materialTypes: 60, energy: "none",
    goals: { "Petite Ribbon": 1, "Mythril Shard": 1 },
    inventory: {
      "Mythril Crystal": 2, Orichalcum: 1, "Dense Stone": 1,
      "Dense Shard": 3, "Twilight Stone": 1, "Twilight Shard": 3,
    },
  };
  const before = structuredClone(state);
  const ready = wishlistAvailability(state);
  const reversed = wishlistAvailability({ ...state, goals: { "Mythril Shard": 1, "Petite Ribbon": 1 } });
  for (const name of Object.keys(state.goals)) {
    assert.equal(ready.get(name).status, "ready");
    assert.deepEqual(ready.get(name), reversed.get(name));
    assert.ok(planner.wishlistConflicts(state).has(name), `${name} must warn instead of reserving shared materials`);
  }
  assert.deepEqual(state, before);
});

test("each item can use owned Energy independently while combined totals still share finite stock", () => {
  const state = {
    ...planner.defaults(), materialTypes: 60, moogle: 5, expand: false,
    goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1 },
    inventory: {
      "Mythril Shard": 5, "Blazing Stone": 1, "Blazing Shard": 1,
      "Frost Stone": 1, "Frost Shard": 1, "Energy Shard": 1,
    },
  };
  for (const ready of wishlistAvailability(state).values()) {
    assert.equal(ready.status, "ready");
    assert.equal(ready.ingredients["Mythril Shard"], 2);
    assert.equal(ready.ingredients["Energy Shard"], 1);
  }
  const totals = planner.plan(state).requirements;
  assert.equal(totals.find((row) => row.name === "Energy Shard").required, 1);
  assert.equal(totals.find((row) => row.name === "Mythril Shard").required, 5);
  assert.equal(planner.wishlistConflicts(state).size, 0, "A feasible combined plan needs no warning");
});

test("independent readiness still respects unlocks and missing ingredients", () => {
  const state = {
    ...planner.defaults(), materialTypes: 19, energy: "none",
    goals: { "Mythril Shard": 1 },
    inventory: { "Dense Stone": 1, "Dense Shard": 3, "Twilight Stone": 1, "Twilight Shard": 3 },
  };
  assert.equal(wishlistAvailability(state).get("Mythril Shard").status, "locked");
  assert.equal(wishlistAvailability({ ...state, materialTypes: 20 }).get("Mythril Shard").status, "ready");
  assert.equal(wishlistAvailability({
    ...state, materialTypes: 20, inventory: { ...state.inventory, "Dense Shard": 2 },
  }).get("Mythril Shard").status, "missing");
});

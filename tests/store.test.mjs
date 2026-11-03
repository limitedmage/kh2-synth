import { test } from "node:test";
import assert from "node:assert/strict";
import planner from "../src/planner.js";
import { createStore, reduceJournal } from "../src/store.js";

test("stock actions leave prior state intact and preserve lifetime material discovery", () => {
  const original = {
    ...planner.defaults(), inventory: Object.freeze({ "Dense Shard": 2 }), materialTypes: 4,
  };
  Object.freeze(original);
  const emptied = reduceJournal(original, { type: "set-stock", name: "Dense Shard", value: -2 });
  assert.deepEqual(original.inventory, { "Dense Shard": 2 });
  assert.deepEqual(emptied.inventory, { "Dense Shard": 0 });
  assert.equal(emptied.materialTypes, 4);
  const restocked = reduceJournal(emptied, { type: "set-stock", name: "Energy Crystal", value: 3.9 });
  assert.equal(restocked.inventory["Energy Crystal"], 3);
  assert.equal(emptied.inventory["Energy Crystal"], undefined);
});

test("reviewed imports replace stock or merge one-of-each goals without changing progress", () => {
  const original = {
    ...planner.defaults(), inventory: { "Dense Shard": 4 }, goals: { "AP Boost": 1 },
    worlds: { hb: 2 }, materialTypes: 20,
  };
  const inventory = reduceJournal(original, {
    type: "apply-import", kind: "inventory", rows: [{ name: "Energy Crystal", quantity: 3 }],
  });
  assert.deepEqual(inventory.inventory, { "Energy Crystal": 3 });
  assert.deepEqual(original.inventory, { "Dense Shard": 4 });
  assert.equal(inventory.materialTypes, 20);
  assert.equal(inventory.goals, original.goals);
  assert.equal(inventory.worlds, original.worlds);
  const recipes = reduceJournal(inventory, {
    type: "apply-import", kind: "recipes",
    rows: [{ name: "AP Boost", quantity: 99 }, { name: "Petite Ribbon", quantity: 2 }],
  });
  assert.deepEqual(recipes.goals, { "AP Boost": 1, "Petite Ribbon": 1 });
  assert.equal(recipes.inventory, inventory.inventory);
  assert.equal(recipes.worlds, original.worlds);
});

test("storage failure does not lose edits and the next successful save includes them", () => {
  let blocked = true;
  let saved;
  const store = createStore({
    getItem: () => null,
    setItem(key, value) {
      if (blocked) throw new Error("Storage blocked");
      saved = JSON.parse(value);
    },
  });
  const changes = [];
  store.subscribe((state) => changes.push({ goals: state.goals, error: store.getStorageError() }));
  store.dispatch({ type: "add-goal", name: "AP Boost" });
  assert.deepEqual(store.getState().goals, { "AP Boost": 1 });
  assert.match(changes[0].error, /Not saved/);
  blocked = false;
  store.dispatch({ type: "set-stock", name: "Dense Shard", value: 4 });
  assert.deepEqual(saved.goals, { "AP Boost": 1 });
  assert.deepEqual(saved.inventory, { "Dense Shard": 4 });
  assert.equal(changes[1].error, "");
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const context = vm.createContext({});
for (const name of ["data", "planner", "recognition"]) vm.runInContext(await readFile(new URL(`../src/${name}.js`, import.meta.url), "utf8"), context);
const { KH2Data: D, KH2Planner: P, KH2Recognition: R } = context;
const state = (overrides = {}) => ({ ...P.defaults(), materialTypes: 60, ...overrides });
const row = (plan, name) => plan.requirements.find((r) => r.name === name);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("shared stock is deducted once for multiple recipes and quantities", () => {
  const plan = P.plan(state({ goals: { "AP Boost": 2, "Magic Boost": 1 }, crafted: { "AP Boost": true }, inventory: { "Power Crystal": 4, "Mythril Gem": 3 }, expand: false, moogle: 4 }));
  assert.equal(row(plan, "Power Crystal").required, 9);
  assert.equal(row(plan, "Power Crystal").missing, 5);
  assert.equal(row(plan, "Mythril Gem").missing, 0);
});
test("rank discount and Energy stack, rounding up for each craft", () => {
  const plan = P.plan(state({ goals: { "Firaga Bangle": 3 }, moogle: 7, energy: "farm", expand: false }));
  assert.equal(row(plan, "Mythril Shard").required, 6);
  assert.equal(row(plan, "Energy Shard").required, 3);
});
test("finite Energy stock is allocated without assuming unlimited modifiers", () => {
  const plan = P.plan(state({ goals: { "Firaga Bangle": 2 }, moogle: 7, inventory: { "Energy Shard": 1 }, expand: false }));
  assert.equal(row(plan, "Mythril Shard").required, 5);
  assert.equal(row(plan, "Energy Shard").required, 1);
  assert.equal(row(plan, "Energy Shard").missing, 0);
});
test("Energy and Serenity cannot combine at level 3, but can at level 4", () => {
  const input = { goals: { Ribbon: 1 }, crafted: { "Petite Ribbon": true }, energy: "farm", expand: false };
  const junior = P.plan(state({ ...input, moogle: 3 }));
  const skilled = P.plan(state({ ...input, moogle: 4 }));
  assert.equal(row(junior, "Mythril Crystal").required, 2);
  assert.equal(row(junior, "Energy Gem"), undefined);
  assert.equal(row(skilled, "Mythril Crystal").required, 1);
  assert.equal(row(skilled, "Serenity Gem").required, 1);
});
test("an upgrade adds one first-time base craft, not an equipment ingredient", () => {
  const plan = P.plan(state({ goals: { Ribbon: 2 }, moogle: 4, energy: "none", expand: false }));
  assert.equal(plan.steps.filter((s) => s.name === "Petite Ribbon").length, 1);
  assert.equal(row(plan, "Mythril Crystal").required, 6);
  assert.equal(row(plan, "Serenity Gem").required, 2);
});
test("explicit base goals satisfy upgrade prerequisites without duplicate crafts", () => {
  const plan = P.plan(state({ goals: { Ribbon: 1, "Petite Ribbon": 2 }, moogle: 4, expand: false, energy: "none" }));
  assert.equal(plan.steps.filter((s) => s.name === "Petite Ribbon").reduce((n, s) => n + s.quantity, 0), 2);
});
test("Mythril deficits expand after existing Mythril stock is used", () => {
  const plan = P.plan(state({ goals: { "Firaga Bangle": 1 }, moogle: 4, energy: "none", inventory: { "Mythril Shard": 2 } }));
  assert.equal(row(plan, "Mythril Shard").crafted, 3);
  assert.equal(row(plan, "Dense Shard").required, 9);
  assert.equal(row(plan, "Dense Stone").required, 3);
});
test("Mythril Gem synthesis is locked before level 8, not invented as a drop", () => {
  const plan = P.plan(state({ goals: { "AP Boost": 1 }, moogle: 4 }));
  assert.equal(row(plan, "Mythril Gem").locked, true);
  assert.equal(row(plan, "Dense Gem"), undefined);
  assert.equal(D.materials["Mythril Gem"].sources.length, 0);
});
test("Mythril Crystal uses a rank-B recipe and Serenity Stone modifier", () => {
  const plan = P.plan(state({ goals: { "Defense Boost": 1 }, moogle: 8, crafted: { "Mythril Gem": true }, energy: "farm" }));
  assert.equal(row(plan, "Mythril Crystal").crafted, 1);
  assert.equal(row(plan, "Dense Gem").required, 1);
  assert.equal(row(plan, "Serenity Stone").required, 1);
  assert.equal(row(plan, "Energy Stone").required, 1);
});
test("material upgrade prerequisite output can supply another material demand", () => {
  const plan = P.plan(state({ goals: { "Mythril Stone": 1, "Firaga Bangle": 1 }, moogle: 4, energy: "none" }));
  assert.equal(row(plan, "Mythril Shard").bonus, 1);
  assert.equal(row(plan, "Mythril Shard").crafted, 4);
});
test("Ultima always budgets Energy and seven Orichalcum+, even at level 9", () => {
  for (const moogle of [2, 9]) {
    const plan = P.plan(state({ goals: { "Ultima Weapon": 1 }, moogle, energy: "none", expand: false }));
    assert.equal(row(plan, "Orichalcum+").required, 7);
    assert.equal(row(plan, "Energy Crystal").required, 1);
  }
});
test("world and optional gates both apply to farming routes", () => {
  const route = D.materials["Remembrance Crystal"].sources[0];
  assert.equal(P.availability(route, state()).available, false);
  assert.equal(P.availability(route, state({ worlds: { co: 2, hb: 2 } })).available, true);
  const mushroom = D.materials["Tranquility Crystal"].sources[0];
  assert.equal(P.availability(mushroom, state({ worlds: { ag: 2 } })).available, false);
  assert.equal(P.availability(mushroom, state({ worlds: { ag: 2 }, optional: { mushrooms: true } })).available, true);
});
test("chest completion never adds stock or creates chest routes", () => {
  const a = state({ goals: { "AP Boost": 1 }, moogle: 4 });
  const b = { ...a, chests: Object.fromEntries(D.worlds.map((w) => [w.id, true])) };
  assert.deepEqual(plain(P.plan(a)), plain(P.plan(b)));
});
test("Final Mix Serenity Crystal sources exclude original KH2 Nobody drops", () => {
  assert.ok(D.materials["Serenity Crystal"].sources.every((s) => s.enemy === "Bulky Vendor"));
});
test("invalid save data is constrained to known names and safe integer counts", () => {
  const clean = P.sanitize({ version: 1, moogle: 500, goals: { "AP Boost": -10, fake: 50 }, inventory: { "Dark Shard": 2.8 }, worlds: { ld: 999 }, optional: { data: "true" } });
  assert.equal(clean.moogle, 9);
  assert.equal(clean.goals["AP Boost"], 0);
  assert.equal(clean.goals.fake, undefined);
  assert.equal(clean.inventory["Dark Shard"], 2);
  assert.equal(clean.worlds.ld, 2);
  assert.equal(clean.optional.data, false);
  assert.throws(() => P.sanitize({ version: 2 }));
});
test("recipe OCR recognizes sample names, including dim rows and plus variants", () => {
  const parsed = R.parseLines(["AP Boost", "Defense Boost", "Petite Ribbon", "Shock Charm", "Shadow Archive", "Save the Queen", "Save the King", "Ultima Weapon", "Mythril Shard", "Acrisius", "Save the King +"], "recipes");
  assert.equal(parsed.rows.length, 11);
  assert.equal(parsed.rows.at(-1).name, "Save the King+");
});
test("inventory OCR preserves Orichalcum+ and allows zero counts", () => {
  const parsed = R.parseLines(["C Dense Shard 4", "Orichalcum + 2", "Frost Crystal 0", "Energy Crystal"], "inventory");
  assert.deepEqual(plain(parsed.rows.map((r) => [r.name, r.quantity])), [["Dense Shard", 4], ["Orichalcum+", 2], ["Frost Crystal", 0], ["Energy Crystal", null]]);
});
test("video overlaps are not summed and conflicting quantities require review", () => {
  const parsed = R.parseLines(["Dense Shard 4", "Dense Shard 4", "Dense Shard 41", "Frost Crystal 1", "Frost Crystal 1"], "inventory");
  const merged = R.merge(parsed.rows);
  const dense = merged.find((r) => r.name === "Dense Shard");
  assert.equal(dense.quantity, 4);
  assert.equal(dense.checked, false);
  assert.equal(dense.conflict, true);
  assert.equal(merged.find((r) => r.name === "Frost Crystal").quantity, 1);
});
test("unreadable counts and unrelated menu headings do not become stock", () => {
  const parsed = R.parseLines(["Materials", "SYNTHESIS", "Moogle LV 4", "Dense Shard"], "inventory");
  assert.equal(parsed.rows.length, 1);
  assert.equal(R.merge(parsed.rows)[0].checked, false);
});
test("loading a save preserves goal priority and finite Energy allocation", () => {
  const original = state({ goals: { "Save the King": 1, "AP Boost": 1 }, moogle: 4, inventory: { "Energy Crystal": 1 }, expand: false });
  const restored = P.sanitize(plain(original));
  assert.deepEqual(Object.keys(restored.goals), ["Save the King", "AP Boost"]);
  assert.deepEqual(plain(P.plan(restored).requirements), plain(P.plan(original).requirements));
});
test("one isolated video count is not preselected; repeated agreement can be", () => {
  const parsed = R.parseLines(["Dense Shard 4", "Dense Shard 4", "Frost Crystal 1"], "inventory");
  const merged = R.merge(parsed.rows, 2);
  assert.equal(merged.find((r) => r.name === "Dense Shard").checked, true);
  assert.equal(merged.find((r) => r.name === "Frost Crystal").checked, false);
});

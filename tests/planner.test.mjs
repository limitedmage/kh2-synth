import { test } from "node:test";
import assert from "node:assert/strict";
import D from "../src/data.js";
import P from "../src/planner.js";
import R from "../src/recognition.js";
const state = (overrides = {}) => ({ ...P.defaults(), materialTypes: 60, ...overrides });
const row = (plan, name) => plan.requirements.find((r) => r.name === name);
const plain = (value) => JSON.parse(JSON.stringify(value));

test("Final Mix Lucky Lucky adds half the base rate per ability, preserving fractional percentages", () => {
  assert.equal(P.effectiveDropRate(3, 0), 3);
  assert.equal(P.effectiveDropRate(3, 1), 4.5);
  assert.equal(P.effectiveDropRate(3, 3), 7.5);
  assert.equal(P.effectiveDropRate(2.345, 1), 3.52);
  assert.equal(P.effectiveDropRate(10, 30), 100);
  assert.equal(P.effectiveDropRate(0, 30), 0);
  for (const unknown of [null, undefined, NaN, "unknown"]) assert.equal(P.effectiveDropRate(unknown, 3), null);
});
test("Lucky Lucky updates every planned route without changing source base rates or unknown rates", () => {
  const options = { goals: { "Firaga Bangle": 1, "Save the King": 1 }, moogle: 9, expand: false };
  const sources = JSON.stringify(D.materials);
  const baseline = P.plan(state(options)).routes.flatMap((route) => route.materials);
  const boosted = P.plan(state({ ...options, luckyLuckyCount: 3 })).routes.flatMap((route) => route.materials);
  assert.ok(baseline.some((material) => material.rate !== null));
  assert.ok(baseline.some((material) => material.rate === null));
  for (let i = 0; i < boosted.length; i++) {
    assert.equal(baseline[i].effectiveRate, baseline[i].rate);
    assert.equal(boosted[i].rate, baseline[i].rate);
    assert.equal(boosted[i].effectiveRate, boosted[i].rate === null ? null : Math.min(100, boosted[i].rate * 2.5));
  }
  assert.equal(JSON.stringify(D.materials), sources);
});
test("Lucky Lucky defaults and sanitized counts survive JSON save export/import", () => {
  assert.equal(P.defaults().luckyLuckyCount, 0);
  assert.equal(P.sanitize({ version: 1 }).luckyLuckyCount, 0);
  for (const [input, expected] of [[4, 4], ["6", 6], [3.9, 3], [-2, 0], ["invalid", 0], [null, 0]]) {
    const restored = P.sanitize(plain(state({ luckyLuckyCount: input })));
    assert.equal(restored.luckyLuckyCount, expected);
    assert.equal(P.sanitize(plain(restored)).luckyLuckyCount, expected);
  }
});

test("shared stock is deducted once for multiple recipes and quantities", () => {
  const plan = P.plan(state({ goals: { "AP Boost": 2, "Magic Boost": 1 }, crafted: { "AP Boost": true }, inventory: { "Power Crystal": 4, "Mythril Gem": 3 }, expand: false, moogle: 4 }));
  assert.equal(row(plan, "Power Crystal").required, 9);
  assert.equal(row(plan, "Power Crystal").missing, 5);
  assert.equal(row(plan, "Mythril Gem").missing, 0);
});
const stocked = (overrides = {}) => Object.fromEntries(D.materialNames.map((name) => [name, overrides[name] ?? 999]));
test("wishlist conflicts warn each individually craftable recipe only when shared stock runs short", () => {
  const input = state({ goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1 }, inventory: stocked({ "Mythril Shard": 5 }), expand: false, energy: "none" });
  const original = plain(input);
  const conflicts = P.wishlistConflicts(input);
  assert.deepEqual([...conflicts.keys()], ["Firaga Bangle", "Blizzaga Armlet"]);
  assert.deepEqual(plain(conflicts.get("Firaga Bangle")), {
    materials: [{ name: "Mythril Shard", before: 0, after: 5 }], items: ["Blizzaga Armlet"],
  });
  assert.deepEqual(plain(input), original);
  assert.equal(P.wishlistConflicts({ ...input, inventory: stocked({ "Mythril Shard": 10 }) }).size, 0);
});
test("wishlist conflicts ignore unrelated shortages and recipes outside a conflicting pair", () => {
  const input = state({
    goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1, "Defense Boost": 1 },
    inventory: stocked({ "Mythril Shard": 5 }), expand: false, energy: "none",
  });
  assert.deepEqual([...P.wishlistConflicts(input).keys()], ["Firaga Bangle", "Blizzaga Armlet"]);
  assert.equal(P.wishlistConflicts({ ...input, goals: { "Firaga Bangle": 1, "Defense Boost": 1 }, inventory: stocked({ "Blazing Crystal": 0 }) }).size, 0);
});
test("wishlist conflicts detect increased existing shared shortages but not unavailable crafts", () => {
  const input = state({
    goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1 },
    inventory: stocked({ "Mythril Shard": 5, "Frost Stone": 0 }), expand: false, energy: "none",
  });
  assert.deepEqual([...P.wishlistConflicts(input).keys()], ["Firaga Bangle"]);
  assert.deepEqual(plain(P.wishlistConflicts(input).get("Firaga Bangle").materials), [{ name: "Mythril Shard", before: 0, after: 5 }]);
  const three = { ...input, goals: { ...input.goals, "Thundaga Trinket": 1 }, inventory: stocked({ "Mythril Shard": 5 }) };
  assert.deepEqual(plain(P.wishlistConflicts(three).get("Firaga Bangle").materials), [{ name: "Mythril Shard", before: 5, after: 10 }]);
});
test("wishlist conflicts honor Moogle discounts and finite or selected Energy costs", () => {
  const input = state({
    goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1 }, moogle: 5, expand: false,
    inventory: stocked({ "Mythril Shard": 5, "Energy Shard": 1 }),
  });
  assert.equal(P.wishlistConflicts(input).size, 0);
  assert.equal(P.wishlistConflicts({ ...input, inventory: stocked({ "Mythril Shard": 3, "Energy Shard": 1 }) }).size, 2);
  assert.equal(P.wishlistConflicts({ ...input, energy: "none", inventory: stocked({ "Mythril Shard": 6 }) }).size, 0);
  assert.equal(P.wishlistConflicts({ ...input, energy: "farm", inventory: stocked({ "Mythril Shard": 4, "Energy Shard": 1 }) }).size, 2);
});
test("wishlist conflicts simulate synthesized Mythril rather than consuming nonexistent intermediate stock", () => {
  const input = state({
    goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1 }, energy: "none",
    inventory: stocked({ "Mythril Shard": 0, "Dense Stone": 5, "Dense Shard": 15, "Twilight Stone": 5, "Twilight Shard": 15 }),
  });
  const conflict = P.wishlistConflicts(input).get("Firaga Bangle");
  assert.ok(conflict);
  assert.deepEqual(plain(conflict.items), ["Blizzaga Armlet"]);
  assert.deepEqual(plain(conflict.materials.map((material) => material.name)).sort(), ["Dense Shard", "Dense Stone", "Twilight Shard", "Twilight Stone"]);
  assert.equal(P.wishlistConflicts({ ...input, inventory: stocked({ "Mythril Shard": 0, "Dense Stone": 10, "Dense Shard": 30, "Twilight Stone": 10, "Twilight Shard": 30 }) }).size, 0);
});
test("wishlist conflicts preserve shared first-time prerequisites and suppress locked candidates", () => {
  const input = state({
    goals: { Ribbon: 1, "Petite Ribbon": 1 }, moogle: 4, energy: "none", expand: false,
    inventory: stocked({ "Mythril Crystal": 4 }),
  });
  assert.equal(P.wishlistConflicts(input).size, 0);
  const unrelatedShortage = { ...input, goals: { ...input.goals, "AP Boost": 1 }, inventory: stocked({ "Mythril Crystal": 4, "Power Crystal": 0 }) };
  assert.equal(P.wishlistConflicts(unrelatedShortage).has("Ribbon"), false);
  assert.equal(P.wishlistConflicts(unrelatedShortage).has("Petite Ribbon"), false);
  assert.equal(P.wishlistConflicts({ ...input, moogle: 1, inventory: {} }).size, 0);
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
test("wishlist step attribution retains rank discounts and finite Energy across goals", () => {
  const plan = P.plan(state({ goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1 }, moogle: 7, inventory: { "Energy Shard": 1 }, expand: false }));
  const first = plan.steps.find((step) => step.goal === "Firaga Bangle");
  const second = plan.steps.find((step) => step.goal === "Blizzaga Armlet");
  assert.equal(first.ingredients["Mythril Shard"], 2);
  assert.equal(first.ingredients["Energy Shard"], 1);
  assert.equal(second.ingredients["Mythril Shard"], 3);
  assert.equal(second.ingredients["Energy Shard"], 0);
  assert.equal(row(plan, "Mythril Shard").required, first.ingredients["Mythril Shard"] + second.ingredients["Mythril Shard"]);
});
test("wishlist step attribution includes implicit prerequisites but respects separate base goals", () => {
  const options = { goals: { Ribbon: 1 }, moogle: 3, expand: false, energy: "none" };
  const implicit = P.plan(state(options));
  assert.deepEqual(plain(implicit.steps.map((step) => [step.name, step.goal])), [["Petite Ribbon", "Ribbon"], ["Ribbon", "Ribbon"]]);
  assert.equal(implicit.steps.reduce((sum, step) => sum + step.ingredients["Mythril Crystal"], 0), 4);
  const made = P.plan(state({ ...options, crafted: { "Petite Ribbon": true } }));
  assert.equal(made.steps.length, 1);
  assert.equal(made.steps[0].ingredients["Mythril Crystal"], 2);
  const explicit = P.plan(state({ ...options, goals: { Ribbon: 1, "Petite Ribbon": 1 } }));
  assert.deepEqual(plain(explicit.steps.map((step) => [step.name, step.goal])), [["Petite Ribbon", "Petite Ribbon"], ["Ribbon", "Ribbon"]]);
});
test("shared material synthesis remains separate from wishlist root ingredient costs", () => {
  const plan = P.plan(state({ goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1 }, moogle: 4, energy: "none", inventory: { "Mythril Shard": 2 } }));
  const expanded = plan.steps.filter((step) => step.purpose === "Missing material");
  assert.equal(expanded.length, 1);
  assert.equal(expanded[0].goal, null);
  assert.equal(expanded[0].quantity, 8);
  assert.equal(row(plan, "Mythril Shard").required, 10);
  assert.equal(row(plan, "Mythril Shard").crafted, 8);
  assert.equal(row(plan, "Dense Shard").required, 24);
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
test("review images come from the best source matching the displayed count, even with conflicting readings", () => {
  const parsed = R.parseLines(["Dense Shard 4", "Dense Shard 4", "Dense Shard 41"], "inventory");
  for (const [i, reading] of parsed.rows.entries()) {
    reading.confidence = [70, 80, 95][i];
    reading.image = `image-${i}`;
    reading.source = `frame-${i}`;
  }
  const [merged] = R.merge(parsed.rows);
  assert.equal(merged.quantity, 4);
  assert.equal(merged.image, "image-1");
  assert.equal(merged.source, "frame-1");
});
test("unreadable counts keep a source image, while pasted text has no image", () => {
  const parsed = R.parseLines(["Energy Crystal"], "inventory");
  assert.equal(R.merge(parsed.rows)[0].image, undefined);
  parsed.rows[0].image = "unreadable-count-image";
  parsed.rows[0].source = "Photo, column 1";
  const [merged] = R.merge(parsed.rows);
  assert.equal(merged.quantity, null);
  assert.equal(merged.image, "unreadable-count-image");
  assert.equal(merged.source, "Photo, column 1");
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
test("legacy wishlist quantities normalize to one without changing stock or settings", () => {
  const original = state({
    goals: { "Save the King": 12, "AP Boost": "3", "Ultima Weapon": 99 },
    inventory: { "Energy Crystal": 17, "Dark Shard": 234 },
    moogle: 7, energy: "none", expand: false, worlds: { hb: 2 },
    crafted: { "AP Boost": true }, methods: { "Mythril Gem": "collect" },
  });
  const restored = P.sanitize(plain(original));
  assert.deepEqual(plain(restored.goals), { "Save the King": 1, "AP Boost": 1, "Ultima Weapon": 1 });
  assert.deepEqual(Object.keys(restored.goals), Object.keys(original.goals));
  assert.deepEqual(plain(restored.inventory), original.inventory);
  for (const key of ["moogle", "energy", "expand", "materialTypes"]) assert.equal(restored[key], original[key]);
  assert.equal(restored.worlds.hb, 2);
  assert.equal(restored.crafted["AP Boost"], true);
  assert.equal(restored.methods["Mythril Gem"], "collect");
  assert.deepEqual(plain(P.sanitize(plain(restored))), plain(restored));
});
test("one isolated video count is not preselected; repeated agreement can be", () => {
  const parsed = R.parseLines(["Dense Shard 4", "Dense Shard 4", "Frost Crystal 1"], "inventory");
  const merged = R.merge(parsed.rows, 2);
  assert.equal(merged.find((r) => r.name === "Dense Shard").checked, true);
  assert.equal(merged.find((r) => r.name === "Frost Crystal").checked, false);
});
test("recipe name parsing ignores the right-hand ingredient / stock rows", () => {
  const parsed = R.parseLines(["AP Boost", "Mythril Gem 1 2", "Serenity Crystal 3", "Mythril Shard", "Acrisius"], "recipes");
  assert.deepEqual(plain(parsed.rows.map((r) => r.name)), ["AP Boost", "Mythril Shard", "Acrisius"]);
});

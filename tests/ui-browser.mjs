import { chromium } from "playwright";
import assert from "node:assert/strict";

const journal = new URL("../index.html", import.meta.url).href;
const storageKey = "kh2-final-mix-synthesis-v1";
const browser = await chromium.launch({ headless: true });
const errors = [];
const contexts = [];

async function open(fragment = "plan", overrides = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  contexts.push(context);
  await context.addInitScript(({ key, save }) => {
    if (!localStorage.getItem(key)) localStorage.setItem(key, JSON.stringify(save));
  }, {
    key: storageKey,
    save: { version: 1, materialTypes: 60, ...overrides },
  });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${journal}#${fragment}`);
  return page;
}

const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key)), storageKey);
const goal = (page, name) => page.locator(".goal").filter({ has: page.locator(".goal-name").getByText(name, { exact: true }) });

async function expectReady(page, name, amount, status) {
  const row = goal(page, name);
  assert.equal(await row.getAttribute("data-craftable"), String(amount), `${name}: ready quantity`);
  assert.ok((await row.getAttribute("class")).split(/\s+/).includes(`craftability-${status}`), `${name}: ${status}`);
  const readyIcon = row.locator('svg[aria-label="Ready to craft"]');
  assert.equal(await readyIcon.count(), status === "ready" ? 1 : 0, `${name}: accessible ready indicator`);
  if (status !== "ready") assert.equal(await row.locator(".craft-conflict").count(), 0, `${name}: missing or locked recipes must not show shared-stock advisories`);
  assert.match(await row.locator("[data-remove]").getAttribute("aria-label"), new RegExp(name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "Remove button must name its recipe");
}

async function expectIngredient(page, recipe, material, owned, required) {
  const token = goal(page, recipe).locator(`.goal-ingredients .wishlist-ingredient[data-material="${material}"]`);
  assert.equal(await token.getAttribute("data-owned"), String(owned), `${recipe}: ${material} owned stock`);
  assert.equal(await token.getAttribute("data-required"), String(required), `${recipe}: ${material} planned cost`);
  assert.equal(await token.getAttribute("aria-label"), `${material}: ${owned} owned / ${required} required`);
}

async function expectIngredientLayout(page) {
  const rows = await page.locator("#goals .goal").evaluateAll((goals) => goals.map((goal) => {
    const main = goal.querySelector(".goal-main");
    const ingredients = goal.querySelector(".goal-ingredients");
    if (!main || !ingredients) return { recipe: goal.dataset.goal, valid: false };
    const style = getComputedStyle(ingredients);
    return {
      recipe: goal.dataset.goal, valid: true,
      below: ingredients.getBoundingClientRect().top >= main.getBoundingClientRect().bottom - 1,
      wrap: style.flexWrap, overflow: style.overflowX,
      fits: ingredients.scrollWidth <= ingredients.clientWidth + 1,
      lines: new Set([...ingredients.querySelectorAll(".wishlist-ingredient")].map((token) => Math.round(token.getBoundingClientRect().top))).size,
    };
  }));
  assert.ok(rows.length > 0);
  for (const row of rows) {
    assert.ok(row.valid && row.below, `${row.recipe}: ingredients must occupy a separate row below the title and controls`);
    assert.equal(row.wrap, "wrap", `${row.recipe}: ingredients must wrap naturally`);
    assert.equal(row.overflow, "visible", `${row.recipe}: ingredients must not use a horizontal scroll region`);
    assert.ok(row.fits, `${row.recipe}: ingredient content must fit its row`);
  }
  if (page.viewportSize().width <= 390) assert.ok(rows.some((row) => row.lines > 1), "Phone ingredient chips must wrap onto distinct rows rather than overflow");
}

async function expectTab(page, name, fragment) {
  await page.waitForURL(`${journal}#${fragment}`);
  await page.locator(`#tab-${name}`).waitFor({ state: "visible" });
  assert.deepEqual(await page.locator("main > section:visible").evaluateAll((sections) => sections.map((section) => section.id)), [`tab-${name}`]);
  const current = page.locator("[data-tab][aria-current='page']");
  assert.equal(await current.count(), 1);
  assert.equal(await current.getAttribute("data-tab"), name);
  assert.equal(await current.getAttribute("aria-controls"), `tab-${name}`);
  assert.equal(await page.locator(`#tab-${name}`).getAttribute("aria-labelledby"), await current.getAttribute("id"));
  assert.ok((await current.getAttribute("class")).split(/\s+/).includes("active"));
}

async function expectIcons(page, selector) {
  const icons = page.locator(`${selector} svg.kh-icon`);
  assert.ok(await icons.count() > 0, `Icons must appear in ${selector}`);
  assert.ok(await icons.evaluateAll((items) => items.every((svg) =>
    svg.getAttribute("aria-hidden") === "true" &&
    svg.getAttribute("focusable") === "false" &&
    svg.querySelector("path, polygon, rect, circle, ellipse, line, polyline"),
  )), `Icons in ${selector} must have geometry and remain decorative`);
}

async function expectMobileLayout(page, name) {
  await page.locator(`[data-tab="${name}"]`).click();
  const layout = await page.evaluate(() => {
    const width = document.documentElement.clientWidth;
    const controls = [...document.querySelectorAll("main > section:not([hidden]) button, main > section:not([hidden]) input, main > section:not([hidden]) select")]
      .filter((element) => element.getClientRects().length && !element.closest(".table-wrap"))
      .filter((element) => {
        const bounds = element.getBoundingClientRect();
        return bounds.left < -1 || bounds.right > width + 1;
      })
      .map((element) => element.id || element.outerHTML);
    return { width, scrollWidth: document.documentElement.scrollWidth, controls };
  });
  assert.ok(layout.scrollWidth <= layout.width + 1, `${name}: page must not overflow at 390px (${layout.scrollWidth}px)`);
  assert.deepEqual(layout.controls, [], `${name}: controls must fit the viewport; only navigation and material tables may scroll horizontally`);
  if (name === "plan") await expectIngredientLayout(page);
}

try {
  const stock = {
    "Mythril Shard": 5, "Blazing Stone": 3, "Blazing Shard": 1,
    "Frost Stone": 1, "Frost Shard": 1,
  };
  const wishlist = await open("plan", {
    goals: { "Firaga Bangle": 99, "Blizzaga Armlet": 1 },
    inventory: stock, moogle: 1, energy: "none", expand: false,
  });
  assert.equal(await wishlist.locator("#crafting").count(), 0, "Removed crafting notes must not leave an empty container");
  assert.equal(await wishlist.getByText("Crafting order & notes", { exact: true }).count(), 0);
  const appCopy = (await wishlist.locator("header, main").allTextContents()).join(" ");
  for (const removed of [
    "LOCAL SAVE",
    "Count equipped copies in the active party, including equipment. Final Mix: each adds 50% of the base drop rate; effective rates cap at 100%. Ability source.",
    "One of each recipe. Ratios show inventory owned / required, including surplus. Item costs include first-time prerequisites. Moogle / Energy settings apply across the list. Checkmarks share finite stock; warnings flag crafting that increases another item's shortfall. Inventory is unchanged.",
    "Open routes first; locked routes show their requirements.",
    "Plan the craft. Find the missing pieces.",
    "A crafting and farming planner for your next adventure.",
    "Adding a recipe assumes its document is owned. Cards show other unlocks. Upgrades include one base craft unless marked already made.",
    "Chest routes are not planned.",
  ]) assert.ok(!appCopy.includes(removed), `Requested copy must remain absent: ${removed}`);
  await expectReady(wishlist, "Firaga Bangle", 1, "ready");
  await expectReady(wishlist, "Blizzaga Armlet", 0, "missing");
  const warningLabel = await goal(wishlist, "Firaga Bangle").locator(".craft-conflict > summary").getAttribute("aria-label");
  for (const text of ["Shared materials warning", "Firaga Bangle", "Blizzaga Armlet", "Mythril Shard"]) {
    assert.ok(warningLabel.includes(text), `Ready recipe conflict warning must describe ${text}`);
  }
  const conflict = goal(wishlist, "Firaga Bangle").locator(".craft-conflict");
  await conflict.locator("summary").click();
  assert.ok(await conflict.evaluate((details) => details.open), "Shared-stock warnings must expand by keyboard/touch-native details");
  await expectIngredient(wishlist, "Firaga Bangle", "Blazing Stone", 3, 1);
  await expectIngredientLayout(wishlist);
  assert.equal(await wishlist.locator(".wishlist-totals").count(), 0, "Wishlist must not duplicate the combined Materials to collect table");
  assert.deepEqual((await saved(wishlist)).goals, { "Firaga Bangle": 1, "Blizzaga Armlet": 1 }, "Legacy quantities must persist as one of each recipe");
  assert.equal(await wishlist.locator("input[data-goal]").count(), 0, "Wishlist must not expose quantity controls");
  await expectIcons(wishlist, "#goals .goal-name");
  await expectIcons(wishlist, "#requirements");
  assert.deepEqual((await saved(wishlist)).inventory, stock, "Readiness must not consume shared stock");
  const beforeRowClick = await saved(wishlist);
  await goal(wishlist, "Firaga Bangle").locator(".goal-name").click();
  assert.deepEqual(await saved(wishlist), beforeRowClick, "Clicking a wishlist recipe must not craft it or change the save");
  await wishlist.locator('[data-remove="Firaga Bangle"]').click();
  await expectReady(wishlist, "Blizzaga Armlet", 1, "ready");
  assert.equal(await wishlist.locator("#goals .craft-conflict").count(), 0, "Removing a conflicting wish must clear its shared-stock advisory");
  assert.deepEqual((await saved(wishlist)).inventory, stock, "Removing a wish must free the reservation without consuming inventory");

  await wishlist.locator('[data-tab="recipes"]').click();
  await expectIcons(wishlist, "#recipe-list");
  await wishlist.locator('[data-add="Blizzaga Armlet"]').click();
  await wishlist.locator('[data-add="Blizzaga Armlet"]').click();
  assert.equal((await saved(wishlist)).goals["Blizzaga Armlet"], 1, "Repeated Add must remain one recipe");
  await wishlist.locator('[data-tab="inventory"]').click();
  await expectIcons(wishlist, "#inventory-list");
  await wishlist.setViewportSize({ width: 390, height: 844 });
  for (const name of ["plan", "recipes", "inventory", "progress"]) await expectMobileLayout(wishlist, name);
  assert.deepEqual((await saved(wishlist)).inventory, stock, "Navigation and responsive rendering must not change stock");
  console.log("PASS wishlist: one-of-each migration, shared stock, unchanged inventory, idempotent Add, icons, 390px layouts");

  const sufficient = await open("plan", {
    goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1 },
    inventory: { ...stock, "Mythril Shard": 10 }, moogle: 1, energy: "none", expand: false,
  });
  await expectReady(sufficient, "Firaga Bangle", 1, "ready");
  await expectReady(sufficient, "Blizzaga Armlet", 1, "ready");
  assert.equal(await sufficient.locator("#goals .craft-conflict").count(), 0, "Sufficient shared stock must not show conflict warnings");
  console.log("PASS wishlist: advisory only on ready conflicting recipes; none on missing/locked or sufficient stock");

  const energyStock = {
    "Mythril Shard": 5, "Blazing Stone": 1, "Blazing Shard": 1,
    "Frost Stone": 1, "Frost Shard": 1, "Energy Shard": 1,
  };
  const energy = await open("plan", {
    goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1 },
    inventory: energyStock, moogle: 7, energy: "owned", expand: false,
  });
  await expectReady(energy, "Firaga Bangle", 1, "ready");
  await expectReady(energy, "Blizzaga Armlet", 1, "ready");
  await expectIngredient(energy, "Firaga Bangle", "Mythril Shard", 5, 2);
  await expectIngredient(energy, "Blizzaga Armlet", "Mythril Shard", 5, 3);
  await expectIngredient(energy, "Firaga Bangle", "Energy Shard", 1, 1);
  assert.equal(await goal(energy, "Blizzaga Armlet").locator('.goal-ingredients [data-material="Energy Shard"]').count(), 0, "Finite Energy must not appear in both root costs");
  await energy.locator("#energy").selectOption("none");
  await expectReady(energy, "Firaga Bangle", 1, "ready");
  await expectReady(energy, "Blizzaga Armlet", 0, "missing");
  await energy.locator("#energy").selectOption("farm");
  await expectReady(energy, "Firaga Bangle", 1, "ready");
  await expectReady(energy, "Blizzaga Armlet", 0, "missing");
  await energy.locator("#energy").selectOption("owned");
  await energy.locator("#moogle").selectOption("1");
  await expectReady(energy, "Firaga Bangle", 1, "ready");
  await expectReady(energy, "Blizzaga Armlet", 0, "missing");
  await energy.locator("#moogle").selectOption("5");
  await expectReady(energy, "Firaga Bangle", 1, "ready");
  await expectReady(energy, "Blizzaga Armlet", 1, "ready");
  await energy.locator("#energy").selectOption("none");
  await expectReady(energy, "Blizzaga Armlet", 0, "missing");
  assert.deepEqual((await saved(energy)).inventory, energyStock, "Moogle/Energy allocation must leave inventory unchanged");
  await energy.reload();
  await expectReady(energy, "Blizzaga Armlet", 0, "missing");
  assert.deepEqual((await saved(energy)).inventory, energyStock);
  console.log("PASS wishlist: Moogle discounts, finite/shared Energy, farming is not owned stock, reload");

  const upgrade = await open("plan", {
    goals: { Ribbon: 1 }, moogle: 3, energy: "none", expand: false,
    inventory: { "Mythril Crystal": 2, Orichalcum: 1, "Dense Stone": 1, "Dense Shard": 1, "Serenity Gem": 1 },
  });
  await expectReady(upgrade, "Ribbon", 0, "missing");
  await expectIngredient(upgrade, "Ribbon", "Mythril Crystal", 2, 4);
  await upgrade.locator('#goals [data-crafted="Petite Ribbon"]').check();
  await expectReady(upgrade, "Ribbon", 1, "ready");
  await expectIngredient(upgrade, "Ribbon", "Mythril Crystal", 2, 2);
  await upgrade.locator("#moogle").selectOption("2");
  await expectReady(upgrade, "Ribbon", 0, "locked");
  console.log("PASS wishlist: first-craft prerequisite and upgrade Moogle gate");

  const lucky = await open("plan", {
    goals: { "Firaga Bangle": 1 }, inventory: {}, moogle: 1, energy: "none", expand: false,
  });
  assert.equal(await lucky.locator("#lucky-lucky-help").count(), 0);
  assert.ok(!(await lucky.locator("#lucky-lucky").getAttribute("aria-describedby") || "").split(/\s+/).includes("lucky-lucky-help"), "Lucky Lucky must not reference removed help text");
  const expectRate = async (enemy, effective, base) => {
    const route = lucky.locator(".route-item").filter({ has: lucky.getByRole("link", { name: enemy, exact: true }) }).first();
    const rates = await route.locator(".drop-material small").allTextContents();
    assert.ok(rates.some((text) => text.includes(`${effective}% effective`) && text.includes(`${base}% base`)), `${enemy}: effective and original drop rates must both be visible`);
  };
  await expectRate("Minute Bomb", 6, 6);
  await lucky.locator("#lucky-lucky").fill("3");
  await lucky.locator("#lucky-lucky").blur();
  await expectRate("Minute Bomb", 15, 6);
  await expectRate("Hammer Frame", 25, 10);
  assert.equal((await saved(lucky)).luckyLuckyCount, 3);
  assert.deepEqual((await saved(lucky)).inventory, {}, "Lucky Lucky must not change inventory");
  assert.deepEqual((await saved(lucky)).goals, { "Firaga Bangle": 1 }, "Lucky Lucky must not change wishes");
  await lucky.reload();
  assert.equal(await lucky.locator("#lucky-lucky").inputValue(), "3");
  await expectRate("Minute Bomb", 15, 6);
  await expectRate("Hammer Frame", 25, 10);
  const exported = await lucky.evaluate(async () => {
    const createURL = URL.createObjectURL;
    const anchorClick = HTMLAnchorElement.prototype.click;
    let exportedBlob;
    try {
      URL.createObjectURL = (blob) => { exportedBlob = blob; return "blob:ui-export-check"; };
      HTMLAnchorElement.prototype.click = function () {};
      document.getElementById("export").click();
      return JSON.parse(await exportedBlob.text());
    } finally {
      URL.createObjectURL = createURL;
      HTMLAnchorElement.prototype.click = anchorClick;
    }
  });
  assert.equal(exported.luckyLuckyCount, 3, "Exported save must include Lucky Lucky");
  lucky.once("dialog", (dialog) => dialog.accept());
  await lucky.locator("#load-save").setInputFiles({
    name: "lucky-lucky-save.json", mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ ...exported, luckyLuckyCount: 4 })),
  });
  await lucky.waitForFunction(() => document.getElementById("lucky-lucky").value === "4");
  await expectRate("Minute Bomb", 18, 6);
  await expectRate("Hammer Frame", 30, 10);
  assert.equal((await saved(lucky)).luckyLuckyCount, 4, "Imported Lucky Lucky must be saved and rendered");
  assert.deepEqual((await saved(lucky)).inventory, exported.inventory);
  assert.deepEqual((await saved(lucky)).goals, exported.goals);
  await lucky.reload();
  assert.equal(await lucky.locator("#lucky-lucky").inputValue(), "4");
  await expectRate("Minute Bomb", 18, 6);
  console.log("PASS Lucky Lucky: effective/base rates, unchanged stock/goals, reload, export/import");

  const navigation = await open("materials");
  await expectTab(navigation, "inventory", "materials");
  await navigation.reload();
  await expectTab(navigation, "inventory", "materials");
  await navigation.locator('[data-tab="recipes"]').click();
  await expectTab(navigation, "recipes", "recipes");
  await navigation.locator('[data-tab="progress"]').click();
  await expectTab(navigation, "progress", "world-progress");
  await navigation.goBack();
  await expectTab(navigation, "recipes", "recipes");
  await navigation.goBack();
  await expectTab(navigation, "inventory", "materials");
  await navigation.goForward();
  await expectTab(navigation, "recipes", "recipes");
  await navigation.evaluate(() => { location.hash = "unknown-section"; });
  await expectTab(navigation, "plan", "plan");
  await navigation.evaluate(() => { location.hash = "import"; });
  await expectTab(navigation, "import", "import");
  const unknown = await open("unknown-section");
  await expectTab(unknown, "plan", "plan");
  await unknown.reload();
  await expectTab(unknown, "plan", "plan");
  console.log("PASS navigation: initial fragments, reload, back/forward, hashchange, unknown fallback, accessibility");

  const progress = await open("world-progress", {
    inventory: { "Dark Shard": 17, "Orichalcum+": 2 },
    chests: { tt: true, hb: false, ld: true },
    worlds: { tt: 1, hb: 2 }, optional: { mushrooms: true },
  });
  const before = await saved(progress);
  const expected = await progress.evaluate(() => ({
    worlds: Object.fromEntries(KH2Data.worlds.map((world) => [world.id, world.stages.length - 1])),
    optional: Object.fromEntries(KH2Data.optional.map(([id]) => [id, true])),
  }));
  const chestControls = await progress.locator("[data-chests]").evaluateAll((inputs) => Object.fromEntries(inputs.map((input) => [input.dataset.chests, input.checked])));
  await progress.locator("#endgame-worlds").click();
  for (const reload of [false, true]) {
    if (reload) await progress.reload();
    const after = await saved(progress);
    assert.deepEqual(after.worlds, expected.worlds, "Endgame must use each world's actual stage maximum");
    assert.deepEqual(after.optional, expected.optional, "Endgame must unlock all optional areas");
    assert.deepEqual(after.inventory, before.inventory, "Endgame must not add or consume inventory");
    const checkedChests = await progress.locator("[data-chests]").evaluateAll((inputs) => Object.fromEntries(inputs.map((input) => [input.dataset.chests, input.checked])));
    assert.deepEqual(checkedChests, chestControls, "Endgame must preserve chest completion");
    assert.ok(Object.entries(before.chests).every(([id, value]) => after.chests[id] === value));
    assert.deepEqual(await progress.locator("[data-world]").evaluateAll((selects) => Object.fromEntries(selects.map((select) => [select.dataset.world, Number(select.value)]))), expected.worlds);
    assert.equal(await progress.locator("[data-optional]:not(:checked)").count(), 0);
    assert.equal(await progress.evaluate(() => {
      const state = KH2Planner.sanitize(JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")));
      return Object.values(KH2Data.materials).flatMap((material) => material.sources).every((source) => KH2Planner.availability(source, state).available);
    }), true, "Every farming route must be available after the endgame preset");
  }
  console.log("PASS endgame: world maxima, all areas/routes, chest/inventory preservation, persisted reload");
  assert.deepEqual(errors, [], "UI workflows must not trigger browser errors");
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}

import { chromium } from "playwright";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import data from "../src/data.js";

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

async function expectPlanLayout(page) {
  const wishlist = await page.locator("#goals").boundingBox();
  const moogle = await page.locator(".plan-console").boundingBox();
  if (page.viewportSize().width > 1000) {
    assert.ok(wishlist.x + wishlist.width <= moogle.x + 1, "Desktop wishlist and Moogle console must occupy separate columns");
  } else {
    assert.ok(moogle.y + moogle.height <= wishlist.y + 1, "Stacked controls must precede the wishlist without overlapping it");
  }
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
    svg.querySelector("image, path, polygon, rect, circle, ellipse, line, polyline"),
  )), `Icons in ${selector} must have artwork and remain decorative`);
}

async function expectExportActions(page) {
  const layout = await page.locator("#save-export").evaluate((dialog) => {
    const json = dialog.querySelector("#export-file").getBoundingClientRect();
    const copy = dialog.querySelector("#copy-save-url").getBoundingClientRect();
    const url = dialog.querySelector("#save-url").getBoundingClientRect();
    return {
      sameRow: Math.abs(json.top - copy.top) <= 1 && json.right <= copy.left,
      above: Math.max(json.bottom, copy.bottom) <= url.top,
    };
  });
  assert.ok(layout.sameRow && layout.above, "JSON export and Copy URL must sit side by side above the URL");
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
  if (name === "plan") {
    await expectIngredientLayout(page);
    await expectPlanLayout(page);
  }
}

const stock = {
  "Mythril Shard": 5, "Blazing Stone": 3, "Blazing Shard": 1,
  "Frost Stone": 1, "Frost Shard": 1,
};

async function wishlistSuite() {
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
  await expectReady(wishlist, "Blizzaga Armlet", 1, "ready");
  assert.equal(await wishlist.locator("#goals .craft-conflict").count(), 2, "Both independently ready items must warn when their materials conflict");
  const conflict = goal(wishlist, "Firaga Bangle").locator(".craft-conflict");
  assert.equal(await conflict.locator(".conflict-trigger").getAttribute("aria-label"), "Shared materials warning for Firaga Bangle");
  assert.equal(await conflict.locator(".conflict-trigger").getAttribute("title"), null, "A native text tooltip must not obscure the structured warning");
  await conflict.locator(".conflict-trigger").click();
  const warning = conflict.locator(".conflict-detail");
  assert.ok(await warning.evaluate((panel) => panel.matches(":popover-open")), "Shared-stock warnings must open by click or tap");
  assert.equal(await warning.locator("h4").innerText(), "Shared materials");
  await warning.locator("h4").click();
  assert.ok(await warning.evaluate((panel) => panel.matches(":popover-open")), "Interacting inside the warning must not dismiss it");
  assert.deepEqual(await warning.locator(".conflict-items li").allTextContents(), ["Blizzaga Armlet"]);
  assert.deepEqual(await warning.locator("tbody td.numeric").allTextContents(), ["0", "5"]);
  assert.ok((await warning.innerText()).includes("Mythril Shard"));
  await wishlist.setViewportSize({ width: 390, height: 844 });
  await warning.scrollIntoViewIfNeeded();
  const warningLayout = await warning.evaluate((panel) => {
    const bounds = panel.getBoundingClientRect();
    return {
      fits: bounds.left >= 0 && bounds.right <= document.documentElement.clientWidth,
      readable: panel.scrollWidth <= panel.clientWidth + 1,
    };
  });
  assert.ok(warningLayout.fits && warningLayout.readable, "The expanded warning and its material columns must fit a phone without horizontal scrolling");
  await wishlist.setViewportSize({ width: 1440, height: 1000 });
  await wishlist.getByRole("heading", { name: "Farming plan", exact: true }).click();
  assert.ok(!(await warning.evaluate((panel) => panel.matches(":popover-open"))), "Clicking outside the warning must dismiss it");
  await conflict.locator(".conflict-trigger").focus();
  await wishlist.keyboard.press("Enter");
  assert.ok(await warning.evaluate((panel) => panel.matches(":popover-open")), "The warning must open from the keyboard");
  await wishlist.keyboard.press("Escape");
  assert.ok(!(await warning.evaluate((panel) => panel.matches(":popover-open"))), "Escape must dismiss the warning");
  assert.ok(await conflict.locator(".conflict-trigger").evaluate((button) => button === document.activeElement), "Escape must return focus to the warning button");
  await expectIngredient(wishlist, "Firaga Bangle", "Blazing Stone", 3, 1);
  await expectIngredientLayout(wishlist);
  await expectPlanLayout(wishlist);
  assert.equal(await wishlist.locator(".wishlist-totals").count(), 0, "Wishlist must not duplicate the combined Materials to collect table");
  assert.deepEqual((await saved(wishlist)).goals, { "Firaga Bangle": 1, "Blizzaga Armlet": 1 }, "Legacy quantities must persist as one of each recipe");
  assert.equal(await wishlist.locator("input[data-goal]").count(), 0, "Wishlist must not expose quantity controls");
  await expectIcons(wishlist, "#goals .goal-name");
  await expectIcons(wishlist, "#requirements");
  assert.deepEqual(await wishlist.locator("#requirements th").allTextContents(),
    ["Material", "Needed", "Stock", "Missing", "How to supply"]);
  await wishlist.locator("#show-owned").check();
  const blazingStock = wishlist.locator("#requirements tbody tr").filter({
    has: wishlist.getByRole("link", { name: "Blazing Stone", exact: true }),
  });
  assert.deepEqual(await blazingStock.locator("td.numeric").allTextContents(), ["1", "3", "—"],
    "Stock must show the full inventory, not just the amount used by the plan");
  assert.equal(await blazingStock.locator("td").nth(4).innerText(), "Tornado Step, Cannon Gun",
    "Drop materials must list their enemies, including covered materials");
  const mythrilSupply = wishlist.locator("#requirements tbody tr").filter({
    has: wishlist.getByRole("link", { name: "Mythril Shard", exact: true }),
  });
  assert.ok((await mythrilSupply.locator("td").nth(4).innerText()).includes("No enemy drops"),
    "Chest and synthesis notes must remain for Mythril");
  assert.deepEqual((await saved(wishlist)).inventory, stock, "Readiness must not consume shared stock");
  const beforeRowClick = await saved(wishlist);
  await goal(wishlist, "Firaga Bangle").locator(".goal-name").click();
  assert.deepEqual(await saved(wishlist), beforeRowClick, "Clicking a wishlist recipe must not craft it or change the save");
  await wishlist.locator('[data-remove="Firaga Bangle"]').click();
  await expectReady(wishlist, "Blizzaga Armlet", 1, "ready");
  assert.equal(await wishlist.locator("#goals .craft-conflict").count(), 0, "Removing a conflicting wish must clear its shared-stock advisory");
  assert.deepEqual((await saved(wishlist)).inventory, stock, "Removing a wish must leave inventory unchanged");

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

  const modifier = await open("plan", {
    goals: { "Save the King+": 1 }, crafted: { "Save the King": true },
    moogle: 9, energy: "none", expand: false,
  });
  const serenitySupply = modifier.locator("#requirements tbody tr").filter({
    has: modifier.getByRole("link", { name: "Serenity Crystal", exact: true }),
  });
  assert.equal(await serenitySupply.locator("td").nth(4).innerText(), "Bulky Vendor",
    "An enemy dropping a material in several worlds must appear only once");
}

async function readinessSuite() {
  const sufficient = await open("plan", {
    goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1 },
    inventory: { ...stock, "Mythril Shard": 10 }, moogle: 1, energy: "none", expand: false,
  });
  await expectReady(sufficient, "Firaga Bangle", 1, "ready");
  await expectReady(sufficient, "Blizzaga Armlet", 1, "ready");
  assert.equal(await sufficient.locator("#goals .craft-conflict").count(), 0, "Sufficient shared stock must not show conflict warnings");
  const peers = await open("plan", {
    goals: { "Firaga Bangle": 1, "Blizzaga Armlet": 1, "Thundaga Trinket": 1 },
    inventory: { ...stock, "Frost Stone": 0, "Lightning Stone": 1, "Lightning Shard": 1 },
    moogle: 1, energy: "none", expand: false,
  });
  await expectReady(peers, "Firaga Bangle", 1, "ready");
  await expectReady(peers, "Blizzaga Armlet", 0, "missing");
  await expectReady(peers, "Thundaga Trinket", 1, "ready");
  await goal(peers, "Firaga Bangle").locator(".conflict-trigger").click();
  const peersWarning = await goal(peers, "Firaga Bangle").locator(".conflict-detail").innerText();
  assert.ok(peersWarning.includes("Thundaga Trinket") && !peersWarning.includes("Blizzaga Armlet"), "Warnings must name only other ready-to-craft items");
  await peers.keyboard.press("Escape");
  await peers.locator('[data-remove="Thundaga Trinket"]').click();
  assert.equal(await peers.locator("#goals .craft-conflict").count(), 0, "A missing peer alone must not trigger a shared-material warning");
  console.log("PASS wishlist: advisory only on ready conflicting recipes; none on missing/locked or sufficient stock");
}

async function energySuite() {
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
  await expectIngredient(energy, "Blizzaga Armlet", "Mythril Shard", 5, 2);
  await expectIngredient(energy, "Firaga Bangle", "Energy Shard", 1, 1);
  await expectIngredient(energy, "Blizzaga Armlet", "Energy Shard", 1, 1);
  await energy.locator("#energy").selectOption("none");
  await expectReady(energy, "Firaga Bangle", 1, "ready");
  await expectReady(energy, "Blizzaga Armlet", 1, "ready");
  await energy.locator("#energy").selectOption("farm");
  await expectReady(energy, "Firaga Bangle", 1, "ready");
  await expectReady(energy, "Blizzaga Armlet", 1, "ready");
  await energy.locator("#energy").selectOption("owned");
  await energy.locator("#moogle").selectOption("1");
  await expectReady(energy, "Firaga Bangle", 1, "ready");
  await expectReady(energy, "Blizzaga Armlet", 1, "ready");
  await energy.locator("#moogle").selectOption("5");
  await expectReady(energy, "Firaga Bangle", 1, "ready");
  await expectReady(energy, "Blizzaga Armlet", 1, "ready");
  await energy.locator("#energy").selectOption("none");
  await expectReady(energy, "Blizzaga Armlet", 1, "ready");
  assert.deepEqual((await saved(energy)).inventory, energyStock, "Moogle/Energy allocation must leave inventory unchanged");
  await energy.reload();
  await expectReady(energy, "Blizzaga Armlet", 1, "ready");
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
}

async function luckySuite() {
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
      document.getElementById("export-file").click();
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
}

async function saveSuite() {
  const sharing = await open("plan", {
    goals: { "AP Boost": 1, "Save the King+": 1 },
    inventory: { "Dense Shard": 17, "Orichalcum+": 3 },
    crafted: { "Save the King": true }, worlds: { tt: 2, hb: 2 },
    chests: { tt: true }, optional: { mushrooms: true },
    rewards: { [data.rewards[0].id]: true },
    moogle: 8, energy: "farm", expand: false, materialTypes: 60, luckyLuckyCount: 7,
    methods: { "Mythril Shard": "collect" },
  });
  const html = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const sharedPageURL = "https://example.test/custom/guide/index.html?source=shared";
  await sharing.route("https://example.test/custom/guide/**", (route) =>
    route.fulfill({ contentType: "text/html", body: html }));
  await sharing.goto(`${sharedPageURL}#world-progress`);
  const sharedSave = await sharing.evaluate((key) => KH2Planner.sanitize(JSON.parse(localStorage.getItem(key))), storageKey);
  await sharing.locator("#export").click();
  await sharing.waitForFunction(() => !document.getElementById("copy-save-url").disabled);
  assert.equal(await sharing.locator("#save-export button").count(), 2, "Export must offer only JSON download and URL copy, without a generation button");
  await expectExportActions(sharing);
  const magicURL = await sharing.locator("#save-url").inputValue();
  assert.ok(magicURL.startsWith(`${sharedPageURL}#save=`), "Magic URLs must keep the current host, custom path and query parameters");
  await sharing.evaluate(() => {
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: {
      writeText: async (text) => { window.copiedSaveURL = text; },
    } });
  });
  await sharing.locator("#copy-save-url").click();
  assert.equal(await sharing.evaluate(() => window.copiedSaveURL), magicURL);
  const copyStatus = sharing.locator("#save-export [role='status']");
  assert.equal(await copyStatus.innerText(), "Save URL copied.");
  assert.ok(await copyStatus.isVisible(), "Copy confirmation must appear inside the open export dialog");
  assert.ok(!(await sharing.locator("#notice").isVisible()), "Copy confirmation must not use the page-level notice");
  await sharing.evaluate(() => {
    navigator.clipboard.writeText = async () => { throw new Error("Clipboard unavailable"); };
  });
  await sharing.locator("#copy-save-url").click();
  assert.ok(await sharing.locator("#save-url").evaluate((input) =>
    input.selectionStart === 0 && input.selectionEnd === input.value.length,
  ), "When clipboard access fails, the whole URL must be selected for manual copying");
  assert.equal(await copyStatus.innerText(), "Copy the selected URL to share this save.");
  await sharing.keyboard.press("Escape");
  await sharing.locator('[data-tab="inventory"]').click();
  await sharing.getByRole("button", { name: "Increase Dark Shard stock", exact: true }).click();
  await sharing.locator("#export").click();
  assert.equal(await copyStatus.textContent(), "", "Reopening export must clear stale copy feedback");
  await sharing.waitForFunction(() => !document.getElementById("copy-save-url").disabled);
  assert.notEqual(await sharing.locator("#save-url").inputValue(), magicURL, "Reopening export must automatically generate a URL containing the latest save");
  await sharing.keyboard.press("Escape");

  const device = await browser.newContext({ viewport: { width: 390, height: 844 } });
  contexts.push(device);
  await device.route("https://example.test/custom/guide/**", (route) =>
    route.fulfill({ contentType: "text/html", body: html }));
  const receiver = await device.newPage();
  receiver.on("pageerror", (error) => errors.push(error.message));
  let acceptImport = false;
  const prompts = [];
  receiver.on("dialog", async (dialog) => {
    prompts.push(dialog.message());
    if (acceptImport) await dialog.accept();
    else await dialog.dismiss();
  });
  await receiver.goto(magicURL);
  await receiver.locator("#notice").filter({ hasText: "Save imported from URL." }).waitFor();
  assert.deepEqual(await saved(receiver), sharedSave, "A fresh device must import every saved field without confirmation");
  assert.equal(prompts.length, 0);
  assert.equal(new URL(receiver.url()).hash, "#plan", "The payload must be removed after opening the URL");
  await receiver.locator('[data-tab="inventory"]').click();
  await receiver.getByRole("button", { name: "Increase Dark Shard stock", exact: true }).click();
  const existingSave = await saved(receiver);
  await receiver.goto(magicURL);
  await receiver.locator("#notice").filter({ hasText: "Existing save kept." }).waitFor();
  assert.equal(prompts.length, 1, "An existing save must require confirmation");
  assert.deepEqual(await saved(receiver), existingSave, "Declining must preserve the entire existing save");
  acceptImport = true;
  const reloadURL = new URL(magicURL);
  reloadURL.search = "?transfer=1";
  await receiver.goto(reloadURL.href);
  await receiver.locator("#notice").filter({ hasText: "Save imported from URL." }).waitFor();
  assert.equal(prompts.length, 2);
  assert.deepEqual(await saved(receiver), sharedSave, "Accepting must replace the entire save");
  await receiver.reload();
  assert.deepEqual(await saved(receiver), sharedSave);
  assert.equal(prompts.length, 2, "Reloading must not import or prompt again");
  const invalidURL = new URL(magicURL);
  invalidURL.hash = "save=not-a-save";
  await receiver.goto(invalidURL.href);
  await receiver.locator("#notice").filter({ hasText: "Could not load save URL:" }).waitFor();
  assert.deepEqual(await saved(receiver), sharedSave, "Invalid URLs must not change existing data");
  assert.equal(prompts.length, 2, "Invalid URLs must not offer to replace valid data");
  await receiver.locator("#export").click();
  await receiver.waitForFunction(() => !document.getElementById("copy-save-url").disabled);
  await expectExportActions(receiver);
  const exportLayout = await receiver.locator("#save-export").evaluate((panel) => {
    const bounds = panel.getBoundingClientRect();
    return bounds.left >= 0 && bounds.right <= innerWidth && panel.scrollWidth <= panel.clientWidth;
  });
  assert.ok(exportLayout, "Export options and the save URL must fit a phone screen");
  console.log("PASS save URLs: full cross-device import, existing-save confirmation, cancellation, reload, invalid data, clipboard fallback, phone layout");
}

async function materialsSuite() {
  const materials = await open("materials", {
    inventory: { "Dark Shard": 0, "Dense Crystal": 9999, "Blazing Stone": 7 },
  });
  const darkStock = materials.getByRole("spinbutton", { name: "Dark Shard current stock", exact: true });
  const increaseStock = materials.getByRole("button", { name: "Increase Dark Shard stock", exact: true });
  const decreaseStock = materials.getByRole("button", { name: "Decrease Dark Shard stock", exact: true });
  await decreaseStock.click();
  assert.equal(await darkStock.inputValue(), "0", "Decrementing empty stock must not create negative inventory");
  await increaseStock.click();
  await increaseStock.dblclick();
  assert.equal(await darkStock.inputValue(), "3", "Repeated increases must add one per click without losing changes");
  await darkStock.fill("7");
  await increaseStock.click();
  assert.equal(await darkStock.inputValue(), "8", "The stepper must apply to the manually entered count");
  await decreaseStock.click();
  assert.equal(await darkStock.inputValue(), "7");
  await increaseStock.focus();
  await materials.keyboard.press("Enter");
  assert.equal(await darkStock.inputValue(), "8", "Stock controls must work from the keyboard");
  await materials.getByRole("button", { name: "Increase Dense Crystal stock", exact: true }).click();
  assert.equal((await saved(materials)).inventory["Dense Crystal"], 9999, "Increasing stock must preserve the existing maximum");
  await materials.getByRole("button", { name: "Decrease Dense Crystal stock", exact: true }).click();
  assert.equal((await saved(materials)).inventory["Dense Crystal"], 9998);
  assert.equal((await saved(materials)).inventory["Blazing Stone"], 7, "Adjusting stock must not affect other materials");
  await materials.locator("#material-search").fill("Dark Shard");
  await decreaseStock.click();
  assert.equal(await darkStock.inputValue(), "7", "Filtered materials must keep working stock controls");
  await materials.reload();
  assert.equal(await darkStock.inputValue(), "7", "Adjusted stock must persist after reload");
  for (const width of [1440, 1000, 700, 390, 320]) {
    await materials.setViewportSize({ width, height: 844 });
    await expectMobileLayout(materials, "inventory");
    const wrapped = await materials.locator(".stock-row").evaluateAll((rows) => rows.filter((row) => {
      const name = row.querySelector(".icon-label").getBoundingClientRect();
      const controls = row.querySelector(".stock-controls").getBoundingClientRect();
      return name.right > controls.left || Math.abs((name.top + name.bottom) / 2 - (controls.top + controls.bottom) / 2) > 1;
    }).map((row) => row.querySelector("label").innerText));
    assert.deepEqual(wrapped, [], `Material names and compact controls must fit on one row at ${width}px`);
  }
  console.log("PASS materials: increment/decrement, bounds, manual entry, keyboard, filtering, persistence, phone layouts");
}

async function navigationSuite() {
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
}

async function progressSuite() {
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

  const rewards = await open("world-progress", {
    goals: { "Ultima Weapon": 1 }, inventory: { "Orichalcum+": 2 },
    moogle: 9, expand: false, worlds: expected.worlds,
  });
  const atlantica = data.rewards.find((reward) => reward.world === "at");
  const atlanticaRoute = rewards.locator(".route-item").filter({ hasText: atlantica.label });
  assert.equal(await atlanticaRoute.count(), 1, "Uncollected Atlantica reward must be suggested");
  const beforeReward = await saved(rewards);
  await rewards.getByText("Orichalcum+ rewards", { exact: true }).click();
  await rewards.locator(`[data-reward="${atlantica.id}"]`).check();
  await rewards.locator('[data-tab="plan"]').click();
  for (const reload of [false, true]) {
    if (reload) await rewards.reload();
    assert.equal(await atlanticaRoute.count(), 0, "Collected Atlantica reward must disappear immediately and after reload");
    assert.equal(await rewards.locator(".route-item").filter({ hasText: "Collect once; never a repeatable enemy drop." }).count(), 3);
    assert.deepEqual((await saved(rewards)).inventory, beforeReward.inventory, "Reward tracking must not add inventory");
  }
  await rewards.locator('[data-tab="progress"]').click();
  await rewards.getByText("Orichalcum+ rewards", { exact: true }).click();
  await rewards.locator(`[data-reward="${atlantica.id}"]`).uncheck();
  await rewards.locator('[data-tab="plan"]').click();
  assert.equal(await atlanticaRoute.count(), 1, "Unchecking the reward must restore its route");
  console.log("PASS rewards: Atlantica collection hides its route, preserves other rewards and stock, persists, and can be undone");
}

async function routesSuite() {
  const routes = await open("plan", {
    goals: Object.fromEntries(data.recipes.map((recipe) => [recipe.name, 1])),
    worlds: Object.fromEntries(data.worlds.map((world) => [world.id, world.stages.length - 1])),
    optional: Object.fromEntries(data.optional.map(([id]) => [id, true])),
    moogle: 9, energy: "none", expand: false,
  });
  const images = routes.locator(".route-item img");
  assert.ok(await images.count() > 0, "Farming routes must show enemy thumbnails");
  const decoded = await images.evaluateAll(async (items) => Promise.all(items.map(async (image) => {
    try {
      await image.decode();
      return image.src.startsWith("data:image/") && image.naturalWidth > 0 && image.naturalHeight > 0;
    } catch {
      return false;
    }
  })));
  assert.ok(decoded.every(Boolean), "Every rendered enemy image must decode from embedded data without a network download");
  const rows = await routes.locator(".route-item").evaluateAll((items) => items.map((row) => ({
    name: row.querySelector("strong a")?.textContent,
    materials: !!row.querySelector(".drop-material"),
    image: !!row.querySelector("img"),
  })));
  assert.ok(rows.every((row) => row.name && row.materials), "Enemy images must preserve enemy links and material drops");
  assert.ok(rows.filter((row) => !row.image).every((row) =>
    /Absent Silhouette|Replica Data|One-time reward/.test(row.name),
  ), "Only generic boss/reward routes may use text-only fallbacks");
  assert.ok(await routes.locator(".route-item").evaluateAll((items) => items.every((row) => {
    const thumbnail = row.querySelector(".route-enemy-image");
    return !thumbnail || thumbnail.href === row.querySelector("strong a").href &&
      !thumbnail.hasAttribute("title") && !thumbnail.querySelector("[title], small");
  })), "Thumbnails must link to enemy articles without title tooltips or credit labels");
  assert.equal(await routes.locator(".route-enemy-notice").count(), 0, "Enemy disclaimer must not appear in farming routes");
  assert.ok((await routes.locator("footer").innerText()).includes("non-free enemy, material, and item"));
  assert.ok(await routes.locator("footer #image-credits a").count() > 0, "Image sources and credits must remain available in the footer");
  await routes.getByText("Image sources & credits", { exact: true }).click();
  for (const width of [1280, 390, 320]) {
    await routes.setViewportSize({ width, height: 844 });
    assert.ok(await routes.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1),
      `Enemy route images must fit a ${width}px viewport`);
  }
  console.log("PASS routes: embedded enemy images decode, source links and drops remain, phone layouts fit");
}

async function imagesSuite() {
  const images = await open("materials");
  const downloads = [];
  images.on("request", (request) => {
    if (/^https?:/.test(request.url())) downloads.push(request.url());
  });
  await images.context().setOffline(true);
  await images.reload();
  assert.equal(await images.locator("#inventory-list svg.kh-icon image").count(), data.materialNames.length);
  assert.equal(await images.locator("#recipe-list h3 svg.kh-icon image").count(), data.recipes.length);
  assert.equal(await images.locator(".brand-mark svg image").count(), 0);
  assert.equal(await images.locator(".brand-mark .brand-mark-pom").count(), 1);
  assert.equal(await images.locator(".brand-mark .brand-mark-wing").count(), 1);
  const decoded = await images.locator("svg.kh-icon image").evaluateAll(async (items) => {
    const sources = [...new Set(items.map((item) => item.href.baseVal))];
    return Promise.all(sources.map(async (source) => {
      const image = new Image();
      image.src = source;
      await image.decode();
      return source.startsWith("data:image/webp;base64,") && image.naturalWidth > 0 &&
        image.naturalHeight > 0 && Math.max(image.naturalWidth, image.naturalHeight) <= 96;
    }));
  });
  assert.ok(decoded.every(Boolean), "All material and item artwork must decode offline from compact embedded images");
  assert.deepEqual(downloads, [], "Displaying artwork must not download external assets");
  for (const name of ["Blazing Shard", "Ultima Weapon"]) {
    assert.equal(await images.locator("#image-credits a").getByText(name, { exact: true }).count(), 1);
  }
  for (const width of [1440, 390, 320]) {
    await images.setViewportSize({ width, height: 844 });
    for (const tab of ["inventory", "recipes"]) {
      await expectMobileLayout(images, tab);
      await expectIcons(images, tab === "inventory" ? "#inventory-list" : "#recipe-list");
      assert.ok(await images.locator("svg.kh-icon:visible").evaluateAll((icons) => icons.every((icon) => {
        const box = icon.getBoundingClientRect();
        return box.width > 0 && box.height > 0 && box.left >= 0 && box.right <= innerWidth;
      })), `Artwork must remain visible and fit at ${width}px`);
    }
  }
  console.log("PASS images: all materials and recipes decode offline; illustrated Moogle, credits, and responsive sizes remain");
}

async function accessibilitySuite() {
  const accessible = await open("plan");
  await accessible.emulateMedia({ forcedColors: "active", reducedMotion: "reduce" });
  await accessible.setViewportSize({ width: 390, height: 844 });
  await accessible.locator("#moogle").focus();
  const focus = await accessible.locator("#moogle").evaluate((input) => {
    const style = getComputedStyle(input);
    const extent = parseFloat(style.outlineWidth) + parseFloat(style.outlineOffset);
    const bounds = input.getBoundingClientRect();
    const frame = input.closest(".settings").getBoundingClientRect();
    return {
      visible: input.matches(":focus-visible") && style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
      inside: bounds.left - extent > frame.left && bounds.right + extent < frame.right &&
        bounds.top - extent > frame.top && bounds.bottom + extent < frame.bottom,
    };
  });
  assert.ok(focus.visible && focus.inside, "The rounded Moogle panel must preserve visible keyboard focus without clipping its outline");
  await expectPlanLayout(accessible);
}

const suites = {
  wishlist: wishlistSuite,
  readiness: readinessSuite,
  energy: energySuite,
  lucky: luckySuite,
  save: saveSuite,
  materials: materialsSuite,
  navigation: navigationSuite,
  progress: progressSuite,
  routes: routesSuite,
  images: imagesSuite,
  accessibility: accessibilitySuite,
};

try {
  const selected = [...new Set(process.argv.slice(2))];
  for (const name of selected) {
    if (!Object.hasOwn(suites, name)) throw new Error(`Unknown UI suite "${name}". Choose: ${Object.keys(suites).join(", ")}.`);
  }
  for (const name of selected.length ? selected : Object.keys(suites)) await suites[name]();
  assert.deepEqual(errors, [], "UI workflows must not trigger browser errors");
} finally {
  await Promise.all(contexts.map((context) => context.close()));
  await browser.close();
}

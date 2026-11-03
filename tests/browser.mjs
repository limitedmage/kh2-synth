import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile, access } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const root = new URL("../", import.meta.url);
const artifacts = new URL("test-results/", root);
await mkdir(artifacts, { recursive: true });
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  const errors = [];
  const requests = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => requests.push({ url: request.url(), method: request.method() }));
  await page.goto(new URL("index.html", root).href);
  assert.equal(await page.title(), "Synthesis Journal · Kingdom Hearts II Final Mix");
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page.locator("#recipe-search").fill("AP Boost");
  await page.locator("[data-add='AP Boost']").click();
  await page.getByRole("button", { name: /^Farming plan/ }).click();
  await page.locator("#moogle").selectOption("4");
  await page.locator("#expand").selectOption("false");
  await page.locator("[data-goal='AP Boost']").fill("3");
  await page.locator("[data-goal='AP Boost']").blur();
  assert.match(await page.locator("#requirements").innerText(), /Power Crystal/);
  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await page.locator("#material-search").fill("Power Crystal");
  await page.locator("[data-stock='Power Crystal']").fill("4");
  await page.locator("[data-stock='Power Crystal']").blur();
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")));
  assert.equal(saved.inventory["Power Crystal"], 4);
  assert.equal(saved.goals["AP Boost"], 3);
  assert.equal(saved.moogle, 4);
  await page.getByRole("button", { name: "World progress", exact: true }).click();
  await page.locator("#all-chests").check();
  assert.equal(await page.locator("[data-chests]:checked").count(), 15);
  await page.locator("[data-chests='ld']").uncheck();
  assert.equal(await page.locator("#all-chests").evaluate((el) => el.indeterminate), true);
  await page.locator("[data-world='ld']").selectOption("2");
  await page.getByRole("button", { name: "Photo & video import", exact: true }).click();
  assert.equal(await page.locator("#two-columns").isVisible(), false);
  assert.equal(await page.locator("#column-split").isVisible(), false);
  await page.getByText("Paste or correct recognized text manually").click();
  await page.locator("#ocr-text").fill("AP Boost\nPetite Ribbon\nSave the King +\nMythril Gem 1 2");
  await page.locator("#parse-text").click();
  assert.equal(await page.locator(".review-row").count(), 3);
  assert.equal(await page.locator("[data-review-qty]").count(), 0, "Recipe review contains names only, never inventory counts");
  await page.locator("#ocr-text").fill("Mythril Shard\nAcrisius\nPetite Ribbon");
  await page.locator("#parse-text").click();
  assert.equal(await page.locator(".review-row").count(), 5, "Both recipe lists combine without duplicate names");
  await page.locator("#apply-import").click();
  const recipesImported = await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")));
  assert.equal(recipesImported.goals["AP Boost"], 3, "Recipe name imports preserve desired quantities");
  assert.equal(recipesImported.goals.Acrisius, 1);
  assert.equal(recipesImported.goals["Petite Ribbon"], 1);
  assert.deepEqual(recipesImported.inventory, saved.inventory, "Recipe imports must not change inventory");
  await page.locator("#import-kind").selectOption("inventory");
  assert.equal(await page.locator("#two-columns").isVisible(), true);
  await page.locator("#ocr-text").fill("Dense Shard 4\nDense Shard 4\nDense Shard 41\nOrichalcum + 2\nEnergy Crystal");
  await page.locator("#parse-text").click();
  assert.equal(await page.locator(".review-row").count(), 3);
  assert.equal(await page.locator("[data-review-check='0']").isChecked(), false);
  assert.equal(await page.locator("[data-review-check='1']").isChecked(), true);
  assert.equal(await page.locator("[data-review-check='2']").isChecked(), false);
  await page.locator("[data-review-qty='0']").fill("4");
  await page.locator("[data-review-check='0']").check();
  await page.locator("#apply-import").click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")));
  assert.equal(after.inventory["Orichalcum+"], 2);
  assert.equal(after.inventory["Dense Shard"], 4);
  assert.equal(after.inventory["Power Crystal"], 4);
  assert.equal(after.goals["Save the King+"], 1);
  assert.equal(requests.filter((r) => !r.url.startsWith("file:")).length, 0, "Manual workflows must not need a network request");

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  const download = await downloadPromise;
  const backupPath = fileURLToPath(new URL("save.json", artifacts));
  await download.saveAs(backupPath);
  assert.equal(JSON.parse(await readFile(backupPath, "utf8")).goals["AP Boost"], 3);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#load-save").setInputFiles(backupPath);
  await page.waitForFunction(() => document.getElementById("notice").textContent === "Save loaded.");
  await page.getByRole("button", { name: /^Farming plan/ }).click();
  await page.screenshot({ path: fileURLToPath(new URL("desktop.png", artifacts)), fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Page must fit a phone viewport");
  await page.screenshot({ path: fileURLToPath(new URL("mobile.png", artifacts)), fullPage: true });
  console.log("PASS: file:// manual planning, inventory, persistence, chest switches, reviewed imports, save backup and responsive layout.");

  if (process.argv.includes("--media")) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.getByRole("button", { name: "Photo & video import", exact: true }).click();
    for (const [file, kind] of [["recipes.jpeg", "recipes"], ["free-development.jpeg", "recipes"], ["materials.MOV", "inventory"]]) {
      const path = fileURLToPath(new URL(`samples/${file}`, root));
      await access(path);
      await page.locator("#import-kind").selectOption(kind);
      await page.locator("#media-file").setInputFiles(path);
      await page.waitForFunction(() => !document.getElementById("recognize").disabled || /codec|could not|unsupported/i.test(document.getElementById("ocr-status").textContent));
      assert.equal(await page.locator("#recognize").isEnabled(), true, await page.locator("#ocr-status").innerText());
      if (kind === "inventory") {
        const visiblePixels = await page.locator("#preview").evaluate((canvas) => {
          const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
          let visible = 0;
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 30) visible++;
          return visible / (pixels.length / 4);
        });
        assert.ok(visiblePixels > 0.25, "Video selection must show the decoded game frame, not a black canvas with crop outlines");
        await page.locator("#align-screen").click();
        await page.locator("#preview").scrollIntoViewIfNeeded();
        const bounds = await page.locator("#preview").boundingBox();
        for (const [x, y] of [[500, 302], [1318, 310], [1342, 800], [520, 830]]) {
          await page.mouse.click(bounds.x + x / 1920 * bounds.width, bounds.y + y / 1080 * bounds.height);
        }
        assert.match(await page.locator("#alignment-status").innerText(), /alignment set/);
      }
      await page.locator("#recognize").click();
      await page.waitForFunction(() => !document.getElementById("recognize").disabled, null, { timeout: 240000 });
      const status = await page.locator("#ocr-status").innerText();
      const rows = await page.locator(".review-row").evaluateAll((els) => els.map((el) => ({
        name: el.querySelector("select").value,
        quantity: el.querySelector("input[type=number]")?.value ?? null,
        checked: el.querySelector("input[type=checkbox]").checked,
        note: el.querySelector("small").textContent,
      })));
      console.log(file, status, JSON.stringify(rows));
      await page.locator("#ocr-text").inputValue().then((text) => import("node:fs/promises").then((fs) => fs.writeFile(new URL(`${file}.txt`, artifacts), text)));
      assert.match(status, /Reading complete/);
      if (file === "recipes.jpeg") assert.equal(rows.length, 8, "Sample recipe photo must recognize all eight listed goals");
      if (file === "free-development.jpeg") {
        assert.equal(rows.length, 10, "Both recipe photos must combine into all ten goals");
        assert.ok(rows.some((r) => r.name === "AP Boost") && rows.some((r) => r.name === "Mythril Shard"));
        assert.equal(await page.locator("[data-review-qty]").count(), 0);
        for (const checkbox of await page.locator("[data-review-check]").all()) await checkbox.check();
        await page.locator("#apply-import").click();
        const combined = await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")));
        assert.equal(combined.goals["AP Boost"], 3);
        assert.equal(combined.goals.Acrisius, 1);
        assert.deepEqual(combined.inventory, after.inventory);
      }
      if (kind === "inventory") {
        assert.ok(rows.length >= 30, "Inventory video should recognize most of its material list");
        assert.ok(rows.some((r) => r.name === "Blazing Shard" && r.quantity === "26"));
        assert.ok(rows.some((r) => r.name === "Dense Shard" && r.quantity === "4"));
      }
    }
    assert.ok(requests.every((r) => r.method === "GET"), "OCR must not upload media");
    console.log("PASS: supplied photo/video samples recognized locally, with no upload requests.");
  }
  assert.deepEqual(errors, [], "No uncaught browser errors");
} finally {
  await browser.close();
}

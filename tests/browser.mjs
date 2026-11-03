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
  const quantityPixels = await page.evaluate(() => {
    const column = document.createElement("canvas");
    column.width = 1000; column.height = 100;
    const ctx = column.getContext("2d");
    const countInk = (bounds = { y0: 20, y1: 70 }) => {
      const quantity = KH2Recognition.quantityCanvas(column, bounds);
      const pixels = quantity.getContext("2d").getImageData(0, 0, quantity.width, quantity.height).data;
      let ink = 0;
      for (let i = 0; i < pixels.length; i += 4) if (pixels[i] < 128) ink++;
      return ink;
    };
    ctx.fillStyle = "#2046a0"; ctx.fillRect(0, 0, 1000, 100);
    ctx.fillStyle = "#fff"; ctx.font = "bold 42px sans-serif"; ctx.fillText("26", 810, 63);
    const baseline = countInk();
    const badges = ["#fff", "#ffb0dd", "#50ffff", "#46b8f5"].map((color) => {
      ctx.fillStyle = color; ctx.fillRect(900, 0, 100, 100);
      ctx.fillStyle = "#fff"; ctx.fillText("8", 920, 63);
      return countInk();
    });
    ctx.fillStyle = "#2046a0"; ctx.fillRect(0, 0, 1000, 100);
    ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.fillText("40", 894, 63);
    const centered = countInk();
    ctx.fillStyle = "#2046a0"; ctx.fillRect(0, 0, 1000, 100);
    ctx.fillStyle = "#fff"; ctx.fillText("40", 994, 63);
    const rightEdge = countInk();
    ctx.fillStyle = "#2046a0"; ctx.fillRect(0, 0, 1000, 100);
    ctx.fillStyle = "#fff"; ctx.fillText("26", 860, 63);
    const row = countInk();
    ctx.fillText("9", 860, 106);
    const nextRow = countInk();
    column.height = 150;
    ctx.fillStyle = "#2046a0"; ctx.fillRect(0, 0, 1000, 150);
    ctx.fillStyle = "#fff"; ctx.font = "bold 42px sans-serif"; ctx.fillText("13", 810, 73);
    const raisedCount = countInk({ y0: 60, y1: 110 });
    ctx.fillStyle = "#202020"; ctx.fillRect(0, 0, 1000, 150);
    ctx.fillStyle = "#ffff00"; ctx.fillText("26", 810, 73);
    const yellowCount = countInk({ y0: 60, y1: 110 });
    const counters = {};
    for (const [printed, recognized] of [["6", "5"], ["5", "5"], ["0", "5"], ["8", "5"], ["26", "25"]]) {
      ctx.fillStyle = "#202020"; ctx.fillRect(0, 0, 1000, 150);
      ctx.fillStyle = "#ffff00"; ctx.fillText(printed, 810, 73);
      counters[printed] = KH2Recognition.quantityText(KH2Recognition.quantityCanvas(column, { y0: 35, y1: 85 }), recognized);
    }
    return { baseline, badges, centered, rightEdge, row, nextRow, raisedCount, yellowCount, counters };
  });
  assert.ok(quantityPixels.baseline > 0, "Count recognition must preserve the quantity digits");
  assert.deepEqual(quantityPixels.badges, Array(4).fill(quantityPixels.baseline), "White, pink and cyan grade badges must not contribute pixels to numeric OCR");
  assert.ok(quantityPixels.centered > 0 && quantityPixels.raisedCount > 0, "Counts must survive camera skew relative to material names");
  assert.equal(quantityPixels.rightEdge, quantityPixels.centered, "Rightmost digits must not be cropped: 40 must not become 4");
  assert.equal(quantityPixels.nextRow, quantityPixels.row, "Partial digits from the next row must not become part of this count");
  assert.ok(quantityPixels.yellowCount > 0, "Yellow counts on the screen capture's dark background must not be discarded");
  assert.deepEqual(quantityPixels.counters, { 6: "6", 5: "5", 0: "5", 8: "5", 26: "26" }, "Only an enclosed lower counter may correct the game's misread 6; real 5s, zeroes and eights must not become 6");
  await page.getByRole("button", { name: "Recipes", exact: true }).click();
  await page.locator("#recipe-search").fill("AP Boost");
  await page.locator("[data-add='AP Boost']").click();
  await page.getByRole("button", { name: /^Farming plan/ }).click();
  await page.locator("#moogle").selectOption("4");
  await page.locator("#expand").selectOption("false");
  assert.equal(await page.locator("input[data-goal]").count(), 0, "Wishlist items are requested once, without quantity controls");
  assert.match(await page.locator("#requirements").innerText(), /Power Crystal/);
  await page.getByRole("button", { name: "Materials", exact: true }).click();
  await page.locator("#material-search").fill("Power Crystal");
  await page.locator("[data-stock='Power Crystal']").fill("4");
  await page.locator("[data-stock='Power Crystal']").blur();
  await page.reload();
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")));
  assert.equal(saved.inventory["Power Crystal"], 4);
  assert.equal(saved.goals["AP Boost"], 1);
  assert.equal(saved.moogle, 4);
  await page.getByRole("button", { name: "World progress", exact: true }).click();
  await page.locator("#all-chests").check();
  assert.equal(await page.locator("[data-chests]:checked").count(), 15);
  await page.locator("[data-chests='ld']").uncheck();
  assert.equal(await page.locator("#all-chests").evaluate((el) => el.indeterminate), true);
  await page.locator("[data-world='ld']").selectOption("2");
  await page.locator("[data-tab='import']").click();
  assert.equal(await page.locator("#crop-x, #crop-y, #crop-w, #crop-h").count(), 0, "Crop percentages must not require manual inputs");
  assert.equal(await page.locator("#two-columns").isVisible(), false);
  assert.equal(await page.locator("#column-split").isVisible(), false);
  await page.getByText("Paste or edit text", { exact: true }).click();
  await page.locator("#ocr-text").fill("AP Boost\nPetite Ribbon\nSave the King +\nMythril Gem 1 2");
  await page.locator("#parse-text").click();
  assert.equal(await page.locator(".review-row").count(), 3);
  assert.equal(await page.locator(".review-source").count(), 0, "Pasted text must not show source images from an earlier import");
  assert.equal(await page.locator("[data-review-qty]").count(), 0, "Recipe review contains names only, never inventory counts");
  await page.locator("[data-review-check='0']").uncheck();
  await page.locator("#check-all-import").click();
  assert.equal(await page.locator("[data-review-check]:checked").count(), 3);
  await page.locator("#ocr-text").fill("Mythril Shard\nAcrisius\nPetite Ribbon");
  await page.locator("#parse-text").click();
  assert.equal(await page.locator(".review-row").count(), 5, "Both recipe lists combine without duplicate names");
  await page.locator("#apply-import").click();
  const recipesImported = await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")));
  assert.equal(recipesImported.goals["AP Boost"], 1, "Recipe imports keep one of each selected recipe");
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
  await page.locator("#check-all-import").click();
  assert.equal(await page.locator("[data-review-check]:checked").count(), 3);
  await page.locator("#apply-import").click();
  assert.equal(await page.locator("#notice").innerText(), "Enter a valid quantity for every checked row.");
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")).inventory), saved.inventory, "An invalid import must not clear stock");
  await page.locator("[data-review-check='2']").uncheck();
  await page.locator("[data-review-qty='0']").fill("4");
  await page.locator("[data-review-check='0']").check();
  await page.locator("#apply-import").click();
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")));
  assert.equal(after.inventory["Orichalcum+"], 2);
  assert.equal(after.inventory["Dense Shard"], 4);
  assert.equal(after.inventory["Power Crystal"], undefined, "Inventory imports clear omitted previous materials");
  assert.equal(after.goals["Save the King+"], 1);
  await page.locator("#ocr-text").fill("Dense Shard 2\nOrichalcum + 0");
  await page.locator("#parse-text").click();
  await page.locator("[data-review-check='1']").uncheck();
  await page.locator("#apply-import").click();
  const replaced = await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")));
  assert.deepEqual(replaced.inventory, { "Dense Shard": 2 }, "Reimport replaces totals and clears previously imported unchecked materials");
  assert.deepEqual(replaced.goals, after.goals, "Inventory reimport preserves recipe goals");
  await page.locator("[data-review-check='0']").uncheck();
  await page.locator("#apply-import").click();
  assert.equal(await page.locator("#notice").innerText(), "Check at least one row before applying.");
  assert.deepEqual(await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")).inventory), replaced.inventory);
  assert.equal(requests.filter((r) => !r.url.startsWith("file:")).length, 0, "Manual workflows must not need a network request");

  const detectedTables = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800; canvas.height = 600;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#123456"; ctx.fillRect(0, 0, 800, 600);
    const blank = KH2Recognition.detectCorners(canvas, "recipes");
    ctx.fillStyle = "#202020"; ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = "#244ccc"; ctx.beginPath();
    for (const [i, [x, y]] of [[155, 70], [580, 95], [605, 450], [130, 475]].entries()) ctx[i ? "lineTo" : "moveTo"](x, y);
    ctx.closePath(); ctx.fill();
    const recipes = KH2Recognition.detectCorners(canvas, "recipes");
    ctx.fillStyle = "#202020"; ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = "#35dd77";
    for (let row = 0; row < 8; row++) {
      ctx.fillRect(140, 130 + row * 34, 50, 22);
      ctx.fillRect(360, 122 + row * 33, 50, 22);
    }
    ctx.fillStyle = "#ff88bb"; ctx.fillRect(145, 540, 20, 8);
    const inventory = KH2Recognition.detectCorners(canvas, "inventory");
    ctx.fillStyle = "#202020"; ctx.fillRect(0, 0, 800, 600);
    ctx.fillStyle = "#244ccc"; ctx.fillRect(110, 100, 650, 330);
    ctx.fillStyle = "#35dd77";
    for (let row = 0; row < 8; row++) {
      ctx.fillRect(140, 130 + row * 34, 50, 22);
      ctx.fillRect(460, 130 + row * 34, 50, 22);
    }
    const unequal = KH2Recognition.detectCorners(canvas, "inventory");
    const dividerX = unequal && unequal[0].x + (unequal[1].x - unequal[0].x) * unequal.columnSplit / 100;
    return { blank, recipes, inventory, unequalSplit: unequal?.columnSplit, dividerX };
  });
  assert.equal(detectedTables.blank, null, "A uniform image must not be reported as a detected table");
  assert.ok(detectedTables.unequalSplit > 51, "Unequal table margins must not force a 50% column divider");
  assert.ok(Math.abs(detectedTables.dividerX - 460 / 8) < 0.3, "The rectified divider must follow the second badge column");
  for (const [kind, expected] of [
    ["recipes", [[155, 70], [580, 95], [605, 450], [130, 475]]],
    ["inventory", [[140, 130], [580, 114], [580, 360], [140, 390]]],
  ]) {
    assert.equal(detectedTables[kind]?.length, 4, `${kind} detection must find four corners`);
    detectedTables[kind].forEach((point, i) => {
      assert.ok(Math.abs(point.x - expected[i][0] / 8) < 3 && Math.abs(point.y - expected[i][1] / 6) < 3, `${kind} corners must follow the actual skewed table and ignore unrelated footer colors`);
    });
  }

  await page.locator("#import-kind").selectOption("recipes");
  const cornerPhoto = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 800; canvas.height = 600;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#123456"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    return canvas.toDataURL();
  });
  await page.locator("#media-file").setInputFiles({ name: "corners.png", mimeType: "image/png", buffer: Buffer.from(cornerPhoto.split(",")[1], "base64") });
  await page.waitForFunction(() => !document.getElementById("recognize").disabled);
  assert.match(await page.locator("#alignment-status").innerText(), /Table not detected/);
  const defaultCorners = [[25, 23], [51, 23], [51, 63], [25, 63]];
  const expectCornerHandles = async (points) => {
    const handles = await page.locator("#preview").evaluate((canvas, corners) => corners.map(([x, y]) => {
      const pixel = canvas.getContext("2d").getImageData(Math.round(x / 100 * canvas.width) + 2, Math.round(y / 100 * canvas.height) + 2, 1, 1).data;
      return pixel[0] === 139 && pixel[1] === 226 && pixel[2] === 201;
    }), points);
    assert.deepEqual(handles, [true, true, true, true], "Four filled corner handles must be visible instead of a plain crop rectangle");
  };
  await expectCornerHandles(defaultCorners);
  await page.locator("#preview").scrollIntoViewIfNeeded();
  const cornerBounds = await page.locator("#preview").boundingBox();
  const moveCorner = async (from, to) => {
    await page.mouse.move(cornerBounds.x + from[0] / 100 * cornerBounds.width, cornerBounds.y + from[1] / 100 * cornerBounds.height);
    await page.mouse.down();
    await page.mouse.move(cornerBounds.x + to[0] / 100 * cornerBounds.width, cornerBounds.y + to[1] / 100 * cornerBounds.height);
    await page.mouse.up();
  };
  await moveCorner([25, 23], [22, 20]);
  await expectCornerHandles([[22, 20], ...defaultCorners.slice(1)]);
  await moveCorner([22, 20], [70, 70]);
  await expectCornerHandles([[22, 20], ...defaultCorners.slice(1)]);
  await page.locator("#crop-reset").click();
  await expectCornerHandles(defaultCorners);
  await page.locator("#align-screen").click();
  await page.locator("#align-screen").click();
  await expectCornerHandles(defaultCorners);

  const downloadPromise = page.waitForEvent("download");
  await page.locator("#export").click();
  await page.locator("#export-file").click();
  const download = await downloadPromise;
  const backupPath = fileURLToPath(new URL("save.json", artifacts));
  await download.saveAs(backupPath);
  assert.equal(JSON.parse(await readFile(backupPath, "utf8")).goals["AP Boost"], 1);
  page.once("dialog", (dialog) => dialog.accept());
  await page.locator("#load-save").setInputFiles(backupPath);
  await page.waitForFunction(() => document.getElementById("notice").textContent === "Save loaded.");
  await page.getByRole("button", { name: /^Farming plan/ }).click();
  if (process.argv.includes("--screenshots")) {
    await page.screenshot({ path: fileURLToPath(new URL("desktop.png", artifacts)), fullPage: true });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Page must fit a phone viewport");
  if (process.argv.includes("--screenshots")) {
    await page.screenshot({ path: fileURLToPath(new URL("mobile.png", artifacts)), fullPage: true });
  }
  console.log("PASS: file:// manual planning, inventory, persistence, chest switches, reviewed imports, save backup and responsive layout.");

  if (process.argv.includes("--media")) {
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.locator("[data-tab='import']").click();
    const selected = process.argv.slice(process.argv.indexOf("--media") + 1);
    for (const [file, kind] of [["recipes.jpeg", "recipes"], ["free-development.jpeg", "recipes"], ["materials.MOV", "inventory"], ["materials-2.MOV", "inventory"], ["materials-3.mp4", "inventory"]].filter(([file]) => !selected.length || selected.includes(file))) {
      await page.setViewportSize({ width: 1440, height: 1000 });
      const path = fileURLToPath(new URL(`samples/${file}`, root));
      await access(path);
      await page.locator("#import-kind").selectOption(kind);
      await page.locator("#media-file").setInputFiles(path);
      await page.waitForFunction(() => !document.getElementById("recognize").disabled || /codec|could not|unsupported/i.test(document.getElementById("ocr-status").textContent));
      assert.equal(await page.locator("#recognize").isEnabled(), true, await page.locator("#ocr-status").innerText());
      assert.match(await page.locator("#alignment-status").innerText(), /Table detected/, "Sample table corners must be detected from pixels, not fixed percentages");
      if (kind === "inventory") {
        const visiblePixels = await page.locator("#preview").evaluate((canvas) => {
          const pixels = canvas.getContext("2d").getImageData(0, 0, canvas.width, canvas.height).data;
          let visible = 0;
          for (let i = 0; i < pixels.length; i += 4) if (pixels[i] + pixels[i + 1] + pixels[i + 2] > 30) visible++;
          return visible / (pixels.length / 4);
        });
        assert.ok(visiblePixels > 0.25, "Video selection must show the decoded game frame, not a black canvas with crop outlines");
        const split = Number(await page.locator("#column-split").inputValue());
        assert.ok(split >= 45 && split <= 55, "The divider must be detected from the rank columns, not retained from a previous file");
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
        await page.locator("#check-all-import").click();
        await page.locator("#apply-import").click();
        const combined = await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")));
        assert.equal(combined.goals["AP Boost"], 1);
        assert.equal(combined.goals.Acrisius, 1);
        assert.deepEqual(combined.inventory, replaced.inventory);
      }
      if (kind === "inventory") {
        const expected = {
          "Blazing Shard": "26", "Blazing Gem": "1", "Frost Shard": "10", "Frost Stone": "10", "Frost Crystal": "1",
          "Lightning Shard": "9", "Lightning Stone": "13", "Lightning Gem": "1", "Lightning Crystal": "1",
          "Lucid Shard": "5", "Lucid Stone": "4", "Lucid Gem": "1", "Lucid Crystal": "1",
          "Power Shard": "4", "Power Stone": "3", "Power Gem": "2", "Power Crystal": "4",
          "Dark Shard": "40", "Dark Stone": "2", "Dark Gem": "5", "Dark Crystal": "4",
          "Dense Shard": "4", "Dense Stone": "1", "Dense Gem": "2", "Twilight Shard": "4", "Twilight Stone": "1",
          "Mythril Shard": "9", "Mythril Stone": "9", "Mythril Gem": "2", "Mythril Crystal": "5",
          "Bright Shard": "19", "Bright Stone": "12", "Bright Gem": "2", "Bright Crystal": "1",
          "Energy Shard": "8", "Energy Stone": "9", "Energy Gem": "3", "Energy Crystal": "3",
          "Serenity Shard": "6", "Serenity Stone": "3", "Serenity Gem": "8", "Serenity Crystal": "6",
          "Lost Illusion": "2", "Orichalcum": "6", "Orichalcum+": "3",
        };
        if (file !== "materials.MOV") Object.assign(expected, {
          "Frost Shard": "12", "Frost Crystal": "2", "Lightning Shard": "10", "Lightning Stone": "14", "Lightning Gem": "3",
          "Lucid Shard": "6", "Lucid Stone": "12", "Lucid Gem": "3", "Lucid Crystal": "2",
          "Power Shard": "6", "Power Crystal": "5", "Dark Stone": "5", "Dark Crystal": "5",
          "Dense Shard": "6", "Dense Gem": "3", "Dense Crystal": "1", "Twilight Shard": "10", "Twilight Stone": "2",
          "Mythril Shard": "10", "Mythril Gem": "3", "Mythril Crystal": "8",
          "Remembrance Shard": "9", "Remembrance Stone": "2", "Remembrance Gem": "2",
          "Bright Shard": "20", "Bright Stone": "13", "Bright Crystal": "2",
          "Energy Shard": "10", "Energy Gem": "4", "Serenity Shard": "11", "Serenity Stone": "5",
          "Serenity Gem": "10", "Serenity Crystal": "7", "Orichalcum": "9", "Orichalcum+": "4",
        });
        assert.equal(rows.length, Object.keys(expected).length, "Every visible material must be recognized, including the final Orichalcum+ row");
        assert.deepEqual(Object.fromEntries(rows.map((row) => [row.name, row.quantity])), expected, "Every displayed count must match the game footage, not just selected examples");
        assert.ok((await page.locator("#ocr-text").inputValue()).includes(`Orichalcum+ ${expected["Orichalcum+"]}`), "Editable text must retain separately recognized quantities");
        assert.ok(rows.filter((row) => row.checked).length >= 40, "Repeated accurate counts should be usable without checking every row manually");
        assert.equal(await page.locator(".review-source img").count(), rows.length, "Every material, including unreadable counts, must show its source row");
        const firstImage = page.locator(".review-source img").first();
        await firstImage.scrollIntoViewIfNeeded();
        await firstImage.evaluate((img) => img.decode());
        assert.equal(await firstImage.evaluate((img) => img.src.startsWith("data:image/jpeg;base64,") && img.naturalWidth > img.naturalHeight), true, "Source images must be local, decoded row crops rather than whole frames");
        assert.equal(await page.locator(".review-source figcaption").count(), 0, "Source images must not have text underneath");
        assert.match(await firstImage.getAttribute("title"), /Video \d+\.\d+s, column [12]/);
        const imageBounds = await firstImage.boundingBox();
        const quantityBounds = await page.locator("[data-review-qty='0']").boundingBox();
        assert.ok(imageBounds.width <= 320 && imageBounds.x >= quantityBounds.x + quantityBounds.width, "Compact source images must sit to the right of the editable fields");
        const source = await firstImage.getAttribute("src");
        await page.locator("#check-all-import").click();
        await page.locator("[data-review-qty='0']").fill("27");
        await page.locator("[data-review-qty='0']").blur();
        assert.equal(await firstImage.getAttribute("src"), source, "Source images must remain unchanged while correcting quantities");
        await page.locator(".review-row").first().screenshot({ path: fileURLToPath(new URL("material-source.png", artifacts)) });
        await page.setViewportSize({ width: 390, height: 844 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "Source images must fit a phone viewport");
        const mobileImageBounds = await firstImage.boundingBox();
        const mobileQuantityBounds = await page.locator("[data-review-qty='0']").boundingBox();
        assert.ok(mobileImageBounds.x >= mobileQuantityBounds.x + mobileQuantityBounds.width, "Source images must remain to the right on phones");
        for (const checkbox of await page.locator("[data-review-check]").all()) await checkbox.uncheck();
        await page.locator("[data-review-check='0']").check();
        await page.locator("#apply-import").click();
        const corrected = await page.evaluate(() => JSON.parse(localStorage.getItem("kh2-final-mix-synthesis-v1")));
        assert.deepEqual(corrected.inventory, { [rows[0].name]: 27 }, "The source preview must not interfere with applying corrected counts");
        assert.equal(JSON.stringify(corrected).includes("data:image"), false, "Source images must not be persisted in saved game state");
      }
    }
    assert.ok(requests.every((r) => r.method === "GET"), "OCR must not upload media");
    console.log("PASS: supplied photo/video samples recognized locally, with no upload requests.");
  }
  assert.deepEqual(errors, [], "No uncaught browser errors");
} finally {
  await browser.close();
}

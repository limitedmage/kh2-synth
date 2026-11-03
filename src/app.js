(() => {
  const D = globalThis.KH2Data;
  const P = globalThis.KH2Planner;
  const R = globalThis.KH2Recognition;
  const $ = (id) => document.getElementById(id);
  const escape = (value) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const storageKey = "kh2-final-mix-synthesis-v1";
  const chestWorlds = D.worlds.filter((w) => w.id !== "at");
  let state = P.defaults();
  let noticeTimer;
  let storageWarning = "";
  try {
    const saved = localStorage.getItem(storageKey);
    if (saved) state = P.sanitize(JSON.parse(saved));
  } catch {
    storageWarning = "Browser storage is unavailable or the saved data could not be read. Export a save to keep changes.";
  }
  function notice(message) {
    $("notice").textContent = message;
    $("notice").hidden = false;
    clearTimeout(noticeTimer);
    noticeTimer = setTimeout(() => { $("notice").hidden = true; }, 8000);
  }
  function save() {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state));
      $("save-status").textContent = "Saved on this device";
      $("save-status").classList.remove("storage-error");
    } catch {
      $("save-status").textContent = "Not saved — use Export save";
      $("save-status").classList.add("storage-error");
    }
  }
  function tab(name) {
    for (const section of document.querySelectorAll("main > section")) section.hidden = section.id !== `tab-${name}`;
    for (const button of document.querySelectorAll("[data-tab]")) {
      const active = button.dataset.tab === name;
      button.classList.toggle("active", active);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
  }
  const link = (url, text) => `<a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(text)}</a>`;
  const ingredientText = (ingredients) => Object.entries(ingredients).map(([name, qty]) => `${qty} ${escape(name)}`).join(" · ");
  function renderPlan() {
    const plan = P.plan(state);
    $("moogle").value = state.moogle;
    $("energy").value = state.energy;
    $("expand").value = String(state.expand);
    const discounts = [["C", 5], ["B", 6], ["A", 7], ["S", 9]].filter(([, level]) => state.moogle >= level).map(([rank]) => rank);
    $("moogle-perks").textContent = [
      state.moogle >= 2 ? "Energy enabled" : "Energy unlocks at level 2",
      state.moogle >= 3 ? "Serenity upgrades enabled" : "Upgrades unlock at level 3",
      state.moogle >= 4 ? "Energy + Serenity may be combined" : "Combining Energy + Serenity needs level 4",
      discounts.length ? `Half-cost ranks: ${discounts.join(", ")} (Energy stacks; round up per craft)` : "No automatic rank discounts yet",
    ].join(" · ");
    $("plan-count").textContent = plan.goals ? `(${plan.goals})` : "";
    $("summary").innerHTML = `<div class="stat"><strong>${plan.goals}</strong><span>creations on the wish list</span></div><div class="stat"><strong>${plan.needed.reduce((n, r) => n + r.missing, 0)}</strong><span>materials still to collect</span></div><div class="stat"><strong>${plan.routes.filter((r) => r.available).length}</strong><span>available farming / reward sources</span></div>`;
    const goals = Object.entries(state.goals).filter(([, qty]) => qty);
    $("goals").innerHTML = goals.length ? `<h3>Wish list</h3>${goals.map(([name, qty]) => {
      const recipe = D.byRecipe[name];
      return `<div class="goal"><div class="goal-name">${escape(name)}<small>Rank ${recipe.rank} · ${escape(recipe.category)}</small></div><label>Quantity<input type="number" min="1" max="${name === "Ultima Weapon" ? 1 : 99}" value="${qty}" data-goal="${escape(name)}" aria-label="${escape(name)} desired quantity"></label><button class="quiet" data-remove="${escape(name)}" aria-label="Remove ${escape(name)}">Remove</button>${recipe.base ? `<label class="check"><input type="checkbox" data-crafted="${escape(recipe.base)}" ${state.crafted[recipe.base] ? "checked" : ""}> ${escape(recipe.base)} has already been made once</label>` : ""}</div>`;
    }).join("")}` : `<div class="empty"><h3>Every creation starts with a wish.</h3><p>Add a recipe manually or read the list from a game photo.</p><button class="primary" data-go="recipes">Choose recipes</button> <button class="quiet" data-go="import">Import a photo</button></div>`;
    $("blockers").innerHTML = plan.warnings.map((w) => `<div class="alert">${escape(w)}</div>`).join("");
    const showOwned = $("show-owned").checked;
    const requirements = plan.requirements.filter((r) => showOwned || r.missing);
    const allChests = chestWorlds.every((w) => state.chests[w.id]);
    $("requirements").innerHTML = requirements.length ? `<div class="table-wrap"><table><thead><tr><th>Material</th><th>Total need</th><th>Stock used</th><th>Shortfall</th><th>How to supply</th></tr></thead><tbody>${requirements.map((row) => {
      const craftable = D.byRecipe[row.name];
      let note = row.crafted ? `Synthesize ${row.crafted}` : row.missing ? "Collect" : "Covered by stock";
      if (row.locked) note = `Synthesis locked: ${D.byRecipe[row.name].unlock}`;
      if (row.name.startsWith("Mythril") && row.missing) note += allChests ? " · All chests marked collected; synthesis is the remaining source." : " · No enemy drops. Chests may supply some; only entered stock is budgeted.";
      if (row.name === "Orichalcum+" && row.missing) note += " · Seven total in the game; chest completion is tracked under World progress.";
      return `<tr><td>${link(D.materials[row.name].url, row.name)}${row.bonus ? `<small>Includes ${row.bonus} from a base-recipe prerequisite</small>` : ""}</td><td class="numeric">${row.required}</td><td class="numeric">${row.owned}</td><td class="numeric ${row.missing ? "warning" : "positive"}">${row.missing || "—"}</td><td>${escape(note)}${craftable && row.missing && state.expand ? `<label class="check"><input type="checkbox" data-method="${escape(row.name)}" ${(state.methods[row.name] ? state.methods[row.name] === "craft" : row.name.startsWith("Mythril")) ? "checked" : ""}> Plan synthesis for this material</label>${craftable.base ? `<label class="check"><input type="checkbox" data-crafted="${escape(craftable.base)}" ${state.crafted[craftable.base] ? "checked" : ""}> ${escape(craftable.base)} already made once</label>` : ""}` : ""}</td></tr>`;
    }).join("")}</tbody></table></div>` : `<div class="empty">${plan.goals ? (plan.warnings.length ? "Resolve the locked recipes above to calculate their ingredients." : "The entered stock covers the plan. Open the crafting notes for the recipe breakdown.") : "Missing materials will appear here."}</div>`;
    const groups = new Map();
    for (const route of plan.routes.toSorted((a, b) => Number(b.available) - Number(a.available))) {
      const key = `${route.world}|${route.available}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(route);
    }
    $("routes").innerHTML = [...groups].map(([, routes]) => {
      const world = D.worlds.find((w) => w.id === routes[0].world);
      return `<div class="panel route-world ${routes[0].available ? "" : "locked"}"><h3>${escape(world.name)} <span class="tag">${routes[0].available ? "AVAILABLE" : "LOCKED"}</span></h3>${routes.map((r) => `<div class="route-item"><strong>${link(r.url, r.enemy)}</strong> <span class="muted">· ${escape(r.room)}</span><p>${r.materials.map((m) => `<span>${escape(m.name)} ×${m.missing}${m.rate !== null ? ` <small>(${m.rate}% base drop)</small>` : ""}</span>`).join(" · ")}</p>${[...new Set(r.materials.map((m) => m.note).filter(Boolean))].map((note) => `<p class="muted">${escape(note)}</p>`).join("")}${r.available ? "" : `<p class="warning">Unlock: ${escape(r.reason)}</p>`}</div>`).join("")}</div>`;
    }).join("") || `<div class="empty">${plan.goals ? "No enemy farming sources needed yet. Mythril is chest / synthesis only; resolve any locked recipes above." : "Farming locations will follow the wish list and world progress."}</div>`;
    const ordered = [];
    const visited = new Set();
    function order(step) {
      if (visited.has(step)) return;
      visited.add(step);
      const recipe = D.byRecipe[step.name];
      for (const other of plan.steps) if (other !== step && (other.name === recipe.base || Object.hasOwn(step.ingredients, other.name))) order(other);
      ordered.push(step);
    }
    plan.steps.forEach(order);
    $("crafting").innerHTML = ordered.map((step, i) => `<div class="craft-step"><strong>${i + 1}. ${escape(step.name)} ×${step.quantity}</strong> · ${escape(step.purpose)}<span>${ingredientText(step.ingredients)}</span><span>${step.powered ? `${step.powered} craft(s) use ${escape(step.energy)}.` : "No Energy modifier used."}</span></div>`).join("") || "<p class='muted'>No crafts planned.</p>";
  }
  function renderRecipes() {
    const search = $("recipe-search").value.toLowerCase();
    const category = $("recipe-category").value;
    const recipes = D.recipes.filter((r) => (!category || category === r.category) && r.name.toLowerCase().includes(search));
    $("recipe-list").innerHTML = recipes.map((r) => `<article class="card"><h3><span class="rank">${r.rank}</span>${escape(r.name)}</h3><p>${escape(r.category)} · ${link(r.url, "Source")}</p><div class="ingredients">${ingredientText(r.ingredients)}${r.modifier ? ` · 1 ${escape(r.modifier)}` : ""}</div><p>${escape(r.unlock)}${r.base ? ` · First make ${escape(r.base)}` : ""}</p><div class="card-actions"><span class="${P.unlocked(r, state) ? "positive" : "warning"}">${P.unlocked(r, state) ? "Level / collection unlocked" : `Needs ${r.minLevel > state.moogle ? `Moogle Lv ${r.minLevel}` : `${r.types} material types`}`}</span><button data-add="${escape(r.name)}" class="${state.goals[r.name] ? "quiet" : "primary"}">${state.goals[r.name] ? `Added (${state.goals[r.name]})` : "Add"}</button></div></article>`).join("") || "<p class='muted'>No matching recipes.</p>";
  }
  function renderInventory() {
    const search = $("material-search").value.toLowerCase();
    const names = D.materialNames.filter((name) => name.toLowerCase().includes(search) && (!$("stock-only").checked || state.inventory[name]));
    $("inventory-list").innerHTML = names.map((name) => `<div class="stock-row ${state.inventory[name] ? "has-stock" : ""}"><label>${escape(name)}<input type="number" min="0" max="9999" step="1" value="${state.inventory[name] || 0}" data-stock="${escape(name)}" aria-label="${escape(name)} current stock"></label></div>`).join("") || "<p class='muted'>No matching materials.</p>";
  }
  function renderProgress() {
    $("all-chests").checked = chestWorlds.every((w) => state.chests[w.id]);
    $("all-chests").indeterminate = !$("all-chests").checked && chestWorlds.some((w) => state.chests[w.id]);
    $("optional-unlocks").innerHTML = D.optional.map(([id, name]) => `<label class="check"><input type="checkbox" data-optional="${id}" ${state.optional[id] ? "checked" : ""}>${escape(name)}</label>`).join("");
    $("world-list").innerHTML = D.worlds.map((w) => `<article class="card world-card"><h3>${escape(w.name)}</h3><label>Furthest reachable stage<select data-world="${w.id}" aria-label="${escape(w.name)} progress">${w.stages.map((stage, i) => `<option value="${i}" ${Number(state.worlds[w.id] || 0) === i ? "selected" : ""}>${escape(stage)}</option>`).join("")}</select></label>${w.id !== "at" ? `<label class="check"><input type="checkbox" data-chests="${w.id}" ${state.chests[w.id] ? "checked" : ""}> All chests here collected</label>` : "<p>Atlantica has musical rewards, not treasure chests.</p>"}</article>`).join("");
    $("material-types").value = state.materialTypes;
    $("orichalcum-rewards").innerHTML = D.rewards.slice(3).map((reward) => `<label class="check"><input type="checkbox" data-reward="${reward.id}" ${state.rewards[reward.id] ? "checked" : ""}>${escape(reward.label)}</label>`).join("");
  }
  function renderAll() { renderPlan(); renderRecipes(); renderInventory(); renderProgress(); }
  $("moogle").innerHTML = D.levels.map((name, i) => `<option value="${i + 1}">${i + 1} · ${name} Moogle</option>`).join("");
  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.tab) tab(button.dataset.tab);
    if (button.dataset.go) tab(button.dataset.go);
    if (button.dataset.add) {
      const name = button.dataset.add;
      state.goals[name] = Math.min(name === "Ultima Weapon" ? 1 : 99, (state.goals[name] || 0) + 1);
      save(); renderPlan(); renderRecipes();
      notice(`${name} added to the wish list.`);
    }
    if (button.dataset.remove) {
      delete state.goals[button.dataset.remove];
      save(); renderPlan(); renderRecipes();
    }
  });
  document.addEventListener("change", (event) => {
    const el = event.target;
    let changed = true;
    if (el.dataset.goal) {
      state.goals[el.dataset.goal] = Math.max(1, P.count(el.value, el.dataset.goal === "Ultima Weapon" ? 1 : 99));
      renderRecipes();
    } else if (el.dataset.stock) {
      state.inventory[el.dataset.stock] = P.count(el.value);
      el.value = state.inventory[el.dataset.stock];
      el.closest(".stock-row").classList.toggle("has-stock", el.value !== "0");
      state.materialTypes = Math.max(state.materialTypes, Object.values(state.inventory).filter((n) => n > 0).length);
      $("material-types").value = state.materialTypes;
      renderRecipes();
    } else if (el.dataset.crafted) state.crafted[el.dataset.crafted] = el.checked;
    else if (el.dataset.method) state.methods[el.dataset.method] = el.checked ? "craft" : "collect";
    else if (el.dataset.world) state.worlds[el.dataset.world] = P.count(el.value, 3);
    else if (el.dataset.chests) { state.chests[el.dataset.chests] = el.checked; renderProgress(); }
    else if (el.dataset.optional) state.optional[el.dataset.optional] = el.checked;
    else if (el.dataset.reward) state.rewards[el.dataset.reward] = el.checked;
    else if (el.id === "all-chests") { for (const w of chestWorlds) state.chests[w.id] = el.checked; renderProgress(); }
    else if (el.id === "moogle") { state.moogle = Math.max(1, P.count(el.value, 9)); renderRecipes(); }
    else if (el.id === "energy") state.energy = el.value;
    else if (el.id === "expand") state.expand = el.value === "true";
    else if (el.id === "material-types") { state.materialTypes = Math.max(P.count(el.value, 60), Object.values(state.inventory).filter((n) => n > 0).length); el.value = state.materialTypes; renderRecipes(); }
    else changed = false;
    if (changed) { save(); renderPlan(); }
  });
  $("show-owned").addEventListener("change", renderPlan);
  $("recipe-search").addEventListener("input", renderRecipes);
  $("recipe-category").addEventListener("change", renderRecipes);
  $("material-search").addEventListener("input", renderInventory);
  $("stock-only").addEventListener("change", renderInventory);
  $("export").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url; a.download = "kh2-synthesis-save.json"; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
  $("load-save").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > 1000000) throw new Error("Save file is too large (maximum 1 MB).");
      const next = P.sanitize(JSON.parse(await file.text()));
      if (!confirm("Replace this journal's current wish list, inventory and progress with the selected save?")) return;
      state = next; save(); renderAll(); notice("Save loaded.");
    } catch (error) { notice(`Could not load save: ${error.message}`); }
    finally { event.target.value = ""; }
  });

  let media;
  let mediaURL;
  let mediaReady = false;
  let worker;
  let controller;
  let importing = false;
  let review = [];
  let recipeReview = [];
  let reviewKind = "recipes";
  let currentKind = "recipes";
  let observations = [];
  let alignment = null;
  let aligning = false;
  let cornerPoints = [];
  const cropIds = ["crop-x", "crop-y", "crop-w", "crop-h"];
  function crop() {
    const x = P.count($("crop-x").value, 99);
    const y = P.count($("crop-y").value, 99);
    return { x, y, w: Math.max(1, Math.min(100 - x, P.count($("crop-w").value, 100))), h: Math.max(1, Math.min(100 - y, P.count($("crop-h").value, 100))) };
  }
  function setCrop(value) {
    for (const [key, val] of Object.entries(value)) $(`crop-${key}`).value = val;
    drawPreview();
  }
  function resetCrop() {
    alignment = null; aligning = false; cornerPoints = [];
    $("align-screen").textContent = "Align four corners";
    $("alignment-status").textContent = "Drag to crop, or align four corners to correct camera perspective.";
    setCrop($("import-kind").value === "recipes" ? { x: 25, y: 23, w: 26, h: 40 } : { x: 26, y: 28, w: 44, h: 49 });
  }
  function drawPreview() {
    if (!mediaReady) return;
    const canvas = $("preview");
    const width = media.videoWidth || media.naturalWidth;
    const height = media.videoHeight || media.naturalHeight;
    canvas.width = Math.min(1000, width);
    canvas.height = Math.round(canvas.width * height / width);
    const ctx = canvas.getContext("2d");
    ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
    if (alignment || aligning) {
      const points = alignment || cornerPoints;
      ctx.strokeStyle = "#8be2c9"; ctx.lineWidth = 2; ctx.fillStyle = "#8be2c9";
      if (points.length) {
        ctx.beginPath(); ctx.moveTo(points[0].x / 100 * canvas.width, points[0].y / 100 * canvas.height);
        for (const point of points.slice(1)) ctx.lineTo(point.x / 100 * canvas.width, point.y / 100 * canvas.height);
        if (alignment) ctx.closePath();
        ctx.stroke();
        for (const [i, point] of points.entries()) {
          ctx.beginPath(); ctx.arc(point.x / 100 * canvas.width, point.y / 100 * canvas.height, 5, 0, Math.PI * 2); ctx.fill();
          ctx.font = "bold 18px system-ui"; ctx.fillText(String(i + 1), point.x / 100 * canvas.width + 10, point.y / 100 * canvas.height - 8);
        }
      }
      return;
    }
    const c = crop();
    const x = c.x / 100 * canvas.width, y = c.y / 100 * canvas.height, w = c.w / 100 * canvas.width, h = c.h / 100 * canvas.height;
    ctx.fillStyle = "#0008";
    ctx.fillRect(0, 0, canvas.width, y); ctx.fillRect(0, y + h, canvas.width, canvas.height - y - h);
    ctx.fillRect(0, y, x, h); ctx.fillRect(x + w, y, canvas.width - x - w, h);
    ctx.strokeStyle = "#8be2c9"; ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    if ($("import-kind").value === "inventory" && $("two-columns").checked) {
      const split = Math.max(35, Math.min(65, Number($("column-split").value) || 52)) / 100;
      ctx.setLineDash([6, 6]); ctx.beginPath(); ctx.moveTo(x + w * split, y); ctx.lineTo(x + w * split, y + h); ctx.stroke();
    }
  }
  let dragStart;
  function position(event) {
    const rect = $("preview").getBoundingClientRect();
    return { x: Math.max(0, Math.min(99, (event.clientX - rect.left) / rect.width * 100)), y: Math.max(0, Math.min(99, (event.clientY - rect.top) / rect.height * 100)) };
  }
  $("preview").addEventListener("pointerdown", (event) => {
    if (importing) return;
    if (aligning) {
      cornerPoints.push(position(event));
      if (cornerPoints.length === 4) {
        const crosses = cornerPoints.map((point, i, all) => {
          const b = all[(i + 1) % 4], c = all[(i + 2) % 4];
          return (b.x - point.x) * (c.y - b.y) - (b.y - point.y) * (c.x - b.x);
        });
        if (crosses.some((cross) => cross < 1)) {
          cornerPoints = [];
          $("alignment-status").textContent = "Corners crossed or too close. Start again: top-left, top-right, bottom-right, bottom-left.";
        } else {
          alignment = cornerPoints; aligning = false;
          $("align-screen").textContent = "Realign four corners";
          $("alignment-status").textContent = "Perspective alignment set. The same table shape will be straightened in each frame. Reset crop removes alignment.";
        }
      } else $("alignment-status").textContent = `Click the ${["top-left", "top-right", "bottom-right", "bottom-left"][cornerPoints.length]} corner of the table.`;
      drawPreview();
      return;
    }
    alignment = null;
    dragStart = position(event); $("preview").setPointerCapture(event.pointerId);
  });
  $("preview").addEventListener("pointermove", (event) => {
    if (!dragStart) return;
    const end = position(event);
    setCrop({ x: Math.round(Math.min(dragStart.x, end.x)), y: Math.round(Math.min(dragStart.y, end.y)), w: Math.max(1, Math.round(Math.abs(end.x - dragStart.x))), h: Math.max(1, Math.round(Math.abs(end.y - dragStart.y))) });
  });
  for (const type of ["pointerup", "pointercancel"]) $("preview").addEventListener(type, () => { dragStart = null; });
  for (const id of cropIds) $(id).addEventListener("input", () => { alignment = null; drawPreview(); });
  $("crop-reset").addEventListener("click", resetCrop);
  $("align-screen").addEventListener("click", () => {
    if (!mediaReady || importing) return;
    aligning = !aligning; cornerPoints = [];
    $("align-screen").textContent = aligning ? "Cancel alignment" : alignment ? "Realign four corners" : "Align four corners";
    $("alignment-status").textContent = aligning ? "Click the top-left corner of the table (include names and counts)." : "Alignment selection cancelled.";
    drawPreview();
  });
  $("two-columns").addEventListener("change", drawPreview);
  $("column-split").addEventListener("input", drawPreview);
  function syncImportMode() {
    const recipes = currentKind === "recipes";
    for (const id of ["two-columns", "column-split", "sampling"]) $(id).closest("label").hidden = recipes;
    $("inventory-video-help").hidden = recipes;
    $("import-instructions").textContent = recipes
      ? "Read the left-hand recipe names only, including dim names. Scan both Recipes and Free Development: their results combine below. The right-hand ingredients / stock panel is not used. Import stock separately from the Materials list."
      : "Read stock from the game's Materials list, including names and quantities in both columns. Recipe photos are never used as inventory. Drag to crop, or align four corners if the screen is crooked.";
    $("paste-help").textContent = recipes ? "One recipe name per line, from either recipe list" : "One material and current count per line";
    $("ocr-text").placeholder = recipes ? "AP Boost\nPetite Ribbon\nMythril Shard\nAcrisius" : "Dense Shard 4\nEnergy Crystal 3";
    $("import-policy").textContent = recipes
      ? "Recipe imports add missing goals with quantity 1 and preserve existing desired quantities. Stock comes only from the Materials list import or manual Materials entry."
      : "Inventory imports replace only checked material totals; materials not detected are left unchanged.";
  }
  $("import-kind").addEventListener("change", () => {
    currentKind = $("import-kind").value;
    syncImportMode();
    resetCrop();
    reviewKind = currentKind;
    review = currentKind === "recipes" ? recipeReview : [];
    if (review.length) renderReview();
    else $("import-review").hidden = true;
    $("ocr-status").textContent = "Choose media or paste text for this import type.";
  });
  $("media-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    mediaReady = false; $("recognize").disabled = true;
    $("import-review").hidden = currentKind !== "recipes" || !recipeReview.length;
    if (mediaURL) URL.revokeObjectURL(mediaURL);
    $("video").pause(); $("video").removeAttribute("src"); $("video").load();
    mediaURL = URL.createObjectURL(file);
    $("media-name").textContent = file.name;
    $("ocr-status").textContent = "Opening media…";
    try {
      const videoFile = file.type.startsWith("video/") || /\.(mov|mp4|webm|m4v)$/i.test(file.name);
      if (videoFile) {
        $("import-kind").value = "inventory"; currentKind = "inventory";
        syncImportMode();
        $("import-review").hidden = true;
        media = $("video");
        await new Promise((resolve, reject) => {
          const timer = setTimeout(() => finish(new Error("Video could not be opened. Try an H.264 MP4 export.")), 15000);
          function finish(error) {
            clearTimeout(timer);
            media.removeEventListener("loadeddata", ready); media.removeEventListener("error", fail);
            if (error) reject(error); else resolve();
          }
          const ready = () => finish();
          const fail = () => finish(new Error("Video codec not supported by this browser. Export to H.264 MP4, or use screenshots."));
          media.addEventListener("loadeddata", ready, { once: true });
          media.addEventListener("error", fail, { once: true });
          media.src = mediaURL; media.load();
        });
        if (!Number.isFinite(media.duration) || !media.duration) throw new Error("Video duration could not be read. Export to H.264 MP4.");
        await R.seek(media, Math.min(0.1, media.duration / 2));
      } else {
        media = new Image();
        media.src = mediaURL;
        await media.decode();
      }
      mediaReady = true; $("media-preview").hidden = false; $("recognize").disabled = false;
      resetCrop();
      $("ocr-status").textContent = "Check the highlighted area, then read. All results remain editable.";
    } catch (error) { $("media-preview").hidden = true; $("ocr-status").textContent = error.message; }
  });
  function renderReview(unmatched = 0) {
    const recipes = reviewKind === "recipes";
    const names = recipes ? D.recipes.map((r) => r.name) : D.materialNames;
    $("import-review").hidden = false;
    $("review-rows").classList.toggle("recipe-review", recipes);
    $("review-instructions").textContent = recipes
      ? "Recipe names from Recipes and Free Development are combined. Unchecked names are ignored. No inventory counts are read from recipe photos."
      : "Applying replaces all previous stock. Omitted and unchecked materials become zero. Repeated video rows are not added together. Conflicting readings stay unchecked until reviewed. Names without a readable count are left blank.";
    $("review-rows").innerHTML = review.map((row, i) => `<div class="review-row"><input type="checkbox" data-review-check="${i}" aria-label="Import ${escape(row.name)}" ${row.checked ? "checked" : ""}><select data-review-name="${i}" aria-label="Recognized name ${i + 1}">${names.map((name) => `<option ${name === row.name ? "selected" : ""}>${escape(name)}</option>`).join("")}</select>${recipes ? "" : `<input type="number" min="0" max="9999" step="1" value="${row.quantity === null ? "" : row.quantity}" data-review-qty="${i}" aria-label="${escape(row.name)} imported quantity" placeholder="?">`}<small>${row.conflict ? `Conflicting counts: ${row.alternatives.join(", ")}. Choose the correct count.` : row.quantity === null ? "Count unreadable; enter it manually." : `${row.readings} reading(s) · confidence ${row.confidence}%`}</small>${!recipes && row.image ? `<figure class="review-source"><img src="${escape(row.image)}" alt="Original game row for ${escape(row.name)}" loading="lazy"><figcaption>${escape(row.source)} · Source for the OCR reading</figcaption></figure>` : ""}</div>`).join("");
    $("review-message").textContent = `${review.length} ${recipes ? "combined recipe names from Recipes / Free Development" : "recognized materials"}. ${unmatched ? `${unmatched} unrecognized text line(s); inspect the raw text and add anything missing manually.` : ""}${!review.length ? " Adjust the crop or use pasted text / manual entry." : ""}`;
    $("apply-import").disabled = !review.length;
    $("check-all-import").disabled = !review.length;
  }
  function combineReview(incoming) {
    if (reviewKind === "recipes") {
      const combined = new Map(recipeReview.map((row) => [row.name, row]));
      for (const row of incoming) if (!combined.has(row.name)) combined.set(row.name, row);
      recipeReview = [...combined.values()];
      review = recipeReview;
    } else review = incoming;
  }
  $("import-review").addEventListener("change", (event) => {
    const el = event.target;
    if (el.dataset.reviewCheck !== undefined) review[Number(el.dataset.reviewCheck)].checked = el.checked;
    if (el.dataset.reviewName !== undefined) review[Number(el.dataset.reviewName)].name = el.value;
    if (el.dataset.reviewQty !== undefined) review[Number(el.dataset.reviewQty)].quantity = el.value === "" ? null : P.count(el.value, reviewKind === "recipes" ? 99 : 9999);
  });
  $("check-all-import").addEventListener("click", () => {
    for (const row of review) row.checked = true;
    for (const checkbox of $("review-rows").querySelectorAll("[data-review-check]")) checkbox.checked = true;
  });
  $("parse-text").addEventListener("click", () => {
    reviewKind = $("import-kind").value;
    const parsed = R.parseLines($("ocr-text").value.split(/\r?\n/), reviewKind);
    combineReview(R.merge(parsed.rows)); renderReview(parsed.unmatched.length);
  });
  $("apply-import").addEventListener("click", () => {
    const checked = review.filter((row) => row.checked);
    if (!checked.length) { notice("Check at least one row before applying."); return; }
    if (checked.some((r) => r.quantity === null || (reviewKind === "recipes" && !r.quantity))) { notice("Enter a valid quantity for every checked row."); return; }
    const names = checked.map((r) => r.name);
    if (new Set(names).size !== names.length) { notice("Duplicate names in review. Uncheck or rename duplicate rows before applying."); return; }
    if (reviewKind === "inventory") state.inventory = {};
    for (const row of checked) {
      if (reviewKind === "recipes") state.goals[row.name] = state.goals[row.name] || 1;
      else state.inventory[row.name] = P.count(row.quantity);
    }
    if (reviewKind === "recipes") recipeReview = [];
    else state.materialTypes = Math.max(state.materialTypes, Object.values(state.inventory).filter((n) => n > 0).length);
    save(); renderAll();
    notice(reviewKind === "recipes" ? `${checked.length} recipe names combined with the wish list. Existing quantities and inventory were left unchanged.` : `Inventory replaced with ${checked.length} material totals. All previous stock was cleared.`);
  });
  function setImportBusy(busy) {
    importing = busy;
    for (const id of ["media-file", "import-kind", "two-columns", "column-split", "sampling", "parse-text", "crop-reset", "align-screen", ...cropIds]) $(id).disabled = busy;
    $("recognize").disabled = busy || !mediaReady;
    $("cancel-ocr").hidden = !busy;
    $("ocr-progress").hidden = !busy;
  }
  $("cancel-ocr").addEventListener("click", () => {
    controller?.abort();
    void worker?.terminate();
    worker = null;
    $("ocr-status").textContent = "Cancelling; partial readings will be available for review.";
  });
  $("recognize").addEventListener("click", async () => {
    if (!mediaReady || importing) return;
    controller = new AbortController();
    const signal = controller.signal;
    reviewKind = currentKind;
    observations = [];
    let unmatched = 0;
    const raw = [];
    const sourceReadings = new Map();
    let done = 0;
    setImportBusy(true);
    $("import-review").hidden = true;
    $("ocr-progress").value = 0;
    try {
      $("ocr-status").textContent = "Loading local recognition engine / English model…";
      const engine = await R.loadEngine();
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      worker = await engine.createWorker("eng", 1, {
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
        logger: (event) => {
          if (!done && !signal.aborted && event.status !== "recognizing text") $("ocr-status").textContent = `${event.status} ${Math.round((event.progress || 0) * 100)}%`;
        },
      });
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1", user_defined_dpi: "150" });
      const video = media === $("video");
      const interval = Number($("sampling").value);
      const frames = video ? Math.ceil(media.duration / interval) : 1;
      if (frames > 1200) throw new Error("This recording would need more than 1200 frames. Choose a slower sampling interval or trim the recording.");
      const columns = reviewKind === "inventory" && $("two-columns").checked ? 2 : 1;
      const total = frames * columns;
      const selectedCrop = crop();
      const selectedAlignment = alignment?.map((point) => ({ ...point }));
      if (aligning) throw new Error("Finish selecting all four corners, or cancel alignment before reading");
      for (let frame = 0; frame < frames; frame++) {
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        if (video) await R.seek(media, Math.min(frame * interval, media.duration - 0.01), signal);
        drawPreview();
        const frameMedia = selectedAlignment ? R.rectifyCanvas(media, selectedAlignment) : media;
        for (let column = 0; column < columns; column++) {
          if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
          $("ocr-status").textContent = `Reading ${video ? `frame ${frame + 1}/${frames}, ` : ""}column ${column + 1}/${columns}. ${Math.round(done / total * 100)}% complete.`;
          const canvas = R.cropCanvas(frameMedia, selectedAlignment ? { x: 0, y: 0, w: 100, h: 100 } : selectedCrop, column, columns, Number($("column-split").value) || 52);
          const numberColumn = reviewKind === "inventory" ? R.cropCanvas(frameMedia, selectedAlignment ? { x: 0, y: 0, w: 100, h: 100 } : selectedCrop, column, columns, Number($("column-split").value) || 52, false) : null;
          await worker.setParameters({ tessedit_pageseg_mode: "6", tessedit_char_whitelist: "" });
          const result = await worker.recognize(canvas);
          const lines = result.data.lines || result.data.text.split(/\r?\n/).map((text) => ({ text, confidence: result.data.confidence }));
          if (reviewKind === "inventory") {
            await worker.setParameters({ tessedit_pageseg_mode: "7", tessedit_char_whitelist: "0123456789" });
            for (const line of lines) {
              const parsed = R.parseLines([line], reviewKind, `${video ? `Video ${media.currentTime.toFixed(2)}s` : "Photo"}, column ${column + 1}`);
              unmatched += parsed.unmatched.length;
              if (!parsed.rows.length || !line.bbox) continue;
              if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
              const digits = await worker.recognize(R.quantityCanvas(numberColumn, line.bbox));
              const text = digits.data.text.trim();
              for (const row of parsed.rows) {
                row.quantity = /^\d{1,4}$/.test(text) ? Number(text) : null;
                row.confidence = Math.min(row.confidence, digits.data.confidence);
                const key = `${row.name}:${row.quantity}`;
                const previous = sourceReadings.get(key);
                if (!previous || row.confidence * row.score > previous.confidence * previous.score) {
                  if (previous) delete previous.image;
                  row.image = R.sourceCanvas(numberColumn, line.bbox).toDataURL("image/jpeg", 0.9);
                  sourceReadings.set(key, row);
                }
                observations.push(row);
              }
            }
          } else {
            const parsed = R.parseLines(lines, reviewKind, `Frame ${frame + 1}, column ${column + 1}`);
            observations.push(...parsed.rows);
            unmatched += parsed.unmatched.length;
          }
          raw.push(result.data.text);
          done++; $("ocr-progress").value = done / total;
        }
      }
      $("ocr-status").textContent = reviewKind === "recipes" ? "Reading complete. Recipe names combined below. Scan the other recipe list or apply checked names." : "Reading complete. Review recognized names and counts below.";
    } catch (error) {
      $("ocr-status").textContent = signal.aborted ? "Cancelled. Partial results are available below." : `Recognition stopped: ${error.message}. Manual entry and pasted text remain available.`;
    } finally {
      if (worker) { await worker.terminate().catch(() => {}); worker = null; }
      $("ocr-text").value = raw.join("\n");
      combineReview(R.merge(observations, media === $("video") ? 2 : 1)); renderReview(unmatched);
      setImportBusy(false);
    }
  });
  syncImportMode();
  renderAll();
  if (storageWarning) { notice(storageWarning); $("save-status").textContent = "Use Export save"; $("save-status").classList.add("storage-error"); }
})();

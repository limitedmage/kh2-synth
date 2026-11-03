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
    if (saved) {
      const raw = JSON.parse(saved);
      state = P.sanitize(raw);
      if (JSON.stringify(raw.goals) !== JSON.stringify(state.goals)) localStorage.setItem(storageKey, JSON.stringify(state));
    }
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
  const tabFragments = { plan: "plan", recipes: "recipes", inventory: "materials", progress: "world-progress", import: "import" };
  function tab(name, updateURL = true) {
    if (!Object.hasOwn(tabFragments, name)) name = "plan";
    for (const section of document.querySelectorAll("main > section")) section.hidden = section.id !== `tab-${name}`;
    for (const button of document.querySelectorAll("[data-tab]")) {
      const active = button.dataset.tab === name;
      button.classList.toggle("active", active);
      button.id = `nav-${button.dataset.tab}`;
      button.setAttribute("aria-controls", `tab-${button.dataset.tab}`);
      $(`tab-${button.dataset.tab}`).setAttribute("aria-labelledby", button.id);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    if (updateURL && location.hash !== `#${tabFragments[name]}`) location.hash = `#${tabFragments[name]}`;
  }
  function restoreTab() {
    const fragment = location.hash.slice(1).toLowerCase();
    const name = Object.keys(tabFragments).find((key) => tabFragments[key] === fragment) || (Object.hasOwn(tabFragments, fragment) ? fragment : "plan");
    tab(name, false);
    if (location.hash !== `#${tabFragments[name]}`) history.replaceState(null, "", `#${tabFragments[name]}`);
  }
  const link = (url, text) => `<a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(text)}</a>`;
  const icon = (kind, name) => globalThis.KH2Icons?.[kind]?.(name) || "";
  const ingredientText = (ingredients) => Object.entries(ingredients).map(([name, qty]) => `<span class="ingredient icon-label">${icon("material", name)}<span>${qty} ${escape(name)}</span></span>`).join(" · ");
  function wishlistAvailability(goals) {
    const allocated = {};
    return new Map(goals.map(([name]) => {
      const first = P.plan({ ...state, goals: { ...allocated, [name]: 1 } });
      const available = !first.warnings.length && !first.needed.length ? 1 : 0;
      if (available) allocated[name] = 1;
      const locks = [...first.warnings, ...first.requirements.filter((row) => row.locked).map((row) => `${row.name}: ${D.byRecipe[row.name].unlock}.`)];
      const status = available ? "ready" : locks.length ? "locked" : "missing";
      return [name, { available, status, reason: locks.join(" ") }];
    }));
  }
  function wishlistIngredients(plan) {
    const ingredients = new Map();
    for (const step of plan.steps) {
      if (!step.goal) continue;
      if (!ingredients.has(step.goal)) ingredients.set(step.goal, {});
      const costs = ingredients.get(step.goal);
      for (const [name, required] of Object.entries(step.ingredients)) {
        if (required) costs[name] = (costs[name] || 0) + required;
      }
    }
    return ingredients;
  }
  function wishlistIngredient(name, required) {
    const owned = P.count(state.inventory[name]);
    return `<span class="wishlist-ingredient ${owned >= required ? "ingredient-covered" : "ingredient-short"}" data-material="${escape(name)}" data-owned="${owned}" data-required="${required}" role="img" aria-label="${escape(`${name}: ${owned} owned / ${required} required`)}">${icon("material", name)}<span aria-hidden="true">${escape(name)} <strong class="wishlist-ratio">${owned}/${required}</strong></span></span>`;
  }
  function renderPlan() {
    const plan = P.plan(state);
    $("moogle").value = state.moogle;
    $("energy").value = state.energy;
    $("expand").value = String(state.expand);
    $("lucky-lucky").value = state.luckyLuckyCount;
    const discounts = [["C", 5], ["B", 6], ["A", 7], ["S", 9]].filter(([, level]) => state.moogle >= level).map(([rank]) => rank);
    $("moogle-perks").textContent = [
      state.moogle >= 2 ? "Energy enabled" : "Energy unlocks at level 2",
      state.moogle >= 3 ? "Serenity upgrades enabled" : "Upgrades unlock at level 3",
      state.moogle >= 4 ? "Energy + Serenity enabled" : "Energy + Serenity unlocks at level 4",
      discounts.length ? `Half-cost ranks: ${discounts.join(", ")} (Energy stacks; round up per craft)` : "No automatic rank discounts yet",
    ].join(" · ");
    $("plan-count").textContent = plan.goals ? `(${plan.goals})` : "";
    $("summary").innerHTML = `<div class="stat"><strong>${plan.goals}</strong><span>items on the wishlist</span></div><div class="stat"><strong>${plan.needed.reduce((n, r) => n + r.missing, 0)}</strong><span>materials to collect</span></div><div class="stat"><strong>${plan.routes.filter((r) => r.available).length}</strong><span>available sources</span></div>`;
    const goals = Object.entries(state.goals).filter(([, qty]) => qty);
    const availability = wishlistAvailability(goals);
    const conflicts = P.wishlistConflicts(state);
    const goalIngredients = wishlistIngredients(plan);
    $("goals").innerHTML = goals.length ? `<h3>Wishlist</h3>${goals.map(([name]) => {
      const recipe = D.byRecipe[name];
      const ready = availability.get(name);
      const ingredients = goalIngredients.get(name);
      const chips = Object.entries(ingredients || P.costs(recipe, state, recipe.name === "Ultima Weapon")).filter(([, required]) => required).map(([material, required]) => wishlistIngredient(material, required)).join("");
      const ingredientRow = `<div class="goal-ingredients wishlist-ingredients" role="group" aria-label="${escape(`${name} ingredients${ingredients ? ", including prerequisites" : " — locked recipe preview, before prerequisites or Energy"}`)}">${ingredients ? "" : '<span class="ingredient-preview">Locked preview</span>'}${chips}</div>`;
      const label = ready.status === "ready" ? "Ready to craft" : ready.status === "locked" ? "Locked" : "Needs materials";
      const statusIcon = `<svg class="craftability-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${ready.status === "ready" ? 'role="img" aria-label="Ready to craft"' : 'aria-hidden="true"'} focusable="false">${ready.status === "ready" ? '<path d="m4 12 5 5L20 6"/><path d="m15 5 5 1-1 5" stroke-width="1"/>' : ready.status === "locked" ? '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>' : '<path d="m12 3 9 9-9 9-9-9Z"/><path d="M8 12h8"/>'}</svg>`;
      const status = ready.reason
        ? `<details class="craftability"><summary class="craftability-label" aria-label="${escape(`${label}: ${ready.reason}`)}" title="${escape(`${label}: ${ready.reason}`)}">${statusIcon}</summary><small class="craftability-detail">${escape(ready.reason)}</small></details>`
        : `<span class="craftability craftability-label" ${ready.status === "ready" ? "" : `role="img" aria-label="${label}"`} title="${label}">${statusIcon}</span>`;
      const conflict = ready.status === "ready" ? conflicts.get(name) : undefined;
      const conflictText = conflict ? `Shared materials warning: crafting ${name} increases shortfalls for ${conflict.items.join(", ")}. ${conflict.materials.map((material) => `${material.name}: ${material.before} → ${material.after} missing`).join("; ")}.` : "";
      const warning = conflict ? `<details class="craft-conflict"><summary aria-label="${escape(conflictText)}" title="${escape(conflictText)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3v.1"/></svg></summary><small class="craftability-detail">${escape(conflictText)}</small></details>` : "";
      return `<div class="goal craftability-${ready.status}" data-goal="${escape(name)}" data-craftable="${ready.available}"><div class="goal-main"><div class="goal-name" title="${escape(name)} · Rank ${recipe.rank} · ${escape(recipe.category)}"><span class="icon-label">${icon("item", name)}<span class="goal-title">${escape(name)}</span></span><small>Rank ${recipe.rank} · ${escape(recipe.category)}</small></div>${recipe.base ? `<label class="check goal-base" title="${escape(recipe.base)} already made"><input type="checkbox" data-crafted="${escape(recipe.base)}" aria-label="${escape(recipe.base)} already made" ${state.crafted[recipe.base] ? "checked" : ""}><span>Base<span class="goal-base-extra"> made</span></span></label>` : ""}${warning}${status}<button class="quiet goal-remove" data-remove="${escape(name)}" aria-label="Remove ${escape(name)}" title="Remove ${escape(name)}"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m7 7 10 10M17 7 7 17"/></svg></button></div>${ingredientRow}</div>`;
    }).join("")}` : `<div class="empty"><h3>No recipes yet</h3><p>Choose recipes or import a game photo.</p><button class="primary" data-go="recipes">Choose recipes</button> <button class="quiet" data-go="import">Import a photo</button></div>`;
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
      return `<tr><td><span class="icon-label">${icon("material", row.name)}${link(D.materials[row.name].url, row.name)}</span>${row.bonus ? `<small>Includes ${row.bonus} from a base-recipe prerequisite</small>` : ""}</td><td class="numeric">${row.required}</td><td class="numeric">${row.owned}</td><td class="numeric ${row.missing ? "warning" : "positive"}">${row.missing || "—"}</td><td>${escape(note)}${craftable && row.missing && state.expand ? `<label class="check"><input type="checkbox" data-method="${escape(row.name)}" ${(state.methods[row.name] ? state.methods[row.name] === "craft" : row.name.startsWith("Mythril")) ? "checked" : ""}> Plan synthesis for this material</label>${craftable.base ? `<label class="check"><input type="checkbox" data-crafted="${escape(craftable.base)}" ${state.crafted[craftable.base] ? "checked" : ""}> ${escape(craftable.base)} already made</label>` : ""}` : ""}</td></tr>`;
    }).join("")}</tbody></table></div>` : `<div class="empty">${plan.goals ? (plan.warnings.length ? "Resolve the locked recipes above to calculate their ingredients." : "The entered stock covers the plan.") : "Missing materials will appear here."}</div>`;
    const groups = new Map();
    for (const route of plan.routes.toSorted((a, b) => Number(b.available) - Number(a.available))) {
      const key = `${route.world}|${route.available}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(route);
    }
    $("routes").innerHTML = [...groups].map(([, routes]) => {
      const world = D.worlds.find((w) => w.id === routes[0].world);
      return `<div class="panel route-world ${routes[0].available ? "" : "locked"}"><h3>${escape(world.name)} <span class="tag">${routes[0].available ? "AVAILABLE" : "LOCKED"}</span></h3>${routes.map((r) => `<div class="route-item"><strong>${link(r.url, r.enemy)}</strong> <span class="muted">· ${escape(r.room)}</span><p>${r.materials.map((m) => `<span class="drop-material icon-label">${icon("material", m.name)}<span>${escape(m.name)} ×${m.missing} <small>(${m.effectiveRate !== null ? `${m.effectiveRate}% effective · ${m.rate}% base` : "drop rate unknown"})</small></span></span>`).join(" · ")}</p>${[...new Set(r.materials.map((m) => m.note).filter(Boolean))].map((note) => `<p class="muted">${escape(note)}</p>`).join("")}${r.available ? "" : `<p class="warning">Unlock: ${escape(r.reason)}</p>`}</div>`).join("")}</div>`;
    }).join("") || `<div class="empty">${plan.goals ? "No enemy farming sources needed yet. Mythril is chest / synthesis only; resolve any locked recipes above." : "Farming locations will follow the wish list and world progress."}</div>`;
  }
  function renderRecipes() {
    const search = $("recipe-search").value.toLowerCase();
    const category = $("recipe-category").value;
    const recipes = D.recipes.filter((r) => (!category || category === r.category) && r.name.toLowerCase().includes(search));
    $("recipe-list").innerHTML = recipes.map((r) => `<article class="card"><h3><span class="rank">${r.rank}</span><span class="icon-label">${icon("item", r.name)}${escape(r.name)}</span></h3><p>${escape(r.category)} · ${link(r.url, "Source")}</p><div class="ingredients">${ingredientText(r.ingredients)}${r.modifier ? ` · ${ingredientText({ [r.modifier]: 1 })}` : ""}</div><p>${escape(r.unlock)}${r.base ? ` · First make ${escape(r.base)}` : ""}</p><div class="card-actions"><span class="${P.unlocked(r, state) ? "positive" : "warning"}">${P.unlocked(r, state) ? "Unlocked" : `Needs ${r.minLevel > state.moogle ? `Moogle Lv ${r.minLevel}` : `${r.types} material types`}`}</span><button data-add="${escape(r.name)}" class="${state.goals[r.name] ? "quiet" : "primary"}">${state.goals[r.name] ? "Added" : "Add"}</button></div></article>`).join("") || "<p class='muted'>No matching recipes.</p>";
  }
  function renderInventory() {
    const search = $("material-search").value.toLowerCase();
    const names = D.materialNames.filter((name) => name.toLowerCase().includes(search) && (!$("stock-only").checked || state.inventory[name]));
    $("inventory-list").innerHTML = names.map((name) => `<div class="stock-row ${state.inventory[name] ? "has-stock" : ""}"><label><span class="icon-label">${icon("material", name)}${escape(name)}</span><input type="number" min="0" max="9999" step="1" value="${state.inventory[name] || 0}" data-stock="${escape(name)}" aria-label="${escape(name)} current stock"></label></div>`).join("") || "<p class='muted'>No matching materials.</p>";
  }
  function renderProgress() {
    $("all-chests").checked = chestWorlds.every((w) => state.chests[w.id]);
    $("all-chests").indeterminate = !$("all-chests").checked && chestWorlds.some((w) => state.chests[w.id]);
    $("optional-unlocks").innerHTML = D.optional.map(([id, name]) => `<label class="check"><input type="checkbox" data-optional="${id}" ${state.optional[id] ? "checked" : ""}>${escape(name)}</label>`).join("");
    $("world-list").innerHTML = D.worlds.map((w) => `<article class="card world-card"><h3>${escape(w.name)}</h3><label>World progress<select data-world="${w.id}" aria-label="${escape(w.name)} progress">${w.stages.map((stage, i) => `<option value="${i}" ${Number(state.worlds[w.id] || 0) === i ? "selected" : ""}>${escape(stage)}</option>`).join("")}</select></label>${w.id !== "at" ? `<label class="check"><input type="checkbox" data-chests="${w.id}" ${state.chests[w.id] ? "checked" : ""}> All chests collected</label>` : "<p>Musical rewards; no treasure chests.</p>"}</article>`).join("");
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
    if (button.id === "endgame-worlds") {
      for (const world of D.worlds) state.worlds[world.id] = world.stages.length - 1;
      for (const [id] of D.optional) state.optional[id] = true;
      save(); renderProgress(); renderPlan();
      notice("All worlds and optional areas unlocked. Chests and inventory unchanged.");
    }
    if (button.dataset.add) {
      const name = button.dataset.add;
      state.goals[name] = 1;
      save(); renderPlan(); renderRecipes();
      notice(`${name} added to the wishlist.`);
    }
    if (button.dataset.remove) {
      delete state.goals[button.dataset.remove];
      save(); renderPlan(); renderRecipes();
    }
  });
  document.addEventListener("change", (event) => {
    const el = event.target;
    let changed = true;
    if (el.dataset.stock) {
      state.inventory[el.dataset.stock] = P.count(el.value);
      el.value = state.inventory[el.dataset.stock];
      el.closest(".stock-row").classList.toggle("has-stock", el.value !== "0");
      state.materialTypes = Math.max(state.materialTypes, Object.values(state.inventory).filter((n) => n > 0).length);
      $("material-types").value = state.materialTypes;
      renderRecipes();
    } else if (el.dataset.crafted) state.crafted[el.dataset.crafted] = el.checked;
    else if (el.dataset.method) state.methods[el.dataset.method] = el.checked ? "craft" : "collect";
    else if (el.dataset.world) state.worlds[el.dataset.world] = P.count(el.value, D.worlds.find((world) => world.id === el.dataset.world).stages.length - 1);
    else if (el.dataset.chests) { state.chests[el.dataset.chests] = el.checked; renderProgress(); }
    else if (el.dataset.optional) state.optional[el.dataset.optional] = el.checked;
    else if (el.dataset.reward) state.rewards[el.dataset.reward] = el.checked;
    else if (el.id === "all-chests") { for (const w of chestWorlds) state.chests[w.id] = el.checked; renderProgress(); }
    else if (el.id === "moogle") { state.moogle = Math.max(1, P.count(el.value, 9)); renderRecipes(); }
    else if (el.id === "energy") state.energy = el.value;
    else if (el.id === "expand") state.expand = el.value === "true";
    else if (el.id === "lucky-lucky") { state.luckyLuckyCount = P.count(el.value, Number.MAX_SAFE_INTEGER); el.value = state.luckyLuckyCount; }
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
      if (!confirm("Replace this journal's current wish list, inventory and progress with the selected save? Each wishlist recipe will be included once.")) return;
      state = next; save(); renderAll(); notice("Save loaded.");
    } catch (error) { notice(`Could not load save: ${error.message}`); }
    finally { event.target.value = ""; }
  });
  window.addEventListener("hashchange", restoreTab);
  restoreTab();

  let media;
  let mediaURL;
  let mediaReady = false;
  let worker;
  let numberWorker;
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
  let cornerDrag = null;
  let cropArea = { x: 25, y: 23, w: 26, h: 40 };
  function setCrop(value) {
    cropArea = value;
    drawPreview();
  }
  function resetCrop() {
    aligning = false; cornerPoints = []; dragStart = null; cornerDrag = null;
    cropArea = $("import-kind").value === "recipes" ? { x: 25, y: 23, w: 26, h: 40 } : { x: 26, y: 28, w: 44, h: 49 };
    const { x, y, w, h } = cropArea;
    const candidate = mediaReady ? R.detectCorners(media, currentKind) : null;
    const detected = candidate && validCorners(candidate) ? candidate : null;
    alignment = detected || [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }];
    if (detected && currentKind === "inventory") $("column-split").value = String(detected.columnSplit || 50);
    $("align-screen").textContent = "Realign four corners";
    $("alignment-status").textContent = detected
      ? "Table detected. Drag corners to adjust."
      : "Table not detected. Drag the corners into place.";
    drawPreview();
  }
  function validCorners(points) {
    return points.every((point, i, all) => {
      const b = all[(i + 1) % 4], c = all[(i + 2) % 4];
      return (b.x - point.x) * (c.y - b.y) - (b.y - point.y) * (c.x - b.x) >= 1;
    });
  }
  function startAlignment() {
    aligning = true; cornerPoints = []; dragStart = null; cornerDrag = null;
    $("align-screen").textContent = "Cancel alignment";
    $("alignment-status").textContent = "Click the top-left corner of the table (include names and counts).";
    drawPreview();
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
      const points = aligning ? cornerPoints : alignment;
      ctx.strokeStyle = "#8be2c9"; ctx.lineWidth = 2; ctx.fillStyle = "#8be2c9";
      if (points.length) {
        ctx.beginPath(); ctx.moveTo(points[0].x / 100 * canvas.width, points[0].y / 100 * canvas.height);
        for (const point of points.slice(1)) ctx.lineTo(point.x / 100 * canvas.width, point.y / 100 * canvas.height);
        if (!aligning) ctx.closePath();
        ctx.stroke();
        for (const [i, point] of points.entries()) {
          ctx.beginPath(); ctx.arc(point.x / 100 * canvas.width, point.y / 100 * canvas.height, 5, 0, Math.PI * 2); ctx.fill();
          ctx.font = "bold 18px system-ui"; ctx.fillText(String(i + 1), point.x / 100 * canvas.width + 10, point.y / 100 * canvas.height - 8);
        }
        if (!aligning && currentKind === "inventory" && $("two-columns").checked) {
          const split = Math.max(35, Math.min(65, Number($("column-split").value) || 52)) / 100;
          const [tl, tr, br, bl] = points;
          ctx.setLineDash([6, 6]); ctx.beginPath();
          ctx.moveTo((tl.x + (tr.x - tl.x) * split) / 100 * canvas.width, (tl.y + (tr.y - tl.y) * split) / 100 * canvas.height);
          ctx.lineTo((bl.x + (br.x - bl.x) * split) / 100 * canvas.width, (bl.y + (br.y - bl.y) * split) / 100 * canvas.height);
          ctx.stroke();
        }
      }
      return;
    }
    const c = cropArea;
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
    if (importing || !mediaReady) return;
    if (alignment && !aligning) {
      const point = position(event);
      const rect = $("preview").getBoundingClientRect();
      const index = alignment.findIndex((corner) => Math.hypot((corner.x - point.x) / 100 * rect.width, (corner.y - point.y) / 100 * rect.height) <= 18);
      if (index !== -1) {
        cornerDrag = index; $("preview").setPointerCapture(event.pointerId);
        return;
      }
    }
    if (media === $("video") && !aligning) startAlignment();
    if (aligning) {
      cornerPoints.push(position(event));
      if (cornerPoints.length === 4) {
        if (!validCorners(cornerPoints)) {
          cornerPoints = [];
          $("alignment-status").textContent = "Corners crossed or too close. Start again: top-left, top-right, bottom-right, bottom-left.";
        } else {
          alignment = cornerPoints; aligning = false;
          $("align-screen").textContent = "Realign four corners";
          $("alignment-status").textContent = "Corners set. Drag to adjust; Reset corners retries detection.";
        }
      } else $("alignment-status").textContent = `Click the ${["top-left", "top-right", "bottom-right", "bottom-left"][cornerPoints.length]} corner of the table.`;
      drawPreview();
      return;
    }
    alignment = null;
    dragStart = position(event); $("preview").setPointerCapture(event.pointerId);
  });
  $("preview").addEventListener("pointermove", (event) => {
    if (importing) return;
    if (cornerDrag !== null) {
      const next = alignment.map((point, i) => i === cornerDrag ? position(event) : point);
      if (validCorners(next)) {
        alignment = next;
        $("alignment-status").textContent = "Corners updated.";
        drawPreview();
      }
      return;
    }
    if (!dragStart) return;
    const end = position(event);
    setCrop({ x: Math.round(Math.min(dragStart.x, end.x)), y: Math.round(Math.min(dragStart.y, end.y)), w: Math.max(1, Math.round(Math.abs(end.x - dragStart.x))), h: Math.max(1, Math.round(Math.abs(end.y - dragStart.y))) });
  });
  for (const type of ["pointerup", "pointercancel"]) $("preview").addEventListener(type, () => { dragStart = null; cornerDrag = null; });
  $("crop-reset").addEventListener("click", resetCrop);
  $("align-screen").addEventListener("click", () => {
    if (!mediaReady || importing) return;
    if (!aligning) { startAlignment(); return; }
    aligning = false; cornerPoints = [];
    $("align-screen").textContent = alignment ? "Realign four corners" : "Align four corners";
    $("alignment-status").textContent = "Alignment selection cancelled.";
    drawPreview();
  });
  $("two-columns").addEventListener("change", drawPreview);
  $("column-split").addEventListener("input", drawPreview);
  function syncImportMode() {
    const recipes = currentKind === "recipes";
    for (const id of ["two-columns", "column-split", "sampling"]) $(id).closest("label").hidden = recipes;
    $("inventory-video-help").hidden = recipes;
    $("import-instructions").textContent = recipes
      ? "Scan the left-hand names in Recipes and Free Development. Both lists combine here; ingredients and stock are ignored."
      : "Scan the Materials table. Check the corners and column divider before reading.";
    $("paste-help").textContent = recipes ? "One recipe name per line, from either recipe list" : "One material and current count per line";
    $("ocr-text").placeholder = recipes ? "AP Boost\nPetite Ribbon\nMythril Shard\nAcrisius" : "Dense Shard 4\nEnergy Crystal 3";
    $("import-policy").textContent = recipes
      ? "Adds recipes to the wishlist. Inventory stays unchanged."
      : "Replaces inventory. Omitted or unchecked materials become zero.";
  }
  $("import-kind").addEventListener("change", () => {
    currentKind = $("import-kind").value;
    syncImportMode();
    resetCrop();
    reviewKind = currentKind;
    review = currentKind === "recipes" ? recipeReview : [];
    if (review.length) renderReview();
    else $("import-review").hidden = true;
    $("ocr-status").textContent = "Choose a photo or video, or paste a list.";
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
      $("ocr-status").textContent = "Check the selected table corners, then read. All results remain editable.";
    } catch (error) { $("media-preview").hidden = true; $("ocr-status").textContent = error.message; }
  });
  function renderReview(unmatched = 0) {
    const recipes = reviewKind === "recipes";
    const names = recipes ? D.recipes.map((r) => r.name) : D.materialNames;
    $("import-review").hidden = false;
    $("review-rows").classList.toggle("recipe-review", recipes);
    $("review-instructions").textContent = recipes
      ? "Select the recipes to add."
      : "Check counts against the images. Conflicts stay unchecked; unreadable counts are blank. Repeated rows are not added together.";
    $("review-rows").innerHTML = review.map((row, i) => `<div class="review-row${!recipes && row.image ? " has-source" : ""}"><input type="checkbox" data-review-check="${i}" aria-label="Import ${escape(row.name)}" ${row.checked ? "checked" : ""}><div class="review-name"><span class="review-icon" aria-hidden="true">${icon(recipes ? "item" : "material", row.name)}</span><select data-review-name="${i}" aria-label="Recognized name ${i + 1}">${names.map((name) => `<option ${name === row.name ? "selected" : ""}>${escape(name)}</option>`).join("")}</select></div>${recipes ? "" : `<input type="number" min="0" max="9999" step="1" value="${row.quantity === null ? "" : row.quantity}" data-review-qty="${i}" aria-label="${escape(row.name)} imported quantity" placeholder="?">`}<small>${row.conflict ? `Conflicting counts: ${row.alternatives.join(", ")}. Choose the correct count.` : row.quantity === null ? "Count unreadable; enter it manually." : `${row.readings} reading(s) · confidence ${row.confidence}%`}</small>${!recipes && row.image ? `<figure class="review-source"><img src="${escape(row.image)}" alt="Original game row for ${escape(row.name)}" title="${escape(row.source)}" loading="lazy"></figure>` : ""}</div>`).join("");
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
    if (el.dataset.reviewName !== undefined) {
      review[Number(el.dataset.reviewName)].name = el.value;
      const row = el.closest(".review-row");
      row.querySelector(".review-icon").innerHTML = icon(reviewKind === "recipes" ? "item" : "material", el.value);
      row.querySelector("[data-review-check]").setAttribute("aria-label", `Import ${el.value}`);
      row.querySelector("[data-review-qty]")?.setAttribute("aria-label", `${el.value} imported quantity`);
    }
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
    if (reviewKind === "inventory" && checked.some((r) => r.quantity === null)) { notice("Enter a valid quantity for every checked row."); return; }
    const names = checked.map((r) => r.name);
    if (new Set(names).size !== names.length) { notice("Duplicate names in review. Uncheck or rename duplicate rows before applying."); return; }
    if (reviewKind === "inventory") state.inventory = {};
    for (const row of checked) {
      if (reviewKind === "recipes") state.goals[row.name] = 1;
      else state.inventory[row.name] = P.count(row.quantity);
    }
    if (reviewKind === "recipes") recipeReview = [];
    else state.materialTypes = Math.max(state.materialTypes, Object.values(state.inventory).filter((n) => n > 0).length);
    save(); renderAll();
    notice(reviewKind === "recipes" ? `${checked.length} recipes added. Inventory unchanged.` : `Inventory replaced (${checked.length} materials).`);
  });
  function setImportBusy(busy) {
    importing = busy;
    for (const id of ["media-file", "import-kind", "two-columns", "column-split", "sampling", "parse-text", "crop-reset", "align-screen"]) $(id).disabled = busy;
    $("recognize").disabled = busy || !mediaReady;
    $("cancel-ocr").hidden = !busy;
    $("ocr-progress").hidden = !busy;
  }
  $("cancel-ocr").addEventListener("click", () => {
    controller?.abort();
    void worker?.terminate();
    void numberWorker?.terminate();
    worker = null;
    numberWorker = null;
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
      $("ocr-status").textContent = "Loading text recognition…";
      const engine = await R.loadEngine();
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      const workerOptions = {
        workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
        corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
        langPath: "https://tessdata.projectnaptha.com/4.0.0",
        logger: (event) => {
          if (!done && !signal.aborted && event.status !== "recognizing text") $("ocr-status").textContent = `${event.status} ${Math.round((event.progress || 0) * 100)}%`;
        },
      };
      worker = await engine.createWorker("eng", 1, workerOptions);
      if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1", user_defined_dpi: "150" });
      if (reviewKind === "inventory") {
        numberWorker = await engine.createWorker("eng", 2, { ...workerOptions, legacyCore: true, legacyLang: true });
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        // Keep misread digits from retraining the classifier across video frames.
        await numberWorker.setParameters({ tessedit_pageseg_mode: "7", tessedit_char_whitelist: "0123456789", classify_enable_learning: "0", classify_enable_adaptive_matcher: "0", user_defined_dpi: "150" });
      }
      const video = media === $("video");
      const interval = Number($("sampling").value);
      const frames = video ? Math.ceil(media.duration / interval) : 1;
      if (frames > 1200) throw new Error("This recording would need more than 1200 frames. Choose a slower sampling interval or trim the recording.");
      const columns = reviewKind === "inventory" && $("two-columns").checked ? 2 : 1;
      const total = frames * columns;
      const selectedCrop = { ...cropArea };
      const selectedAlignment = alignment?.map((point) => ({ ...point }));
      if (aligning) throw new Error("Finish selecting all four corners, or cancel alignment before reading");
      for (let frame = 0; frame < frames; frame++) {
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
        if (video) await R.seek(media, Math.min(frame * interval, media.duration - 0.01), signal);
        drawPreview();
        const frameMedia = selectedAlignment ? R.rectifyCanvas(media, selectedAlignment, reviewKind === "inventory" ? 0.08 : 0) : media;
        for (let column = 0; column < columns; column++) {
          if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
          $("ocr-status").textContent = `Reading ${video ? `frame ${frame + 1}/${frames}, ` : ""}column ${column + 1}/${columns}. ${Math.round(done / total * 100)}% complete.`;
          const numberColumn = reviewKind === "inventory" ? R.cropCanvas(frameMedia, selectedAlignment ? { x: 0, y: 0, w: 100, h: 100 } : selectedCrop, column, columns, Number($("column-split").value) || 52, false) : null;
          const canvas = numberColumn ? R.inventoryCanvas(numberColumn) : R.cropCanvas(frameMedia, selectedAlignment ? { x: 0, y: 0, w: 100, h: 100 } : selectedCrop, column, columns, Number($("column-split").value) || 52);
          const result = await worker.recognize(canvas);
          const lines = result.data.lines || result.data.text.split(/\r?\n/).map((text) => ({ text, confidence: result.data.confidence }));
          if (reviewKind === "inventory") {
            const columnText = [];
            for (const line of lines) {
              const parsed = R.parseLines([line], reviewKind, `${video ? `Video ${media.currentTime.toFixed(2)}s` : "Photo"}, column ${column + 1}`);
              unmatched += parsed.unmatched.length;
              if (!parsed.rows.length || !line.bbox) { columnText.push(line.text); continue; }
              if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
              const countCanvas = R.quantityCanvas(numberColumn, line.bbox);
              let digits = await numberWorker.recognize(countCanvas);
              if (digits.data.confidence < 85) {
                await numberWorker.setParameters({ tessedit_pageseg_mode: "8" });
                const alternate = await numberWorker.recognize(countCanvas);
                await numberWorker.setParameters({ tessedit_pageseg_mode: "7" });
                if (/^\d{1,4}$/.test(alternate.data.text.trim()) && alternate.data.confidence > digits.data.confidence) digits = alternate;
              }
              const text = R.quantityText(countCanvas, digits.data.text.trim());
              for (const row of parsed.rows) {
                row.quantity = /^\d{1,4}$/.test(text) && digits.data.confidence >= 65 ? Number(text) : null;
                columnText.push(`${row.name}${row.quantity === null ? "" : ` ${row.quantity}`}`);
                row.confidence = Math.min(row.confidence, digits.data.confidence);
                const key = `${row.name}:${row.quantity}`;
                const previous = sourceReadings.get(key);
                if (!previous || row.confidence * row.score > previous.confidence * previous.score) {
                  if (previous) delete previous.image;
                  const sourceBounds = countCanvas.sourceBounds || line.bbox;
                  row.image = R.sourceCanvas(numberColumn, { y0: Math.min(line.bbox.y0, sourceBounds.y0), y1: Math.max(line.bbox.y1, sourceBounds.y1) }).toDataURL("image/jpeg", 0.9);
                  sourceReadings.set(key, row);
                }
                observations.push(row);
              }
            }
            raw.push(columnText.join("\n"));
          } else {
            const parsed = R.parseLines(lines, reviewKind, `Frame ${frame + 1}, column ${column + 1}`);
            observations.push(...parsed.rows);
            unmatched += parsed.unmatched.length;
            raw.push(result.data.text);
          }
          done++; $("ocr-progress").value = done / total;
        }
      }
      $("ocr-status").textContent = reviewKind === "recipes" ? "Reading complete. Recipe names combined below. Scan the other recipe list or apply checked names." : "Reading complete. Review recognized names and counts below.";
    } catch (error) {
      $("ocr-status").textContent = signal.aborted ? "Cancelled. Partial results are available below." : `Recognition stopped: ${error.message}. Manual entry and pasted text remain available.`;
    } finally {
      if (worker) { await worker.terminate().catch(() => {}); worker = null; }
      if (numberWorker) { await numberWorker.terminate().catch(() => {}); numberWorker = null; }
      $("ocr-text").value = raw.join("\n");
      combineReview(R.merge(observations, media === $("video") ? 2 : 1)); renderReview(unmatched);
      setImportBusy(false);
    }
  });
  syncImportMode();
  renderAll();
  if (storageWarning) { notice(storageWarning); $("save-status").textContent = "Use Export save"; $("save-status").classList.add("storage-error"); }
})();

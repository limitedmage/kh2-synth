import data from "../data.js";
import planner from "../planner.js";
import { escape, icon, link, on } from "../dom.js";
import { groupRoutes, wishlistAvailability, wishlistIngredients } from "../selectors.js";

function readinessIndicator(ready) {
  const label = ready.status === "ready" ? "Ready to craft" : ready.status === "locked" ? "Locked" : "Needs materials";
  const paths = {
    ready: '<path d="m4 12 5 5L20 6"/><path d="m15 5 5 1-1 5" stroke-width="1"/>',
    locked: '<rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3m-4 5v2"/>',
    missing: '<path d="m12 3 9 9-9 9-9-9Z"/><path d="M8 12h8"/>',
  };
  const statusIcon = `
    <svg class="craftability-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor"
      stroke-width="2" stroke-linecap="round" stroke-linejoin="round" focusable="false"
      ${ready.status === "ready" ? 'role="img" aria-label="Ready to craft"' : 'aria-hidden="true"'}>
      ${paths[ready.status]}
    </svg>`;
  if (ready.reason) return `
    <details class="craftability">
      <summary class="craftability-label" aria-label="${escape(`${label}: ${ready.reason}`)}" title="${escape(`${label}: ${ready.reason}`)}">${statusIcon}</summary>
      <small class="craftability-detail">${escape(ready.reason)}</small>
    </details>`;
  return `<span class="craftability craftability-label" ${ready.status === "ready" ? "" : `role="img" aria-label="${label}"`} title="${label}">${statusIcon}</span>`;
}

function conflictWarning(name, conflict) {
  if (!conflict) return "";
  const materials = conflict.materials.map((material) => `${material.name}: ${material.before} → ${material.after} missing`).join("; ");
  const text = escape(`Shared materials warning: crafting ${name} increases shortfalls for ${conflict.items.join(", ")}. ${materials}.`);
  return `
    <details class="craft-conflict">
      <summary aria-label="${text}" title="${text}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"
          stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">
          <path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3v.1"/>
        </svg>
      </summary>
      <small class="craftability-detail">${text}</small>
    </details>`;
}

function ingredientChip(name, required, inventory) {
  const owned = planner.count(inventory[name]);
  return `
    <span class="wishlist-ingredient ${owned >= required ? "ingredient-covered" : "ingredient-short"}"
      data-material="${escape(name)}" data-owned="${owned}" data-required="${required}"
      role="img" aria-label="${escape(`${name}: ${owned} owned / ${required} required`)}">
      ${icon("material", name)}
      <span aria-hidden="true">${escape(name)} <strong class="wishlist-ratio"><span class="stock-count">${owned}</span><span class="ratio-divider">/</span><span class="need-count">${required}</span></strong></span>
    </span>`;
}

function wishlistMarkup(state, plan) {
  const goals = Object.entries(state.goals).filter(([, quantity]) => quantity);
  if (!goals.length) return `
    <div class="empty">
      <h3>No recipes yet</h3><p>Choose recipes or import a game photo.</p>
      <button class="primary" data-go="recipes">Choose recipes</button>
      <button class="quiet" data-go="import">Import a photo</button>
    </div>`;
  const availability = wishlistAvailability(state);
  const conflicts = planner.wishlistConflicts(state);
  const ingredients = wishlistIngredients(plan);
  return `<h3>Wishlist</h3>${goals.map(([name]) => {
    const recipe = data.byRecipe[name];
    const ready = availability.get(name);
    const costs = ingredients.get(name);
    const chips = Object.entries(costs || planner.costs(recipe, state, name === "Ultima Weapon"))
      .filter(([, required]) => required).map(([material, required]) => ingredientChip(material, required, state.inventory)).join("");
    const base = recipe.base ? `
      <label class="check goal-base" title="${escape(recipe.base)} already made">
        <input type="checkbox" data-crafted="${escape(recipe.base)}" aria-label="${escape(recipe.base)} already made" ${state.crafted[recipe.base] ? "checked" : ""}>
        <span>Base<span class="goal-base-extra"> made</span></span>
      </label>` : "";
    return `
      <div class="goal craftability-${ready.status}" data-goal="${escape(name)}" data-craftable="${ready.available}">
        <div class="goal-main">
          <div class="goal-name" title="${escape(name)} · Rank ${recipe.rank} · ${escape(recipe.category)}">
            <span class="icon-label">${icon("item", name)}<span class="goal-title">${escape(name)}</span></span>
            <small>Rank ${recipe.rank} · ${escape(recipe.category)}</small>
          </div>
          ${base}
          ${conflictWarning(name, ready.status === "ready" ? conflicts.get(name) : null)}
          ${readinessIndicator(ready)}
          <button class="quiet goal-remove" data-remove="${escape(name)}" aria-label="Remove ${escape(name)}" title="Remove ${escape(name)}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
              stroke-linecap="round" aria-hidden="true" focusable="false"><path d="m7 7 10 10M17 7 7 17"/></svg>
          </button>
        </div>
        <div class="goal-ingredients wishlist-ingredients" role="group"
          aria-label="${escape(`${name} ingredients${costs ? ", including prerequisites" : " — locked recipe preview, before prerequisites or Energy"}`)}">
          ${costs ? "" : '<span class="ingredient-preview">Locked preview</span>'}${chips}
        </div>
      </div>`;
  }).join("")}`;
}

function supplyNote(row, state) {
  let note = row.crafted ? `Synthesize ${row.crafted}` : row.missing ? "Collect" : "Covered by stock";
  if (row.locked) note = `Synthesis locked: ${data.byRecipe[row.name].unlock}`;
  if (row.name.startsWith("Mythril") && row.missing) {
    const allChests = data.worlds.filter((world) => world.id !== "at").every((world) => state.chests[world.id]);
    note += allChests
      ? " · All chests marked collected; synthesis is the remaining source."
      : " · No enemy drops. Chests may supply some; only entered stock is budgeted.";
  }
  if (row.name === "Orichalcum+" && row.missing) note += " · Seven total in the game; chest completion is tracked under World progress.";
  return note;
}

function materialMethod(row, state) {
  const recipe = data.byRecipe[row.name];
  if (!recipe || !row.missing || !state.expand) return "";
  const crafting = state.methods[row.name] ? state.methods[row.name] === "craft" : row.name.startsWith("Mythril");
  return `
    <label class="check"><input type="checkbox" data-method="${escape(row.name)}" ${crafting ? "checked" : ""}> Plan synthesis for this material</label>
    ${recipe.base ? `
      <label class="check"><input type="checkbox" data-crafted="${escape(recipe.base)}" ${state.crafted[recipe.base] ? "checked" : ""}> ${escape(recipe.base)} already made</label>
    ` : ""}`;
}

function requirementsMarkup(state, plan, showOwned) {
  const requirements = plan.requirements.filter((row) => showOwned || row.missing);
  if (!requirements.length) return `<div class="empty">${plan.goals
    ? plan.warnings.length ? "Resolve the locked recipes above to calculate their ingredients." : "The entered stock covers the plan."
    : "Missing materials will appear here."}</div>`;
  return `
    <div class="table-wrap"><table>
      <thead><tr><th>Material</th><th>Total need</th><th>Stock used</th><th>Shortfall</th><th>How to supply</th></tr></thead>
      <tbody>${requirements.map((row) => `
        <tr>
          <td><span class="icon-label">${icon("material", row.name)}${link(data.materials[row.name].url, row.name)}</span>
            ${row.bonus ? `<small>Includes ${row.bonus} from a base-recipe prerequisite</small>` : ""}</td>
          <td class="numeric">${row.required}</td>
          <td class="numeric">${row.owned}</td>
          <td class="numeric ${row.missing ? "warning" : "positive"}">${row.missing || "—"}</td>
          <td>${escape(supplyNote(row, state))}${materialMethod(row, state)}</td>
        </tr>`).join("")}</tbody>
    </table></div>`;
}

function routeMarkup(route) {
  const materials = route.materials.map((material) => `
    <span class="drop-material icon-label">${icon("material", material.name)}
      <span>${escape(material.name)} ×${material.missing}
        <small>(${material.effectiveRate !== null ? `${material.effectiveRate}% effective · ${material.rate}% base` : "drop rate unknown"})</small>
      </span>
    </span>`).join(" · ");
  const notes = [...new Set(route.materials.map((material) => material.note).filter(Boolean))];
  return `
    <div class="route-item">
      <strong>${link(route.url, route.enemy)}</strong> <span class="muted">· ${escape(route.room)}</span>
      <p>${materials}</p>
      ${notes.map((note) => `<p class="muted">${escape(note)}</p>`).join("")}
      ${route.available ? "" : `<p class="warning">Unlock: ${escape(route.reason)}</p>`}
    </div>`;
}

function routesMarkup(plan) {
  return groupRoutes(plan.routes).map((routes) => {
    const world = data.worlds.find((world) => world.id === routes[0].world);
    return `
      <div class="panel route-world ${routes[0].available ? "" : "locked"}">
        <h3>${escape(world.name)} <span class="tag">${routes[0].available ? "AVAILABLE" : "LOCKED"}</span></h3>
        ${routes.map(routeMarkup).join("")}
      </div>`;
  }).join("") || `<div class="empty">${plan.goals
    ? "No enemy farming sources needed yet. Mythril is chest / synthesis only; resolve any locked recipes above."
    : "Farming locations will follow the wish list and world progress."}</div>`;
}

function mooglePerks(state) {
  const discounts = [["C", 5], ["B", 6], ["A", 7], ["S", 9]].filter(([, level]) => state.moogle >= level).map(([rank]) => rank);
  return [
    state.moogle >= 2 ? "Energy enabled" : "Energy unlocks at level 2",
    state.moogle >= 3 ? "Serenity upgrades enabled" : "Upgrades unlock at level 3",
    state.moogle >= 4 ? "Energy + Serenity enabled" : "Energy + Serenity unlocks at level 4",
    discounts.length ? `Half-cost ranks: ${discounts.join(", ")} (Energy stacks; round up per craft)` : "No automatic rank discounts yet",
  ].join(" · ");
}

export function mountPlan(root, store) {
  const $ = (id) => root.querySelector(`#${id}`);
  $("moogle").innerHTML = data.levels.map((name, index) => `<option value="${index + 1}">${index + 1} · ${name} Moogle</option>`).join("");
  function render(state) {
    const plan = planner.plan(state);
    $("moogle").value = state.moogle;
    $("energy").value = state.energy;
    $("expand").value = String(state.expand);
    $("lucky-lucky").value = state.luckyLuckyCount;
    $("moogle-perks").textContent = mooglePerks(state);
    $("summary").innerHTML = `
      <div class="stat"><strong>${plan.goals}</strong><span>items on the wishlist</span></div>
      <div class="stat"><strong>${plan.needed.reduce((total, row) => total + row.missing, 0)}</strong><span>materials to collect</span></div>
      <div class="stat"><strong>${plan.routes.filter((route) => route.available).length}</strong><span>available sources</span></div>`;
    $("goals").innerHTML = wishlistMarkup(state, plan);
    $("blockers").innerHTML = plan.warnings.map((warning) => `<div class="alert">${escape(warning)}</div>`).join("");
    $("requirements").innerHTML = requirementsMarkup(state, plan, $("show-owned").checked);
    $("routes").innerHTML = routesMarkup(plan);
  }
  on(root, "click", "[data-remove]", (button) => store.dispatch({ type: "remove-goal", name: button.dataset.remove }));
  on(root, "change", "[data-crafted]", (input) => store.dispatch({ type: "set-crafted", name: input.dataset.crafted, value: input.checked }));
  on(root, "change", "[data-method]", (input) => store.dispatch({ type: "set-method", name: input.dataset.method, value: input.checked }));
  for (const id of ["moogle", "energy", "expand", "lucky-lucky"]) {
    $(id).addEventListener("change", (event) => store.dispatch({
      type: `set-${id}`, value: id === "expand" ? event.target.value === "true" : event.target.value,
    }));
  }
  $("show-owned").addEventListener("change", () => render(store.getState()));
  store.subscribe(render);
  render(store.getState());
}

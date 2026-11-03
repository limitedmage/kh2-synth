import data from "../data.js";
import planner from "../planner.js";
import { escape, icon, on } from "../dom.js";

function reviewRow(row, index, recipes) {
  const names = recipes ? data.recipes.map((recipe) => recipe.name) : data.materialNames;
  const note = row.conflict
    ? `Conflicting counts: ${row.alternatives.join(", ")}. Choose the correct count.`
    : row.quantity === null ? "Count unreadable; enter it manually." : `${row.readings} reading(s) · confidence ${row.confidence}%`;
  return `
    <div class="review-row${!recipes && row.image ? " has-source" : ""}">
      <input type="checkbox" data-review-check="${index}" aria-label="Import ${escape(row.name)}" ${row.checked ? "checked" : ""}>
      <div class="review-name">
        <span class="review-icon" aria-hidden="true">${icon(recipes ? "item" : "material", row.name)}</span>
        <select data-review-name="${index}" aria-label="Recognized name ${index + 1}">
          ${names.map((name) => `<option ${name === row.name ? "selected" : ""}>${escape(name)}</option>`).join("")}
        </select>
      </div>
      ${recipes ? "" : `
        <input type="number" min="0" max="9999" step="1" value="${row.quantity === null ? "" : row.quantity}"
          data-review-qty="${index}" aria-label="${escape(row.name)} imported quantity" placeholder="?">`}
      <small>${escape(note)}</small>
      ${!recipes && row.image ? `
        <figure class="review-source">
          <img src="${escape(row.image)}" alt="Original game row for ${escape(row.name)}" title="${escape(row.source)}" loading="lazy">
        </figure>` : ""}
    </div>`;
}

export function createReview(root, { store, notice }) {
  const $ = (id) => root.querySelector(`#${id}`);
  let rows = [];
  let recipeRows = [];
  let kind = "recipes";

  function render(unmatched = 0) {
    const recipes = kind === "recipes";
    root.hidden = false;
    $("review-rows").classList.toggle("recipe-review", recipes);
    $("review-instructions").textContent = recipes
      ? "Select the recipes to add."
      : "Check counts against the images. Conflicts stay unchecked; unreadable counts are blank. Repeated rows are not added together.";
    $("review-rows").innerHTML = rows.map((row, index) => reviewRow(row, index, recipes)).join("");
    $("review-message").textContent = `${rows.length} ${recipes ? "combined recipe names from Recipes / Free Development" : "recognized materials"}. ${unmatched ? `${unmatched} unrecognized text line(s); inspect the raw text and add anything missing manually.` : ""}${!rows.length ? " Adjust the crop or use pasted text / manual entry." : ""}`;
    $("apply-import").disabled = !rows.length;
    $("check-all-import").disabled = !rows.length;
  }

  on(root, "change", "[data-review-check]", (input) => { rows[Number(input.dataset.reviewCheck)].checked = input.checked; });
  on(root, "change", "[data-review-name]", (input) => {
    rows[Number(input.dataset.reviewName)].name = input.value;
    const row = input.closest(".review-row");
    row.querySelector(".review-icon").innerHTML = icon(kind === "recipes" ? "item" : "material", input.value);
    row.querySelector("[data-review-check]").setAttribute("aria-label", `Import ${input.value}`);
    row.querySelector("[data-review-qty]")?.setAttribute("aria-label", `${input.value} imported quantity`);
  });
  on(root, "change", "[data-review-qty]", (input) => {
    rows[Number(input.dataset.reviewQty)].quantity = input.value === "" ? null : planner.count(input.value, kind === "recipes" ? 99 : 9999);
  });
  $("check-all-import").addEventListener("click", () => {
    for (const row of rows) row.checked = true;
    for (const checkbox of root.querySelectorAll("[data-review-check]")) checkbox.checked = true;
  });
  $("apply-import").addEventListener("click", () => {
    const checked = rows.filter((row) => row.checked);
    if (!checked.length) { notice("Check at least one row before applying."); return; }
    if (kind === "inventory" && checked.some((row) => row.quantity === null)) {
      notice("Enter a valid quantity for every checked row.");
      return;
    }
    if (new Set(checked.map((row) => row.name)).size !== checked.length) {
      notice("Duplicate names in review. Uncheck or rename duplicate rows before applying.");
      return;
    }
    store.dispatch({ type: "apply-import", kind, rows: checked });
    if (kind === "recipes") recipeRows = [];
    notice(kind === "recipes" ? `${checked.length} recipes added. Inventory unchanged.` : `Inventory replaced (${checked.length} materials).`);
  });

  return {
    hide() { root.hidden = true; },
    setKind(nextKind) {
      kind = nextKind;
      rows = kind === "recipes" ? recipeRows : [];
      if (rows.length) render();
      else root.hidden = true;
    },
    accept(nextKind, incoming, unmatched = 0) {
      kind = nextKind;
      if (kind === "recipes") {
        const combined = new Map(recipeRows.map((row) => [row.name, row]));
        for (const row of incoming) if (!combined.has(row.name)) combined.set(row.name, row);
        recipeRows = [...combined.values()];
        rows = recipeRows;
      } else rows = incoming;
      render(unmatched);
    },
  };
}

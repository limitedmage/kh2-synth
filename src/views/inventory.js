import data from "../data.js";
import { escape, icon, on } from "../dom.js";

export function mountInventory(root, store) {
  const search = root.querySelector("#material-search");
  const stockOnly = root.querySelector("#stock-only");
  const list = root.querySelector("#inventory-list");
  function render(state, action) {
    if (action?.type === "set-stock") {
      const input = list.querySelector(`[data-stock="${CSS.escape(action.name)}"]`);
      if (input) {
        input.value = state.inventory[action.name];
        input.closest(".stock-row").classList.toggle("has-stock", input.value !== "0");
      }
      return;
    }
    const names = data.materialNames.filter((name) =>
      name.toLowerCase().includes(search.value.toLowerCase()) && (!stockOnly.checked || state.inventory[name]));
    list.innerHTML = names.map((name) => `
      <div class="stock-row ${state.inventory[name] ? "has-stock" : ""}">
        <label><span class="icon-label">${icon("material", name)}${escape(name)}</span>
          <input type="number" min="0" max="9999" step="1" value="${state.inventory[name] || 0}"
            data-stock="${escape(name)}" aria-label="${escape(name)} current stock">
        </label>
      </div>`).join("") || "<p class='muted'>No matching materials.</p>";
  }
  on(root, "change", "[data-stock]", (input) => store.dispatch({
    type: "set-stock", name: input.dataset.stock, value: input.value,
  }));
  search.addEventListener("input", () => render(store.getState()));
  stockOnly.addEventListener("change", () => render(store.getState()));
  store.subscribe(render);
  render(store.getState());
}

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
        <label for="stock-${encodeURIComponent(name)}"><span class="icon-label">${icon("material", name)}${escape(name)}</span></label>
        <div class="stock-controls">
          <button type="button" class="quiet stock-adjust" data-stock-step="-1" aria-label="${escape(`Decrease ${name} stock`)}">-</button>
          <input id="stock-${encodeURIComponent(name)}" type="number" min="0" max="9999" step="1" value="${state.inventory[name] || 0}"
            data-stock="${escape(name)}" aria-label="${escape(name)} current stock">
          <button type="button" class="quiet stock-adjust" data-stock-step="1" aria-label="${escape(`Increase ${name} stock`)}">+</button>
        </div>
      </div>`).join("") || "<p class='muted'>No matching materials.</p>";
  }
  on(root, "click", "[data-stock-step]", (button) => {
    const input = button.closest(".stock-controls").querySelector("[data-stock]");
    store.dispatch({
      type: "set-stock", name: input.dataset.stock, value: Number(input.value) + Number(button.dataset.stockStep),
    });
  });
  on(root, "change", "[data-stock]", (input) => store.dispatch({
    type: "set-stock", name: input.dataset.stock, value: input.value,
  }));
  search.addEventListener("input", () => render(store.getState()));
  stockOnly.addEventListener("change", () => render(store.getState()));
  store.subscribe(render);
  render(store.getState());
}

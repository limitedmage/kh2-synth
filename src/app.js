import data from "./data.js";
import planner from "./planner.js";
import recognition from "./recognition.js";
import icons from "./icons.js";
import { byId, on } from "./dom.js";
import { createStore } from "./store.js";
import { mountPlan } from "./views/plan.js";
import { mountRecipes } from "./views/recipes.js";
import { mountInventory } from "./views/inventory.js";
import { mountProgress } from "./views/progress.js";
import { mountImport } from "./import/index.js";

// Keep the guide helpers available for console diagnostics and standalone browser checks.
Object.assign(globalThis, { KH2Data: data, KH2Planner: planner, KH2Recognition: recognition, KH2Icons: icons });

const store = createStore();
let noticeTimer;
function notice(message) {
  byId("notice").textContent = message;
  byId("notice").hidden = false;
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => { byId("notice").hidden = true; }, 8000);
}

function mountNavigation() {
  const fragments = { plan: "plan", recipes: "recipes", inventory: "materials", progress: "world-progress", import: "import" };
  function navigate(name, updateURL = true) {
    if (!Object.hasOwn(fragments, name)) name = "plan";
    for (const section of document.querySelectorAll("main > section")) section.hidden = section.id !== `tab-${name}`;
    for (const button of document.querySelectorAll("[data-tab]")) {
      const active = button.dataset.tab === name;
      button.classList.toggle("active", active);
      button.id = `nav-${button.dataset.tab}`;
      button.setAttribute("aria-controls", `tab-${button.dataset.tab}`);
      byId(`tab-${button.dataset.tab}`).setAttribute("aria-labelledby", button.id);
      if (active) button.setAttribute("aria-current", "page");
      else button.removeAttribute("aria-current");
    }
    if (updateURL && location.hash !== `#${fragments[name]}`) location.hash = `#${fragments[name]}`;
  }
  function restore() {
    const fragment = location.hash.slice(1).toLowerCase();
    const name = Object.keys(fragments).find((key) => fragments[key] === fragment) || (Object.hasOwn(fragments, fragment) ? fragment : "plan");
    navigate(name, false);
    if (location.hash !== `#${fragments[name]}`) history.replaceState(null, "", `#${fragments[name]}`);
  }
  on(document, "click", "[data-tab], [data-go]", (button) => navigate(button.dataset.tab || button.dataset.go));
  window.addEventListener("hashchange", restore);
  restore();
}

function renderSaveStatus(state) {
  const failed = !!store.getStorageError();
  byId("save-status").textContent = failed ? "Not saved — use Export save" : "Saved on this device";
  byId("save-status").classList.toggle("storage-error", failed);
  const count = Object.values(state.goals).reduce((total, quantity) => total + quantity, 0);
  byId("plan-count").textContent = count ? `(${count})` : "";
}

byId("export").addEventListener("click", () => {
  const url = URL.createObjectURL(new Blob([JSON.stringify(store.getState(), null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = "kh2-synthesis-save.json"; anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
});
byId("load-save").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  if (!file) return;
  try {
    if (file.size > 1000000) throw new Error("Save file is too large (maximum 1 MB).");
    const state = planner.sanitize(JSON.parse(await file.text()));
    if (!confirm("Replace this journal's current wish list, inventory and progress with the selected save? Each wishlist recipe will be included once.")) return;
    store.dispatch({ type: "replace-save", value: state });
    notice("Save loaded.");
  } catch (error) {
    notice(`Could not load save: ${error.message}`);
  } finally {
    event.target.value = "";
  }
});

mountNavigation();
mountPlan(byId("tab-plan"), store);
mountRecipes(byId("tab-recipes"), { store, notice });
mountInventory(byId("tab-inventory"), store);
mountProgress(byId("tab-progress"), { store, notice });
mountImport(byId("tab-import"), { store, notice });
store.subscribe(renderSaveStatus);
renderSaveStatus(store.getState());
if (store.getStorageError()) notice(store.getStorageError());

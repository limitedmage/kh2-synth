import data from "./data.js";
import planner from "./planner.js";
import recognition from "./recognition.js";
import icons from "./icons.js";
import { byId, on } from "./dom.js";
import { createStore } from "./store.js";
import { mountSaveTools } from "./save.js";
import { imageCreditsMarkup } from "./enemy-images.js";
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

mountSaveTools(store, notice);
byId("image-credits").innerHTML = imageCreditsMarkup();
mountNavigation();
mountPlan(byId("tab-plan"), store);
mountRecipes(byId("tab-recipes"), { store, notice });
mountInventory(byId("tab-inventory"), store);
mountProgress(byId("tab-progress"), { store, notice });
mountImport(byId("tab-import"), { store, notice });
store.subscribe(renderSaveStatus);
renderSaveStatus(store.getState());
if (store.getStorageError()) notice(store.getStorageError());

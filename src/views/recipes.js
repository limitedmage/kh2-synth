import data from "../data.js";
import planner from "../planner.js";
import { escape, icon, ingredientText, link, on } from "../dom.js";

function recipeCard(recipe, state) {
  const unlocked = planner.unlocked(recipe, state);
  const added = state.goals[recipe.name];
  const status = unlocked ? "Unlocked" : `Needs ${recipe.minLevel > state.moogle ? `Moogle Lv ${recipe.minLevel}` : `${recipe.types} material types`}`;
  return `
    <article class="card">
      <h3><span class="rank">${recipe.rank}</span><span class="icon-label">${icon("item", recipe.name)}${escape(recipe.name)}</span></h3>
      <p>${escape(recipe.category)} · ${link(recipe.url, "Source")}</p>
      <div class="ingredients">${ingredientText(recipe.ingredients)}${recipe.modifier ? ` · ${ingredientText({ [recipe.modifier]: 1 })}` : ""}</div>
      <p>${escape(recipe.unlock)}${recipe.base ? ` · First make ${escape(recipe.base)}` : ""}</p>
      <div class="card-actions">
        <span class="${unlocked ? "positive" : "warning"}">${status}</span>
        <button data-add="${escape(recipe.name)}" class="${added ? "quiet" : "primary"}">${added ? "Added" : "Add"}</button>
      </div>
    </article>`;
}

export function mountRecipes(root, { store, notice }) {
  const search = root.querySelector("#recipe-search");
  const category = root.querySelector("#recipe-category");
  const list = root.querySelector("#recipe-list");
  function render(state) {
    const recipes = data.recipes.filter((recipe) =>
      (!category.value || category.value === recipe.category) && recipe.name.toLowerCase().includes(search.value.toLowerCase()));
    list.innerHTML = recipes.map((recipe) => recipeCard(recipe, state)).join("") || "<p class='muted'>No matching recipes.</p>";
  }
  on(root, "click", "[data-add]", (button) => {
    const name = button.dataset.add;
    store.dispatch({ type: "add-goal", name });
    notice(`${name} added to the wishlist.`);
  });
  search.addEventListener("input", () => render(store.getState()));
  category.addEventListener("change", () => render(store.getState()));
  store.subscribe(render);
  render(store.getState());
}

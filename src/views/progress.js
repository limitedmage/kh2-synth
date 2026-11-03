import data from "../data.js";
import { escape, on } from "../dom.js";

export function mountProgress(root, { store, notice }) {
  const $ = (id) => root.querySelector(`#${id}`);
  const chestWorlds = data.worlds.filter((world) => world.id !== "at");
  $("optional-unlocks").innerHTML = data.optional.map(([id, name]) => `
    <label class="check"><input type="checkbox" data-optional="${id}">${escape(name)}</label>
  `).join("");
  $("world-list").innerHTML = data.worlds.map((world) => `
    <article class="card world-card">
      <h3>${escape(world.name)}</h3>
      <label>World progress
        <select data-world="${world.id}" aria-label="${escape(world.name)} progress">
          ${world.stages.map((stage, index) => `<option value="${index}">${escape(stage)}</option>`).join("")}
        </select>
      </label>
      ${world.id !== "at"
        ? `<label class="check"><input type="checkbox" data-chests="${world.id}"> All chests collected</label>`
        : "<p>Musical rewards; no treasure chests.</p>"}
    </article>`).join("");
  $("orichalcum-rewards").innerHTML = data.rewards.slice(3).map((reward) => `
    <label class="check"><input type="checkbox" data-reward="${reward.id}">${escape(reward.label)}</label>
  `).join("");
  function render(state) {
    $("all-chests").checked = chestWorlds.every((world) => state.chests[world.id]);
    $("all-chests").indeterminate = !$("all-chests").checked && chestWorlds.some((world) => state.chests[world.id]);
    $("material-types").value = state.materialTypes;
    for (const [attribute, field] of [["world", "worlds"], ["chests", "chests"], ["optional", "optional"], ["reward", "rewards"]]) {
      for (const input of root.querySelectorAll(`[data-${attribute}]`)) {
        if (attribute === "world") input.value = state.worlds[input.dataset.world] || 0;
        else input.checked = !!state[field][input.dataset[attribute]];
      }
    }
  }
  for (const attribute of ["world", "chests", "optional", "reward"]) {
    on(root, "change", `[data-${attribute}]`, (input) => store.dispatch({
      type: `set-${attribute}`, name: input.dataset[attribute], value: attribute === "world" ? input.value : input.checked,
    }));
  }
  $("all-chests").addEventListener("change", (event) => store.dispatch({ type: "set-all-chests", value: event.target.checked }));
  $("material-types").addEventListener("change", (event) => store.dispatch({ type: "set-material-types", value: event.target.value }));
  $("endgame-worlds").addEventListener("click", () => {
    store.dispatch({ type: "endgame" });
    notice("All worlds and optional areas unlocked. Chests and inventory unchanged.");
  });
  store.subscribe(render);
  render(store.getState());
}

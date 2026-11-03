import data from "./data.js";
import planner from "./planner.js";

const storageKey = "kh2-final-mix-synthesis-v1";
const chestWorlds = data.worlds.filter((world) => world.id !== "at");
const discoveredTypes = (inventory) => Object.values(inventory).filter((quantity) => quantity > 0).length;

export function reduceJournal(state, action) {
  const { name, value } = action;
  switch (action.type) {
    case "add-goal":
      return { ...state, goals: { ...state.goals, [name]: 1 } };
    case "remove-goal": {
      const goals = { ...state.goals };
      delete goals[name];
      return { ...state, goals };
    }
    case "set-stock": {
      const inventory = { ...state.inventory, [name]: planner.count(value) };
      return { ...state, inventory, materialTypes: Math.max(state.materialTypes, discoveredTypes(inventory)) };
    }
    case "set-crafted":
      return { ...state, crafted: { ...state.crafted, [name]: value } };
    case "set-method":
      return { ...state, methods: { ...state.methods, [name]: value ? "craft" : "collect" } };
    case "set-world": {
      const world = data.worlds.find((world) => world.id === name);
      return { ...state, worlds: { ...state.worlds, [name]: planner.count(value, world.stages.length - 1) } };
    }
    case "set-chests":
      return { ...state, chests: { ...state.chests, [name]: value } };
    case "set-all-chests":
      return { ...state, chests: { ...state.chests, ...Object.fromEntries(chestWorlds.map((world) => [world.id, value])) } };
    case "set-optional":
      return { ...state, optional: { ...state.optional, [name]: value } };
    case "set-reward":
      return { ...state, rewards: { ...state.rewards, [name]: value } };
    case "set-moogle":
      return { ...state, moogle: Math.max(1, planner.count(value, 9)) };
    case "set-energy":
      return { ...state, energy: value };
    case "set-expand":
      return { ...state, expand: value };
    case "set-lucky-lucky":
      return { ...state, luckyLuckyCount: planner.count(value, Number.MAX_SAFE_INTEGER) };
    case "set-material-types":
      return { ...state, materialTypes: Math.max(planner.count(value, 60), discoveredTypes(state.inventory)) };
    case "endgame":
      return {
        ...state,
        worlds: Object.fromEntries(data.worlds.map((world) => [world.id, world.stages.length - 1])),
        optional: Object.fromEntries(data.optional.map(([id]) => [id, true])),
      };
    case "apply-import":
      if (action.kind === "recipes") {
        return { ...state, goals: { ...state.goals, ...Object.fromEntries(action.rows.map((row) => [row.name, 1])) } };
      } else {
        const inventory = Object.fromEntries(action.rows.map((row) => [row.name, planner.count(row.quantity)]));
        return { ...state, inventory, materialTypes: Math.max(state.materialTypes, discoveredTypes(inventory)) };
      }
    case "replace-save":
      return planner.sanitize(value);
    default:
      throw new Error(`Unknown journal action: ${action.type}`);
  }
}

export function createStore(storage) {
  let state = planner.defaults();
  let storageError = "";
  const listeners = new Set();
  try {
    storage ||= globalThis.localStorage;
    const saved = storage.getItem(storageKey);
    if (saved) {
      const raw = JSON.parse(saved);
      state = planner.sanitize(raw);
      if (JSON.stringify(raw.goals) !== JSON.stringify(state.goals)) storage.setItem(storageKey, JSON.stringify(state));
    }
  } catch {
    storageError = "Browser storage is unavailable or the saved data could not be read. Export a save to keep changes.";
  }
  return {
    getState: () => state,
    getStorageError: () => storageError,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    dispatch(action) {
      state = reduceJournal(state, action);
      try {
        storage.setItem(storageKey, JSON.stringify(state));
        storageError = "";
      } catch {
        storageError = "Not saved — use Export save";
      }
      for (const listener of listeners) listener(state, action);
    },
  };
}

import data from "./data.js";
import planner from "./planner.js";

export function wishlistAvailability(state) {
  const allocated = {};
  return new Map(Object.entries(state.goals).filter(([, quantity]) => quantity).map(([name]) => {
    const plan = planner.plan({ ...state, goals: { ...allocated, [name]: 1 } });
    const available = !plan.warnings.length && !plan.needed.length ? 1 : 0;
    if (available) allocated[name] = 1;
    const locks = [
      ...plan.warnings,
      ...plan.requirements.filter((row) => row.locked).map((row) => `${row.name}: ${data.byRecipe[row.name].unlock}.`),
    ];
    return [name, { available, status: available ? "ready" : locks.length ? "locked" : "missing", reason: locks.join(" ") }];
  }));
}

export function wishlistIngredients(plan) {
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

export function groupRoutes(routes) {
  const groups = new Map();
  for (const route of routes.toSorted((a, b) => Number(b.available) - Number(a.available))) {
    const key = `${route.world}|${route.available}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(route);
  }
  return [...groups.values()];
}

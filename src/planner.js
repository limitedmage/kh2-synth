globalThis.KH2Planner = (() => {
  const D = globalThis.KH2Data;
  const count = (value, max = 9999) => Math.min(max, Math.max(0, Math.floor(Number(value) || 0)));
  const defaults = () => ({
    version: 1, goals: {}, inventory: {}, crafted: {}, worlds: {}, chests: {}, optional: {}, rewards: {},
    moogle: 1, energy: "owned", expand: true, materialTypes: 0, methods: {},
  });
  function sanitize(raw) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || raw.version !== 1) throw new Error("Not a supported Synthesis Journal save (version 1).");
    const state = defaults();
    for (const [field, names] of [["goals", D.recipes.map((r) => r.name)], ["inventory", D.materialNames]]) {
      const keys = field === "goals" ? Object.keys(raw[field] || {}).filter((name) => names.includes(name)) : names;
      for (const name of keys) if (raw[field]?.[name] !== undefined) state[field][name] = count(raw[field][name], field === "goals" ? (name === "Ultima Weapon" ? 1 : 99) : 9999);
    }
    for (const [field, names] of [["crafted", D.recipes.map((r) => r.name)], ["chests", D.worlds.map((w) => w.id)], ["optional", D.optional.map(([id]) => id)], ["rewards", D.rewards.map((r) => r.id)]]) {
      for (const name of names) state[field][name] = raw[field]?.[name] === true;
    }
    for (const world of D.worlds) state.worlds[world.id] = count(raw.worlds?.[world.id], world.stages.length - 1);
    for (const name of D.materialNames) if (["collect", "craft"].includes(raw.methods?.[name])) state.methods[name] = raw.methods[name];
    state.moogle = Math.max(1, count(raw.moogle, 9));
    state.materialTypes = Math.max(count(raw.materialTypes, 60), Object.values(state.inventory).filter((n) => n > 0).length);
    state.energy = ["owned", "none", "farm"].includes(raw.energy) ? raw.energy : "owned";
    state.expand = raw.expand !== false;
    return state;
  }
  const threshold = { C: 5, B: 6, A: 7, S: 9 };
  const energyName = (recipe) => `Energy ${D.tiers["CBAS".indexOf(recipe.rank)]}`;
  const unlocked = (recipe, state) => state.moogle >= recipe.minLevel && state.materialTypes >= recipe.types;
  function costs(recipe, state, energy = false) {
    const levelDiscount = state.moogle >= threshold[recipe.rank] ? 2 : 1;
    const divisor = levelDiscount * (energy ? 2 : 1);
    const result = Object.fromEntries(Object.entries(recipe.ingredients).map(([name, qty]) => [
      name, recipe.name === "Ultima Weapon" && name === "Orichalcum+" ? Math.ceil(qty / Math.min(divisor, 2)) : Math.ceil(qty / divisor),
    ]));
    if (recipe.modifier) result[recipe.modifier] = (result[recipe.modifier] || 0) + 1;
    if (energy) result[energyName(recipe)] = (result[energyName(recipe)] || 0) + 1;
    return result;
  }
  function availability(route, state) {
    const world = D.worlds.find((w) => w.id === route.world);
    const conditions = [];
    if ((state.worlds[route.world] || 0) < route.stage) conditions.push(`${world.name}: ${world.stages[route.stage]}`);
    if (route.world === "co" && (state.worlds.hb || 0) < 2) conditions.push("Complete Hollow Bastion's 1000 Heartless battle");
    if (route.unlock && !state.optional[route.unlock]) conditions.push(D.optional.find(([id]) => id === route.unlock)?.[1] || route.unlock);
    return { available: !conditions.length, reason: conditions.join("; ") };
  }
  function plan(state) {
    const demand = {};
    const energyStock = Object.fromEntries(D.tiers.map((tier) => [`Energy ${tier}`, count(state.inventory[`Energy ${tier}`])]));
    const steps = [];
    const warnings = [];
    const made = new Set(Object.keys(state.crafted).filter((name) => state.crafted[name]));
    const requested = Object.fromEntries(Object.entries(state.goals).filter(([name, n]) => D.byRecipe[name] && count(n, 99)));
    const scheduled = new Set();
    const bonusStock = {};
    function addDemand(name, amount) { demand[name] = (demand[name] || 0) + amount; }
    function craft(recipe, quantity, purpose, path = new Set()) {
      if (!quantity || path.has(recipe.name)) return false;
      if (!unlocked(recipe, state)) {
        warnings.push(`${recipe.name}: requires ${recipe.minLevel > state.moogle ? `Moogle level ${recipe.minLevel}` : `${recipe.types} discovered material types`}.`);
        return false;
      }
      const next = new Set([...path, recipe.name]);
      if (recipe.base && !made.has(recipe.base)) {
        const base = D.byRecipe[recipe.base];
        if (requested[recipe.base] && !scheduled.has(recipe.base)) {
          scheduled.add(recipe.base);
          if (!craft(base, count(requested[recipe.base], 99), "Goal", next)) return false;
        } else if (!scheduled.has(recipe.base)) {
          if (!craft(base, 1, "First-time upgrade prerequisite", next)) return false;
          if (D.materials[recipe.base]) bonusStock[recipe.base] = (bonusStock[recipe.base] || 0) + 1;
        }
      }
      let powered = 0;
      const energy = energyName(recipe);
      const specialAllowed = state.moogle >= (recipe.modifier ? 4 : 2);
      const plain = costs(recipe, state, false);
      const reduced = costs(recipe, state, true);
      const useful = Object.entries(recipe.ingredients).some(([name]) => reduced[name] < plain[name]);
      const mandatory = recipe.name === "Ultima Weapon";
      if (mandatory) powered = quantity;
      else if (specialAllowed && useful && state.energy !== "none") powered = state.energy === "farm" ? quantity : Math.min(quantity, energyStock[energy]);
      if (mandatory && state.moogle < 2) return false;
      energyStock[energy] = Math.max(0, energyStock[energy] - powered);
      for (const [name, qty] of Object.entries(plain)) addDemand(name, qty * (quantity - powered));
      for (const [name, qty] of Object.entries(reduced)) addDemand(name, qty * powered);
      made.add(recipe.name);
      steps.push({ name: recipe.name, quantity, powered, energy, purpose, ingredients: Object.fromEntries([...new Set([...Object.keys(plain), ...Object.keys(reduced)])].map((name) => [
        name, (plain[name] || 0) * (quantity - powered) + (reduced[name] || 0) * powered,
      ])) });
      return true;
    }
    for (const [name, qty] of Object.entries(requested)) {
      if (scheduled.has(name)) continue;
      scheduled.add(name);
      craft(D.byRecipe[name], count(qty, 99), "Goal");
      if (name === "Ultima Weapon" && qty > 1) warnings.push("Ultima Weapon can only be synthesized once per game. Set its quantity to 1.");
    }
    // Expand parents before children so shared sub-material demand is pooled before using stock.
    const expandable = ["Mythril Crystal", "Mythril Gem", "Mythril Stone", "Mythril Shard", "Manifest Illusion", "Serenity Crystal"];
    const rows = {};
    const calculate = (name) => {
      const required = demand[name] || 0;
      const owned = Math.min(required, count(state.inventory[name]) + (bonusStock[name] || 0));
      return { name, required, owned, missing: Math.max(0, required - owned), crafted: 0, locked: false, bonus: bonusStock[name] || 0 };
    };
    for (const name of expandable) {
      const row = calculate(name);
      const recipe = D.byRecipe[name];
      // Mythril has no enemy drops. Other craftable materials default to collecting instead.
      const useCrafting = state.methods[name] ? state.methods[name] === "craft" : name.startsWith("Mythril");
      if (row.missing && state.expand && useCrafting) {
        if (unlocked(recipe, state) && craft(recipe, row.missing, "Missing material")) row.crafted = row.missing;
        else row.locked = true;
      }
      rows[name] = row;
    }
    for (const name of D.materialNames) if (!rows[name]) rows[name] = calculate(name);
    const requirements = D.materialNames.map((name) => rows[name]).filter((row) => row.required > 0);
    // Final energy totals include all root and recursive crafts; stock is deducted only here.
    for (const row of requirements) if (row.name.startsWith("Energy ")) Object.assign(row, calculate(row.name));
    const needed = requirements.filter((row) => row.missing > 0 && !row.crafted);
    const routeMaterials = requirements.filter((row) => row.missing > 0);
    const routes = new Map();
    for (const row of routeMaterials) {
      if (!row.crafted) {
        for (const route of D.materials[row.name].sources) {
          const key = `${route.world}|${route.stage}|${route.enemy}|${route.room}|${route.unlock}`;
          if (!routes.has(key)) routes.set(key, { ...route, ...availability(route, state), materials: [] });
          routes.get(key).materials.push({ name: row.name, missing: row.missing, rate: route.rate, note: route.note });
        }
      }
    }
    return { requirements, needed, routes: [...routes.values()], steps, warnings: [...new Set(warnings)], goals: Object.values(requested).reduce((a, b) => a + b, 0) };
  }
  return { count, defaults, sanitize, costs, unlocked, availability, energyName, plan };
})();

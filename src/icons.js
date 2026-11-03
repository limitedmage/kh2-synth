const icons = (() => {
  const colors = {
    Blazing: "#ff9575", Frost: "#8ce2ff", Lightning: "#ffe27c",
    Lucid: "#b9d1ff", Power: "#f49ac1", Dark: "#ba9aea",
    Dense: "#a9b5ed", Twilight: "#e5a1dd", Mythril: "#8de1dd",
    Bright: "#c5e799", Energy: "#a3f19e", Serenity: "#ffcb91",
    Remembrance: "#91baff", Tranquility: "#e5d6ff",
    Orichalcum: "#ffe6aa", Illusion: "#d0b1ff",
  };
  const svg = (body, color = "#a9d8ff") =>
    `<svg class="kh-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="#edf6ff" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><g fill="${color}">${body}</g></svg>`;
  const facets = {
    Shard: '<path d="m18 3 6 9-4 14-9 3-4-10Z"/><path d="m18 3-4 15 6 8m-6-8 10-6M7 19l7-1-3 11" fill="none" stroke-opacity=".55"/>',
    Stone: '<path d="m10 5 13 3 5 12-9 8-13-5-2-10Z"/><path d="m10 5 1 11 8 12m-8-12 12-8m-12 8 17 4M4 13l7 3" fill="none" stroke-opacity=".55"/>',
    Gem: '<path d="m9 6 14 1 6 10-13 12L3 16Z"/><path d="m9 6 2 10 5 13 6-12 1-10M3 16l8 0 11 1 7 0" fill="none" stroke-opacity=".55"/>',
    Crystal: '<path d="m16 2 7 9-1 14-6 5-7-6-1-13Z"/><path d="m8 17-5-5 1 12 6 3m13-11 5-6 1 13-7 4"/><path d="m16 2-2 12 2 16 3-16-3-12M8 11l6 3 5 0 4-3" fill="none" stroke-opacity=".55"/>',
  };
  const material = (name) => {
    const text = typeof name === "string" ? name : "";
    const family = text.split(" ")[0].replace("+", "");
    if (/Illusion$/.test(text)) {
      return svg('<path d="m16 3 4 8 9 5-9 4-4 9-5-9-8-4 8-5Z"/><path d="m16 8 5 8-5 7-6-7Z" fill="#6273ad"/><path d="m16 8 0 15m-6-7h11" fill="none"/>', colors.Illusion);
    }
    if (family === "Orichalcum") {
      return svg('<path d="m4 12 7-7 13 3 5 12-8 8-14-4Z"/><path d="m11 5 2 10 11-7m-11 7 8 13m-8-13 16 5M4 12l9 3-6 9" fill="none" stroke-opacity=".6"/>' +
        (text.endsWith("+") ? '<path d="M24 2v7m-3-3.5h6" fill="none" stroke="#fff4ba" stroke-width="2"/>' : ""), colors.Orichalcum);
    }
    const tier = text.split(" ").at(-1);
    return svg(facets[tier] || facets.Gem, colors[family] || "#a9d8ff");
  };
  const shapes = {
    ring: '<ellipse cx="16" cy="20" rx="9" ry="8" fill="none" stroke="#f3d48f" stroke-width="4"/><path d="m11 8 5-5 5 5-5 7Z"/><path d="m11 8 10 0m-5-5v12" fill="none" stroke-opacity=".6"/>',
    earring: '<path d="M11 5a5 5 0 0 1 8 5l-3 5" fill="none" stroke="#f3d48f" stroke-width="3"/><path d="m16 13 7 8-7 9-7-9Z"/><path d="m16 13 0 17m-7-9h14" fill="none" stroke-opacity=".55"/>',
    ribbon: '<path d="m13 13-9-7-1 13 10-2m6-4 9-7 1 13-10-2M13 18 7 29l8-3 2-8m2 0 6 11-8-3-2-8"/><path d="m13 11 6 0 2 6-5 4-5-4Z" fill="#ffe1a7"/>',
    shield: '<path d="M16 3 28 8l-2 12-10 10L6 20 4 8Z"/><path d="m16 7 7 4-1 7-6 7-6-7-1-7Z" fill="#263e6a"/><path d="M16 9v14m-5-9h10" fill="none"/>',
    staff: '<path d="m7 28 13-18" fill="none" stroke="#f3d48f" stroke-width="4"/><path d="m22 2 7 7-7 7-7-7Z"/><path d="m22 2 0 14m-7-7h14" fill="none" stroke-opacity=".6"/><path d="m4 26 5 3" fill="none"/>',
    sword: '<path d="m24 2 5 1-2 6-14 14-4-4Z"/><path d="m23 7-12 14" fill="none" stroke-opacity=".6"/><path d="m6 18 8 8M4 29l6-6" fill="none" stroke="#f3d48f" stroke-width="4"/>',
    bottle: '<path d="M12 4h8v8l6 6v8l-4 3H10l-4-3v-8l6-6Z"/><path d="M11 3h10v5H11Z" fill="#f3d48f"/><path d="M9 21h14m-7-4v8" fill="none" stroke="#253b68" stroke-width="2"/><path d="m9 16 3-2" fill="none"/>',
    boost: '<path d="m16 3 11 6v14l-11 6-11-6V9Z"/><path d="m10 17 6-7 6 7m-6-6v12" fill="none" stroke="#253b68" stroke-width="3"/>',
    book: '<path d="m6 5 20-2v23L6 29l-3-3V8Z" fill="#7c8bc5"/><path d="M7 6v20l19-3M3 8l4 2" fill="none"/><path d="m17 8 5 6-5 7-5-6Z" fill="#f3d48f"/>',
    flower: '<path d="M16 12C4-1 0 15 12 17 0 25 14 33 16 21c7 13 18 1 5-4C34 13 23 0 16 12Z"/><path d="m16 12 5 5-5 5-5-5Z" fill="#ffe1a7"/>',
    amulet: '<path d="M6 4c0 12 20 12 20 0" fill="none" stroke="#f3d48f" stroke-width="2"/><path d="m16 13 9 7-9 10-9-10Z"/><path d="m16 13 0 17m-9-10h18" fill="none" stroke-opacity=".6"/>',
    armor: '<path d="m10 4 6 4 6-4 7 7-5 5-2 13H10L8 16l-5-5Z"/><path d="m10 4 6 9 6-9m-6 9v16m-7-9h14" fill="none" stroke-opacity=".6"/>',
  };
  const item = (recipeName) => {
    const name = typeof recipeName === "string" ? recipeName : "";
    if (/\b(Shard|Stone|Gem|Crystal|Illusion)$/.test(name) || /^Orichalcum/.test(name)) return material(name);
    let shape = "armor";
    if (/Ring|Band/.test(name)) shape = "ring";
    else if (/Earring/.test(name)) shape = "earring";
    else if (/Ribbon/.test(name)) shape = "ribbon";
    else if (/Save the King|Frozen Pride/.test(name)) shape = "shield";
    else if (/Save the Queen/.test(name)) shape = "staff";
    else if (/Weapon|Centurion/.test(name)) shape = "sword";
    else if (/Potion|Ether|Elixir|Megalixir|Recovery/.test(name)) shape = "bottle";
    else if (/Boost/.test(name)) shape = "boost";
    else if (/Archive/.test(name)) shape = "book";
    else if (/Bloom/.test(name)) shape = "flower";
    else if (/Amulet|Charm/.test(name)) shape = "amulet";
    return svg(shapes[shape], { ribbon: "#ef9abd", bottle: "#94e5c4", boost: "#ffe298", flower: "#f4b1d6" }[shape] || "#a9c5ff");
  };
  return Object.freeze({ material, item });
})();

export default icons;

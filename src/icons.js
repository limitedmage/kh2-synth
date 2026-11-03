const icons = (() => {
  // Original vector artwork; KHII colors and grade silhouettes referenced from
  // https://www.khwiki.com/Synthesis_material and the linked material design notes.
  const palettes = {
    Blazing: ["#ff493c", "#a61d39", "#ffae42", "#fff3ad"],
    Frost: ["#27dfff", "#2475cf", "#a2faff", "#efffff"],
    Lightning: ["#ffbf19", "#ce621b", "#fff35a", "#fffbd0"],
    Lucid: ["#c2eaff", "#658bb6", "#f0fcff", "#ffffff"],
    Power: ["#387aff", "#2433a6", "#8cbfff", "#def2ff"],
    Dark: ["#a946ed", "#502395", "#e194ff", "#f9d8ff"],
    Dense: ["#78889f", "#343b53", "#bdcbdc", "#eff7ff"],
    Twilight: ["#f1f5ff", "#9397c2", "#ffffff", "#ffffff"],
    Mythril: ["#8171ff", "#4331b5", "#62dfff", "#dcfaff"],
    Bright: ["#22c85e", "#147849", "#9dff68", "#e5ffbd"],
    Energy: ["#ad51fb", "#58249c", "#dd99ff", "#68ffff"],
    Serenity: ["#ffc62d", "#a17b1b", "#f6ff75", "#76eeff"],
    Remembrance: ["#52e55f", "#218751", "#b4ff7c", "#e7ffbd"],
    Tranquility: ["#e6b976", "#865132", "#ffe4a0", "#fff9be"],
    Orichalcum: ["#39e4e6", "#2787bb", "#a4ffff", "#ffffff"],
    Illusion: ["#8b68fa", "#48319b", "#63eeff", "#e9fcff"],
  };
  const fallback = ["#62b5ff", "#315eac", "#c3e9ff", "#ffffff"];
  const svg = (body, palette = fallback) =>
    `<svg class="kh-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="32" height="32" fill="none" stroke="#182341" stroke-width="1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><g fill="${palette[0]}">${body}</g></svg>`;
  const gleam = (d, color) => `<path d="${d}" fill="none" stroke="${color}" stroke-width="1.3"/>`;
  const facets = {
    Shard: (p) => '<path d="m22 3-2 8-7 6 1 7 8-1-8 7-9-6-2-10 8-9Z"/>' +
      `<path d="m22 3-11 9-6 12 9 6-1-13 7-6Z" fill="${p[1]}" stroke="none"/>` +
      `<path d="m3 14 8-9 11-2-11 9-6 12Z" fill="${p[2]}" stroke="none"/>` +
      gleam("m6 15 6-7 5-2", p[3]),
    Stone: (p) => '<path d="m12 8 11 2 4 9-8 8-11-4-3-9Z"/><path d="m5 3 4 2-3 6-4-3Zm20 21 5-2-2 8-5-2Z"/>' +
      `<path d="m12 8 2 10 5 9 8-8-13-1Z" fill="${p[1]}" stroke="none"/>` +
      `<path d="m12 8 11 2-9 8-9-4Z" fill="${p[2]}" stroke="none"/>` +
      gleam("m8 13 4-2 7 1", p[3]),
    Gem: (p) => '<path d="m11 4 10 0 5 7-10 13L6 11Z"/><path d="m3 13 5 2-2 8-5-5Zm26 0 2 5-5 5-2-8ZM16 25l4 3-4 3-4-3Z"/>' +
      `<path d="m6 11 8 1 2 12 10-13-8 1 3-8-5 3-5-3 3 8Z" fill="${p[1]}" stroke="none"/>` +
      `<path d="m11 4 10 0-3 8h-4Z" fill="${p[2]}" stroke="none"/>` +
      gleam("m12 6 7 0m-4 9 1 4", p[3]),
    Crystal: (p) => '<path d="m16 1 4 8 8-2-4 8 4 6-8-1-4 6-4-6-8 1 4-6-4-8 8 2Z"/><path d="m2 22 4 3-3 4-2-4Zm28 0 1 3-2 4-3-4ZM16 26l5 2-5 3-5-3Z"/>' +
      `<path d="m16 1 0 13 12-7-8 2Zm0 13 12 7-8-1-4 6Zm0 0L4 7l4 8-4 6Z" fill="${p[1]}" stroke="none"/>` +
      `<path d="m16 1-4 8-8-2 12 7 8 1-4-6Z" fill="${p[2]}" stroke="none"/>` +
      gleam("m16 8 0 9m-4-4 8 0", p[3]),
  };
  const modifiers = {
    Shard: '<path d="M8 3q5 1 8 7 3-6 8-7l-2 10 7 5-7 1-6 11-6-11-7-1 7-5Z"/>',
    Stone: '<path d="M10 8 12 2l4 6 4-6 2 9-6 17-8-12Q2 20 3 9q-5 12 3 17l6-3m11-11q9-4 6 8l-5 6 2-12Z"/>',
    Gem: '<path d="m16 2 9 15-9 9-9-9Z"/><path d="M3 16q0 12 21 9l5-6q-8 14-24 8Zm26-3Q21 27 5 20l-3 5q16 8 28-6Z"/>',
    Crystal: '<path d="M16 8Q9-4 6 3q9-1 6 8Q-1 7 2 16q4-6 10-1-10 10-3 14-1-9 6-10 3 15 10 9-8-2-6-10 13 0 11-8-5 6-11 2Q25 1 18 2Z"/>',
  };
  const remembrance = {
    Shard: '<path d="M2 9q6-5 14-3 8-2 14 3l-5 11-9 8-9-8Z"/>',
    Stone: '<circle cx="16" cy="4" r="2.5"/><path d="M3 11q5 3 8-2h10q3 5 8 2l-4 11-9 8-9-8Z"/>',
    Gem: '<path d="M4 5q8-2 12 4 4-6 12-4 4 11-4 11l-8 12-8-12Q0 16 4 5Z"/><circle cx="4" cy="26" r="3"/><circle cx="28" cy="26" r="3"/>',
    Crystal: '<circle cx="16" cy="3" r="2.5"/><path d="M11 8h10l1 5q9-8 9 2-1 7-8 4l-2 9H11l-2-9q-7 3-8-4 0-10 9-2Z"/><circle cx="4" cy="28" r="2.5"/><circle cx="28" cy="28" r="2.5"/>',
  };
  const mushroom = (p) => '<path d="M11 16 8 26l8 4 8-4-3-10Z"/>' +
    `<path d="M3 16Q2 3 16 3t13 13q-13 7-26 0Z" fill="${p[0]}"/>` +
    `<path d="m6 13 5-4 5 4 5-4 5 4M10 18l3-3m6 0 3 3" fill="none" stroke="${p[1]}" stroke-width="2"/>` +
    `<path d="m13 24 3-3 3 3-3 3Z" fill="${p[1]}" stroke="none"/>` +
    gleam("m13 18 1 0m4 0 1 0", p[3]);
  const material = (name) => {
    const text = typeof name === "string" ? name : "";
    const family = text.split(" ")[0].replace("+", "");
    const p = palettes[family] || fallback;
    const tier = text.split(" ").at(-1);
    if (/Illusion$/.test(text)) {
      const p = palettes.Illusion;
      const lost = text === "Lost Illusion";
      return svg('<path d="m16 2 5 5-5 5-5-5Zm0 10 7 5-7 11-7-11Z"/>' +
        `<path d="${lost ? "m10 15-9-9 2 14 7 5-4-7 6 3M22 15l9-9-2 14-7 5 4-7-6 3m-7 3-2 7 5-4 5 4-2-7" : "m10 15-9-5 2 9 7 6-4-7 6 3M22 15l9-5-2 9-7 6 4-7-6 3"}" fill="${p[2]}"/>` +
        gleam("m16 5 0 3m0 8 0 7", p[3]), p);
    }
    if (family === "Orichalcum") {
      const plus = text === "Orichalcum+";
      return svg((plus ? '<path d="m6 6 5 7 5-10 5 10 5-7M4 18h24" fill="none" stroke="#a4ffff"/>' : "") +
        '<path d="m16 2 4 10 5-6-1 9 6-1-7 7 5 3-9 1-3 6-3-6-9-1 5-3-7-7 6 1-1-9 5 6Z"/>' +
        `<path d="m16 2 0 16 9-12-5 6Zm0 16 12 6-9 1-3 6Zm0 0L2 14l7 7-5 3Z" fill="${p[1]}" stroke="none"/>` +
        (plus ? `<path d="m4 5 5 1-1-4m16 0-1 4 5-1m-21 22-4 2m22-2 4 2" fill="none" stroke="${p[2]}"/>` : "") +
        gleam("M16 13v9m-4-5h8", p[3]), p);
    }
    if (family === "Tranquility") {
      const ring = tier === "Gem" || tier === "Crystal";
      return svg((ring ? `<ellipse cx="16" cy="18" rx="14" ry="10" fill="none" stroke="${p[3]}" stroke-width="1.5"/>` : "") +
        mushroom(p) + (tier === "Crystal" ?
          `<g transform="translate(0 19) scale(.25)">${mushroom(p)}</g><g transform="translate(24 19) scale(.25)">${mushroom(p)}</g>` :
          tier !== "Shard" ? gleam("M3 21v6m-2-3h4m24-3v6m-2-3h4", p[3]) : ""), p);
    }
    if (family === "Remembrance") {
      return svg((remembrance[tier] || remembrance.Gem) +
        `<path d="M10 13q6 4 12 0l-6 9Z" fill="${p[1]}" stroke="none"/><circle cx="12" cy="11" r="2" fill="${p[2]}" stroke="none"/>` +
        gleam("m14 17 2 2 3-3", p[3]), p);
    }
    if (["Bright", "Energy", "Serenity"].includes(family)) {
      const motif = family === "Energy" ? gleam("m18 10-5 6 6 0-5 7", p[3]) :
        family === "Serenity" ? `<path d="M16 10q5 7 2 11-6 3-5-3l3-3Z" fill="${p[3]}" stroke="none"/>` :
          `<circle cx="16" cy="14" r="2.5" fill="${p[2]}" stroke="none"/><circle cx="13" cy="20" r="1.5" fill="${p[3]}" stroke="none"/>`;
      return svg((modifiers[tier] || modifiers.Gem) +
        `<path d="M12 12q-2 8 4 12l4-9-4 3Z" fill="${p[1]}" stroke="none"/>` + motif, p);
    }
    return svg((facets[tier] || facets.Gem)(p), p);
  };
  const shapes = {
    ring: (p) => `<ellipse cx="16" cy="21" rx="8" ry="8" fill="none" stroke="${p[1]}" stroke-width="5"/><path d="M9 22a7 7 0 0 1 14 0" fill="none" stroke="${p[2]}" stroke-width="3"/><path d="m16 2 7 6-7 8-7-8Z"/><path d="m16 2 0 14 7-8Z" fill="${p[1]}" stroke="none"/>`,
    earring: (p) => `<path d="M11 7a5 5 0 1 1 9 3l-4 5" fill="none" stroke="${p[2]}" stroke-width="3"/><path d="m16 12 8 9-8 9-8-9Z"/><path d="m16 12 0 18 8-9Z" fill="${p[1]}" stroke="none"/>`,
    ribbon: (p) => `<path d="m13 13-9-8-2 14 10-2m7-4 9-8 2 14-10-2M12 18 6 30l9-4 2-8m3 0 6 12-9-4-2-8"/><path d="m4 8 9 7-10 2m25-9-9 7 10 2" fill="${p[1]}" stroke="none"/><path d="m13 11 6 0 2 6-5 4-5-4Z" fill="${p[2]}"/>`,
    shield: (p) => `<path d="M16 2 29 8l-3 13-10 9L6 21 3 8Z" fill="${p[2]}"/><path d="m16 6 9 4-2 9-7 7-7-7-2-9Z"/><path d="m16 6 9 4-2 9-7 7Z" fill="${p[1]}" stroke="none"/><path d="m11 13 3 2 2-5 2 5 3-2-1 7h-8Z" fill="${p[2]}" stroke="none"/>`,
    staff: (p) => `<path d="m6 29 15-20" fill="none" stroke="${p[2]}" stroke-width="4"/><path d="m22 2 8 7-8 8-8-8Z"/><path d="m22 2 0 15 8-8Z" fill="${p[1]}" stroke="none"/><path d="m19 7 3-2 3 3" fill="none" stroke="${p[3]}"/><path d="m3 26 6 4" fill="none" stroke="${p[1]}" stroke-width="3"/>`,
    sword: (p) => `<path d="m24 2 6 1-3 7-14 14-5-5Z"/><path d="m24 5-14 16 3 3 14-14Z" fill="${p[2]}" stroke="none"/><path d="m5 18 10 9M3 30l7-7" fill="none" stroke="${p[1]}" stroke-width="4"/>`,
    keyblade: (p) => `<path d="m12 20 12-15 3 2-12 16Z" fill="${p[2]}"/><path d="m23 4 5-2 2 5-3 1-1 4-3-1Z"/><path d="m6 19 9 8-5 4-8-8Z" fill="${p[1]}"/><path d="m6 22 5 5-1 1-5-5Z" fill="#182341" stroke="none"/><path d="m4 18 13 11" fill="none" stroke="${p[2]}" stroke-width="3"/><path d="m3 27-1 3h4" fill="none" stroke="${p[3]}"/>`,
    bottle: (p) => `<path d="M12 7h8v6l7 6v8l-5 3H10l-5-3v-8l7-6Z" fill="${p[2]}"/><path d="M8 20h16v6l-3 2H11l-3-2Z"/><path d="M11 3h10v6H11Z" fill="${p[1]}"/><path d="m10 17 3-3m1 9h4m-2-2v4" fill="none" stroke="${p[3]}" stroke-width="1.5"/>`,
    boost: (p) => `<path d="m16 2 12 7v14l-12 7-12-7V9Z" fill="${p[1]}"/><path d="m16 5 9 5v11l-9 6-9-6V10Z"/><path d="m9 17 7-8 7 8h-5v7h-4v-7Z" fill="${p[2]}" stroke="none"/>`,
    book: (p) => `<path d="m6 5 21-3v24L6 30l-3-3V8Z" fill="${p[1]}"/><path d="m7 6 20-3v20L7 27Z"/><path d="m8 27 19-4v3L8 30Z" fill="${p[2]}"/><path d="m17 8 6 6-6 7-6-6Z" fill="${p[2]}"/><path d="M7 6v21" fill="none" stroke="${p[3]}"/>`,
    flower: (p) => `<path d="M16 11C4-1-1 14 11 17-1 26 14 33 16 22c8 12 18-1 6-5C34 12 23-1 16 11Z"/><path d="m16 11 0 7-5-1m5 1 6-1m-6 1 0 4" fill="none" stroke="${p[1]}" stroke-width="2"/><path d="m16 12 5 5-5 5-5-5Z" fill="${p[2]}"/>`,
    amulet: (p) => `<path d="M5 3c0 14 22 14 22 0" fill="none" stroke="${p[2]}" stroke-width="2"/><path d="m16 13 10 7-10 11L6 20Z"/><path d="m16 13 0 18 10-11Z" fill="${p[1]}" stroke="none"/><path d="m16 16 5 4-5 6-5-6Z" fill="${p[2]}" stroke="none"/>`,
    bracelet: (p) => `<ellipse cx="16" cy="17" rx="12" ry="10" fill="${p[1]}"/><ellipse cx="16" cy="14" rx="8" ry="5" fill="#182341"/><path d="M4 15v7q12 11 24 0v-7q-12 12-24 0Z"/><path d="m16 19 5 4-5 6-5-6Z" fill="${p[2]}"/>`,
    armor: (p) => `<path d="m10 3 6 4 6-4 8 8-6 5-2 14H10L8 16l-6-5Z"/><path d="m16 7 6-4-3 12 3 15h-6Z" fill="${p[1]}" stroke="none"/><path d="m10 3 6 9 6-9m-12 17 6 3 6-3" fill="none" stroke="${p[2]}" stroke-width="2"/>`,
  };
  const equipment = {
    ring: ["#3cafff", "#bf7c20", "#ffda53", "#ffffff"],
    earring: ["#be66ff", "#ac7219", "#ffda53", "#ffffff"],
    ribbon: ["#ff4a88", "#a72362", "#ffe268", "#fff2f7"],
    shield: ["#4096ff", "#24378b", "#ffda53", "#ffffff"],
    staff: ["#f75bce", "#6a36ad", "#ffda53", "#ffffff"],
    sword: ["#b2e8ff", "#526cc2", "#fff2b0", "#ffffff"],
    keyblade: ["#6ad5ff", "#ad7322", "#ffe064", "#ffffff"],
    bottle: ["#51e579", "#9661da", "#b5fff1", "#ffffff"],
    boost: ["#ff9142", "#ba3e40", "#fff16b", "#ffffff"],
    book: ["#bb65ed", "#50318c", "#ffda53", "#ffffff"],
    flower: ["#ff65b6", "#b02b88", "#ffe064", "#ffffff"],
    amulet: ["#51dce2", "#3276bd", "#ffda53", "#ffffff"],
    bracelet: ["#8f78ff", "#5441a3", "#ffda53", "#ffffff"],
    armor: ["#5eafff", "#36569c", "#ffe064", "#ffffff"],
  };
  const item = (recipeName) => {
    const name = typeof recipeName === "string" ? recipeName : "";
    if (/\b(Shard|Stone|Gem|Crystal|Illusion)$/.test(name) || /^Orichalcum\+?$/.test(name)) return material(name);
    let shape = "armor";
    if (/Ring|Band/.test(name)) shape = "ring";
    else if (/Earring/.test(name)) shape = "earring";
    else if (/Ribbon/.test(name)) shape = "ribbon";
    else if (/Save the King|Frozen Pride/.test(name)) shape = "shield";
    else if (/Save the Queen/.test(name)) shape = "staff";
    else if (/Ultima Weapon/.test(name)) shape = "keyblade";
    else if (/Weapon|Centurion/.test(name)) shape = "sword";
    else if (/Potion|Ether|Elixir|Megalixir|Recovery/.test(name)) shape = "bottle";
    else if (/Boost/.test(name)) shape = "boost";
    else if (/Archive/.test(name)) shape = "book";
    else if (/Bloom/.test(name)) shape = "flower";
    else if (/Amulet|Charm/.test(name)) shape = "amulet";
    else if (/Bangle|Armlet|Trinket|Anklet|Acrisius/.test(name)) shape = "bracelet";
    const elemental = /Firag/.test(name) ? palettes.Blazing :
      /Blizzag/.test(name) ? palettes.Frost : /Thundag/.test(name) ? palettes.Lightning : null;
    const p = elemental || equipment[shape];
    return svg(shapes[shape](p), p);
  };
  return Object.freeze({ material, item });
})();

export default icons;

globalThis.KH2Data = (() => {
  const wiki = (name) => `https://www.khwiki.com/${encodeURIComponent(name.replaceAll(" ", "_"))}`;
  const worlds = [
    ["tt", "Twilight Town", ["Not reached", "First Sora visit / tower", "Second Sora visit", "Final visit / mansion open"]],
    ["hb", "Hollow Bastion / Radiant Garden", ["Not reached", "First visit", "1000 Heartless battle complete", "Late-game areas open"]],
    ["ld", "The Land of Dragons", ["Not reached", "First visit", "Second visit / palace open"]],
    ["bc", "Beast's Castle", ["Not reached", "First visit", "Second visit"]],
    ["oc", "Olympus Coliseum", ["Not reached", "First visit / Underworld", "Second visit"]],
    ["dc", "Disney Castle", ["Not reached", "Castle open"]],
    ["tr", "Timeless River", ["Not reached", "Past the castle portal"]],
    ["pr", "Port Royal", ["Not reached", "First visit", "Second visit / ship graveyard"]],
    ["ag", "Agrabah", ["Not reached", "First visit", "Second visit"]],
    ["ht", "Halloween Town", ["Not reached", "First visit", "Second visit"]],
    ["pl", "Pride Lands", ["Not reached", "First visit", "Second visit complete"]],
    ["sp", "Space Paranoids", ["Not reached", "First visit", "Second visit"]],
    ["aw", "100 Acre Wood", ["Not reached", "Pooh / Piglet", "Rabbit / Kanga", "Spooky Cave / Starry Hill"]],
    ["at", "Atlantica", ["Not reached", "Musicals available", "Final musical available"]],
    ["tw", "The World That Never Was", ["Not reached", "City / before castle", "Castle / before Xigbar", "After Xigbar / upper castle"]],
    ["co", "Cavern of Remembrance", ["Not reached", "Depths", "Mining Area / Engine Chamber", "Transport to Remembrance / Garden"]],
  ].map(([id, name, stages]) => ({ id, name, stages }));
  const optional = [
    ["mushrooms", "Mushroom XIII challenges available"],
    ["silhouettes", "Absent Silhouette battles available"],
    ["data", "Garden of Assemblage data battles unlocked"],
    ["clear", "Game cleared / Lingering Will available"],
  ];
  const tiers = ["Shard", "Stone", "Gem", "Crystal"];
  const families = ["Blazing", "Frost", "Lightning", "Lucid", "Power", "Dark", "Dense", "Twilight", "Mythril", "Bright", "Energy", "Serenity", "Remembrance", "Tranquility"];
  const materialNames = families.flatMap((f) => tiers.map((t) => `${f} ${t}`)).concat(["Orichalcum", "Orichalcum+", "Manifest Illusion", "Lost Illusion"]);
  const materialPages = { Power: "Pulsing", Dark: "Writhing", Dense: "Betwixt", Bright: "Soothing", Energy: "Wellspring", Serenity: "Hungry", "Manifest Illusion": "Illusion", "Lost Illusion": "Illusion", "Orichalcum+": "Orichalcum" };
  const materials = Object.fromEntries(materialNames.map((name) => [name, {
    name, sources: [], chests: [],
    url: wiki(materialPages[name] || materialPages[name.split(" ")[0]] || name.split(" ")[0]),
  }]));
  const source = (material, world, stage, enemy, room, rate, unlock = "", note = "") => {
    materials[material].sources.push({ world, stage, enemy, room, rate, unlock, note, url: wiki(enemy) });
  };
  const drops = (family, rows) => rows.forEach(([tier, world, stage, enemy, room, rate]) => source(`${family} ${tier}`, world, stage, enemy, room, rate));
  drops("Blazing", [
    ["Shard", "tr", 1, "Minute Bomb", "Mickey's House / town windows", 6],
    ["Shard", "pr", 1, "Hammer Frame", "Town", 10],
    ["Stone", "oc", 1, "Tornado Step", "Cave of the Dead: Passage", 8],
    ["Stone", "pr", 1, "Cannon Gun", "Town / Isla de Muerta", 6],
    ["Gem", "ag", 1, "Fat Bandit", "Agrabah / Bazaar", 12],
    ["Gem", "ag", 1, "Fiery Globe", "Agrabah / Cave of Wonders", 4],
    ["Crystal", "oc", 1, "Crescendo", "Underworld Caverns", 6],
    ["Crystal", "bc", 2, "Crimson Jazz", "Entrance Hall / Ballroom", 12],
    ["Crystal", "hb", 2, "Crimson Jazz", "Borough", 12],
  ]);
  drops("Frost", [
    ["Shard", "ld", 1, "Hook Bat", "Mountain Trail / Cave", 6],
    ["Shard", "pr", 1, "Lance Soldier", "Town", 10],
    ["Stone", "tr", 1, "Aeroplane", "Scene of the Fire", 8],
    ["Stone", "tr", 1, "Hot Rod", "Timeless River window scenes", 12],
    ["Gem", "ag", 1, "Fortuneteller", "Agrabah / Bazaar", 8],
    ["Gem", "ag", 1, "Icy Cube", "Agrabah / Cave of Wonders", 4],
    ["Crystal", "pl", 1, "Living Bone", "Elephant Graveyard", 12],
  ]);
  drops("Lightning", [
    ["Shard", "ld", 1, "Bolt Tower", "Checkpoint", 10],
    ["Shard", "tr", 1, "Rapid Thruster", "Timeless River window scenes", 4],
    ["Shard", "pl", 2, "Rapid Thruster", "Pride Rock: Peak", 4],
    ["Stone", "ht", 1, "Driller Mole", "Candy Cane Lane", 6],
    ["Stone", "ld", 2, "Emerald Blues", "Mountain Trail / Ridge", 10],
    ["Gem", "hb", 2, "Armored Knight", "Restoration Site / Bailey", 12],
    ["Gem", "sp", 1, "Surveillance Robot", "Canyon", 8],
    ["Crystal", "sp", 1, "Strafer", "Canyon / I/O Tower: Hallway", 6],
    ["Crystal", "sp", 2, "Devastator", "Space Paranoids", 4],
  ]);
  drops("Lucid", [
    ["Shard", "bc", 1, "Rabid Dog", "Castle halls", 6],
    ["Shard", "oc", 1, "Trick Ghost", "Cave of the Dead: Passage", 10],
    ["Stone", "ht", 1, "Wight Knight", "Halloween Town Square / Graveyard", 8],
    ["Stone", "ht", 2, "Graveyard", "Halloween Town Square", 12],
    ["Stone", "ht", 2, "Toy Soldier", "Christmas Town", 12],
    ["Gem", "hb", 2, "Bookmaster", "Borough", 10],
    ["Gem", "sp", 1, "Magnum Loader", "I/O Tower: Hallway", 8],
    ["Crystal", "ld", 2, "Neoshadow", "Mountain Trail / Cave", 8],
    ["Crystal", "tw", 1, "Neoshadow", "Fragment Crossing", 8],
  ]);
  drops("Power", [
    ["Shard", "ht", 1, "Creeper Plant", "Halloween Town Square / Graveyard", 8],
    ["Shard", "bc", 1, "Large Body", "Castle halls", 12],
    ["Stone", "ag", 1, "Luna Bandit", "Bazaar", 8],
    ["Stone", "pr", 1, "Silver Rock", "Town / Isla de Muerta", 6],
    ["Gem", "pl", 1, "Aerial Knocker", "Jungle", 8],
    ["Gem", "pl", 1, "Shaman", "Elephant Graveyard / Wastelands", 10],
    ["Crystal", "ht", 2, "Morning Star", "Christmas Town: Candy Cane Lane", 12],
  ]);
  drops("Dark", [
    ["Shard", "tr", 1, "Soldier", "Mickey's House", 8],
    ["Shard", "bc", 1, "Shadow", "Castle halls", 4],
    ["Stone", "ld", 1, "Assault Rider", "Village / Checkpoint / Mountain Trail", 12],
    ["Stone", "ld", 1, "Nightwalker", "Village / Mountain Trail", 10],
    ["Gem", "bc", 1, "Gargoyle Knight", "Entrance Hall / The West Hall", 10],
    ["Gem", "bc", 1, "Gargoyle Warrior", "Entrance Hall / The West Hall", 8],
    ["Crystal", "ld", 2, "Air Pirate", "Mountain Trail / Ridge", 8],
  ]);
  drops("Dense", [
    ["Shard", "tt", 2, "Creeper", "Twilight Town Nobody encounters", 8],
    ["Shard", "ld", 2, "Dragoon", "Palace", 12],
    ["Shard", "tw", 2, "Dragoon", "Castle", 12],
    ["Stone", "ld", 2, "Sniper", "Palace", 12],
    ["Stone", "tw", 3, "Sniper", "Hall of Empty Melodies", 12],
    ["Gem", "tt", 3, "Samurai", "Mansion: Basement Hall", 12],
    ["Gem", "tw", 3, "Samurai", "Upper castle", 12],
    ["Crystal", "tt", 3, "Berserker", "Station / Underground Concourse", 12],
    ["Crystal", "tw", 2, "Berserker", "Naught's Skyway", 12],
  ]);
  drops("Twilight", [
    ["Shard", "tt", 2, "Dusk", "Twilight Town Nobody encounters", 10],
    ["Shard", "pr", 2, "Gambler", "Isla de Muerta", 12],
    ["Stone", "tt", 3, "Dancer", "Station / Underground Concourse", 12],
    ["Stone", "tw", 2, "Dancer", "Castle", 12],
    ["Gem", "tw", 3, "Assassin", "Hall of Empty Melodies (upper level)", 12],
    ["Crystal", "tw", 3, "Sorcerer", "Naught's Skyway / Nothing's Call", 12],
  ]);
  drops("Bright", [
    ["Shard", "tr", 1, "Soldier", "Mickey's House", 4],
    ["Shard", "ld", 1, "Hook Bat", "Mountain Trail / Cave", 3],
    ["Shard", "ht", 1, "Creeper Plant", "Halloween Town Square", 4],
    ["Stone", "oc", 1, "Tornado Step", "Cave of the Dead: Passage", 4],
    ["Stone", "ag", 1, "Luna Bandit", "Bazaar", 4],
    ["Gem", "pl", 1, "Aerial Knocker", "Jungle", 4],
    ["Gem", "sp", 1, "Magnum Loader", "I/O Tower: Hallway", 4],
    ["Crystal", "ld", 2, "Air Pirate", "Mountain Trail / Ridge", 4],
    ["Crystal", "oc", 1, "Crescendo", "Underworld Caverns", 3],
    ["Crystal", "tw", 1, "Neoshadow", "Fragment Crossing", 4],
  ]);
  drops("Energy", [
    ["Shard", "ld", 1, "Nightwalker", "Village / Mountain Trail", 4],
    ["Shard", "bc", 1, "Gargoyle Knight", "Entrance Hall / The West Hall", 4],
    ["Stone", "oc", 1, "Trick Ghost", "Cave of the Dead: Passage", 4],
    ["Stone", "pr", 1, "Lance Soldier", "Town", 4],
    ["Gem", "ag", 1, "Fortuneteller", "Agrabah / Bazaar", 4],
    ["Gem", "ld", 2, "Emerald Blues", "Mountain Trail / Ridge", 4],
    ["Crystal", "hb", 2, "Bookmaster", "Borough", 4],
    ["Crystal", "pl", 1, "Shaman", "Elephant Graveyard / Wastelands", 4],
  ]);
  drops("Serenity", [
    ["Shard", "ld", 1, "Assault Rider", "Mountain Trail", 4],
    ["Shard", "ag", 1, "Fat Bandit", "Agrabah / Bazaar", 4],
    ["Shard", "tr", 1, "Hot Rod", "Timeless River window scenes", 4],
    ["Stone", "bc", 2, "Crimson Jazz", "Entrance Hall / Ballroom", 4],
    ["Stone", "pl", 1, "Living Bone", "Elephant Graveyard", 4],
    ["Stone", "ht", 2, "Morning Star", "Candy Cane Lane", 4],
    ["Gem", "co", 2, "Spring Metal", "Mining Area / Engine Chamber", 4],
    ["Gem", "co", 2, "Runemaster", "Mining Area / Engine Chamber", 4],
  ]);
  const vendorRooms = [["ld", "Checkpoint"], ["bc", "The West Hall"], ["oc", "Cave of the Dead: Entrance"], ["ag", "Bazaar"], ["ht", "Candy Cane Lane"]];
  for (const [world, room] of vendorRooms) {
    tiers.forEach((tier, i) => source(`Serenity ${tier}`, world, 2, "Bulky Vendor", room, 100, "", ["Capsule Prize: react at 100–75% HP.", "Rare Capsule: react at 74–50% HP.", "Limited Capsule: react at 49–25% HP.", "Prime Capsule: wait until 24–1% HP."][i] + " Rare spawn; look for the Rare Heartless message and interact with scenery."));
    source("Orichalcum", world, 2, "Bulky Vendor", room, null, "", "Capsule reaction: 8–16% depending on timing; Prime Capsule has the best rate. Rare spawn.");
  }
  drops("Remembrance", [
    ["Shard", "co", 1, "Iron Hammer", "Depths", 10],
    ["Shard", "co", 1, "Beffudler", "Depths", 6],
    ["Stone", "co", 1, "Magic Phantom", "Depths", 10],
    ["Stone", "co", 1, "Necromancer", "Depths", 10],
    ["Gem", "co", 2, "Mad Ride", "Mining Area", 12],
    ["Gem", "co", 2, "Spring Metal", "Mining Area / Engine Chamber", 10],
    ["Crystal", "co", 2, "Reckless", "Engine Chamber", 12],
  ]);
  tiers.forEach((tier, i) => source(`Tranquility ${tier}`, "ag", 2, "Mushroom XIII", "No. V: Cave of Wonders: Treasure Room", null, "mushrooms", `Challenge reward, not a normal kill drop. Earn rank ${["E", "D", "C", "B"][i]} or better. Other Mushroom challenges also award this tier.`));
  source("Lost Illusion", "hb", 2, "Absent Silhouette", "Vexen, Lexaeus, Zexion, Marluxia or Larxene", null, "silhouettes", "One-time reward from each silhouette. Not repeatable; use data battles for further copies.");
  source("Lost Illusion", "co", 3, "Organization XIII's Replica Data", "Garden of Assemblage", null, "data", "Repeat Vexen, Lexaeus, Zexion, Marluxia or Larxene for more copies.");
  source("Manifest Illusion", "dc", 1, "Lingering Will", "Hall of the Cornerstone portal", null, "clear", "Repeatable postgame boss reward.");
  const chest = (name, world, stage, rooms) => {
    for (const room of rooms.split(";")) materials[name].chests.push({ world, stage, room: room.trim(), url: materials[name].url });
  };
  chest("Mythril Shard", "tt", 1, "The Old Mansion;The Woods;Market Street: Tram Common;Central Station;Tower: Entryway;Sunset Terrace");
  chest("Mythril Shard", "hb", 1, "Borough");
  chest("Mythril Shard", "ld", 1, "Bamboo Grove;Checkpoint;Mountain Trail");
  chest("Mythril Shard", "bc", 1, "The East Wing;The West Hall;Secret Passage;The West Wing;Courtyard");
  chest("Mythril Shard", "oc", 1, "Cave of the Dead: Passage;Cave of the Dead: Inner Chamber;Underworld Caverns: Entrance;Underworld Caverns: The Lost Road;The Lock");
  chest("Mythril Shard", "dc", 1, "Courtyard");
  chest("Mythril Shard", "pr", 1, "Pier;Town;Isla de Muerta: Cave Mouth;Isla de Muerta: Moonlight Nook");
  chest("Mythril Shard", "ag", 1, "Agrabah;Bazaar;Cave of Wonders: Entrance;Cave of Wonders: Valley of Stone");
  chest("Mythril Shard", "ht", 1, "Graveyard");
  chest("Mythril Shard", "pl", 1, "Elephant Graveyard;Wastelands");
  chest("Mythril Stone", "tt", 1, "Tower: Wardrobe");
  chest("Mythril Stone", "tt", 3, "Mansion: Foyer;Mansion: Dining Room");
  chest("Mythril Stone", "hb", 2, "Corridors");
  chest("Mythril Stone", "oc", 1, "Cave of the Dead: Passage;Underworld Caverns: The Lost Road");
  chest("Mythril Stone", "dc", 1, "Courtyard");
  chest("Mythril Stone", "tr", 1, "Waterway");
  chest("Mythril Stone", "pr", 1, "Rampart");
  chest("Mythril Stone", "ag", 1, "Agrabah;Palace Walls;Cave of Wonders: Valley of Stone");
  chest("Mythril Stone", "ht", 1, "Halloween Town Square;Hinterlands;Candy Cane Lane");
  chest("Mythril Stone", "pl", 1, "Gorge;Elephant Graveyard;Pride Rock;Wildebeest Valley;Wastelands;Jungle");
  chest("Mythril Stone", "sp", 1, "Canyon");
  chest("Mythril Stone", "aw", 1, "Pooh Bear's House");
  chest("Mythril Stone", "tw", 1, "Fragment Crossing;Memory's Skyscraper");
  chest("Mythril Stone", "tw", 3, "Ruin and Creation's Passage");
  chest("Mythril Gem", "tt", 3, "Underground Concourse");
  chest("Mythril Gem", "hb", 2, "Postern;Corridors");
  chest("Mythril Gem", "pr", 1, "Town");
  chest("Mythril Gem", "ag", 1, "Bazaar");
  chest("Mythril Gem", "ht", 1, "Candy Cane Lane");
  chest("Mythril Gem", "pl", 1, "Wildebeest Valley");
  chest("Mythril Gem", "sp", 1, "Canyon");
  chest("Mythril Gem", "aw", 1, "Piglet's House");
  chest("Mythril Gem", "aw", 3, "The Spooky Cave");
  chest("Mythril Gem", "tw", 2, "Nothing's Call;Naught's Skyway");
  chest("Mythril Crystal", "tt", 3, "Underground Concourse;Tunnelway;Sunset Terrace;Mansion: Foyer;Mansion: Dining Room");
  chest("Mythril Crystal", "hb", 2, "Corridors");
  chest("Mythril Crystal", "ld", 2, "Throne Room");
  chest("Mythril Crystal", "pr", 2, "Ship Graveyard: Seadrift Row");
  chest("Mythril Crystal", "sp", 1, "Pit Cell");
  chest("Mythril Crystal", "aw", 2, "Rabbit's House");
  chest("Mythril Crystal", "aw", 3, "The Spooky Cave");
  chest("Mythril Crystal", "tw", 1, "Fragment Crossing;Memory's Skyscraper");
  chest("Mythril Crystal", "tw", 3, "Naught's Skyway;Ruin and Creation's Passage");
  chest("Orichalcum", "aw", 2, "Kanga's House");
  chest("Orichalcum", "aw", 3, "The Spooky Cave");
  chest("Orichalcum", "ld", 2, "Throne Room");
  chest("Orichalcum", "pr", 2, "Ship Graveyard: Seadrift Keep");
  chest("Orichalcum", "tt", 3, "Underground Concourse;Tunnelway;Mansion: Library");
  chest("Orichalcum", "tw", 1, "Fragment Crossing");
  chest("Orichalcum", "tw", 3, "Nothing's Call;Naught's Skyway;Ruin and Creation's Passage");
  chest("Orichalcum+", "sp", 2, "Central Computer Mesa");
  chest("Orichalcum+", "tt", 3, "Sunset Terrace");
  chest("Orichalcum+", "tw", 1, "The Brink of Despair");
  chest("Manifest Illusion", "co", 1, "Depths");
  chest("Manifest Illusion", "co", 2, "Mining Area;Engine Chamber");
  chest("Lost Illusion", "co", 3, "Garden of Assemblage");
  chest("Serenity Crystal", "tt", 3, "Mansion: Foyer");
  chest("Serenity Crystal", "co", 2, "Mining Area;Engine Chamber");
  chest("Serenity Crystal", "pl", 1, "Pride Rock;Jungle");
  chest("Serenity Gem", "co", 2, "Mining Area");
  chest("Serenity Gem", "pr", 1, "Isla de Muerta: Moonlight Nook");
  chest("Serenity Gem", "pr", 2, "Ship Graveyard: Seadrift Row");
  chest("Serenity Gem", "ag", 1, "Cave of Wonders: Treasure Room");
  chest("Serenity Gem", "ht", 1, "Graveyard");
  chest("Serenity Gem", "pl", 1, "Wastelands;Jungle");
  const rewards = [
    ["sp", "Central Computer Mesa chest", 2],
    ["tt", "Sunset Terrace chest (Sora)", 3],
    ["tw", "The Brink of Despair chest", 1],
    ["aw", "Complete Starry Hill", 3],
    ["at", "Complete A New Day is Dawning", 2],
    ["oc", "Win Goddess of Fate Cup (after Xemnas's first battle)", 2],
    ["hb", "Hand in all 60 Final Mix material types to a Moogle", 1],
  ].map(([world, label, stage], i) => ({ id: `plus-${i}`, world, label, stage }));
  for (const reward of rewards.slice(3)) source("Orichalcum+", reward.world, reward.stage, "One-time reward", reward.label, null, "", "Collect once; never a repeatable enemy drop.");
  const recipes = [];
  function recipe(name, rank, ingredients, upgrade, modifier, category = "Recipes", unlock = "", minLevel = 1, types = 0) {
    const base = { name, rank, ingredients, category, unlock, minLevel, types, url: wiki(name), base: "", modifier: "" };
    recipes.push(base);
    if (upgrade) recipes.push({ ...base, name: upgrade, base: name, modifier, minLevel: Math.max(3, minLevel), url: wiki(name) });
  }
  recipe("Mega-Potion", "B", { "Mythril Shard": 3, "Power Shard": 1, "Blazing Shard": 1, "Lucid Shard": 1 }, "Mega-Ether", "Serenity Stone", "Recipes", "Mega Recipe · Beast's Castle: Belle's Room");
  recipe("Elixir", "A", { "Mythril Stone": 3, "Power Stone": 1, "Dark Stone": 1 }, "Megalixir", "Serenity Gem", "Recipes", "Star Recipe · Disney Castle: Courtyard");
  recipe("Drive Recovery", "C", { "Mythril Shard": 3, "Dark Shard": 3, "Frost Shard": 1, "Lightning Shard": 1 }, "High Drive Recovery", "Serenity Shard", "Recipes", "Recovery Recipe · Land of Dragons: Mountain Trail");
  recipe("AP Boost", "S", { "Mythril Gem": 1, "Power Crystal": 3, "Dark Crystal": 3, "Frost Crystal": 3 }, "Magic Boost", "Serenity Crystal", "Recipes", "Skill Recipe · Radiant Garden: Ansem's Study");
  recipe("Defense Boost", "S", { "Mythril Crystal": 1, "Blazing Crystal": 3, "Lightning Crystal": 3, "Lucid Crystal": 3 }, "Power Boost", "Serenity Crystal", "Recipes", "Guard Recipe · 100 Acre Wood: Spooky Cave minigame");
  recipe("Petite Ribbon", "A", { "Mythril Crystal": 2, "Orichalcum": 1, "Dense Stone": 1, "Dense Shard": 1 }, "Ribbon", "Serenity Gem", "Recipes", "Style Recipe · 100 Acre Wood: Starry Hill");
  recipe("Moon Amulet", "A", { "Orichalcum": 3, "Mythril Crystal": 1, "Twilight Stone": 1, "Twilight Shard": 1 }, "Star Charm", "Serenity Gem", "Recipes", "Moon Recipe · Radiant Garden: Restoration Site");
  recipe("Save the Queen", "S", { "Orichalcum": 1, "Dense Crystal": 3, "Dense Gem": 5, "Dense Stone": 7, "Dense Shard": 9 }, "Save the Queen+", "Serenity Crystal", "Recipes", "Queen Recipe · Land of Dragons: Throne Room");
  recipe("Save the King", "S", { "Orichalcum": 1, "Twilight Crystal": 3, "Twilight Gem": 5, "Twilight Stone": 7, "Twilight Shard": 9 }, "Save the King+", "Serenity Crystal", "Recipes", "King Recipe · Port Royal: Ship Graveyard: Seadrift Row");
  recipe("Ultima Weapon", "S", { "Orichalcum+": 13, "Orichalcum": 1, "Mythril Crystal": 1, "Dense Crystal": 1, "Twilight Crystal": 1, "Serenity Crystal": 3 }, "", "", "Recipes", "Ultimate Recipe · Twilight Town: Mansion: Basement Corridor · Energy Crystal required", 2);
  for (const [name, upgrade, family] of [["Firaga Bangle", "Firagun Bangle", "Blazing"], ["Blizzaga Armlet", "Blizzagun Armlet", "Frost"], ["Thundaga Trinket", "Thundagun Trinket", "Lightning"], ["Midnight Anklet", "Chaos Anklet", "Lucid"]]) {
    recipe(name, "C", { "Mythril Shard": 5, [`${family} Stone`]: 1, [`${family} Shard`]: 1 }, upgrade, "Serenity Shard", "Free Development", "Obtain 5 material types", 1, 5);
  }
  recipe("Garnet Ring", "C", { "Mythril Stone": 3, "Power Stone": 1, "Power Shard": 1, "Dark Shard": 1 }, "Diamond Ring", "Serenity Shard", "Free Development", "Obtain 5 material types", 1, 5);
  recipe("Mythril Ring", "C", { "Mythril Stone": 3, "Power Stone": 1, "Dark Stone": 1, "Dark Shard": 1 }, "Orichalcum Ring", "Serenity Shard", "Free Development", "Obtain 5 material types", 1, 5);
  recipe("Power Band", "B", { "Mythril Stone": 5, "Power Stone": 1, "Dark Stone": 1, "Lucid Stone": 1 }, "Buster Band", "Serenity Stone", "Free Development", "Obtain 20 material types", 1, 20);
  recipe("Acrisius", "B", { "Mythril Stone": 5, "Blazing Stone": 1, "Frost Stone": 1, "Lightning Stone": 1 }, "Acrisius+", "Serenity Stone", "Free Development", "Obtain 20 material types", 1, 20);
  recipe("Soldier Earring", "B", { "Mythril Gem": 3, "Dark Gem": 1, "Frost Gem": 1, "Lucid Gem": 1 }, "Fencer Earring", "Serenity Stone", "Free Development", "Obtain 20 material types", 1, 20);
  recipe("Mage Earring", "B", { "Mythril Gem": 3, "Power Gem": 1, "Blazing Gem": 1, "Lightning Gem": 1 }, "Slayer Earring", "Serenity Stone", "Free Development", "Obtain 20 material types", 1, 20);
  recipe("Expert's Ring", "A", { "Mythril Crystal": 3, "Dark Crystal": 1, "Dark Gem": 1, "Dark Stone": 1, "Dark Shard": 1 }, "Master's Ring", "Serenity Gem", "Free Development", "Obtain 20 material types", 1, 20);
  recipe("Mythril Shard", "C", { "Dense Stone": 1, "Dense Shard": 3, "Twilight Stone": 1, "Twilight Shard": 3 }, "Mythril Stone", "Serenity Shard", "Materials", "Obtain 20 material types", 1, 20);
  recipe("Mythril Gem", "B", { "Dense Crystal": 1, "Dense Gem": 3, "Twilight Crystal": 1, "Twilight Gem": 3 }, "Mythril Crystal", "Serenity Stone", "Materials", "Moogle level 8", 8);
  recipe("Serenity Crystal", "A", { "Tranquility Crystal": 1, "Remembrance Crystal": 1, "Bright Crystal": 9 }, "Manifest Illusion", "Serenity Gem", "Materials", "Moogle level 8", 8);
  recipe("Shock Charm", "S", { "Lost Illusion": 1, "Remembrance Gem": 1, "Remembrance Stone": 3, "Tranquility Gem": 1, "Tranquility Stone": 3 }, "Shock Charm+", "Serenity Crystal", "Recipes", "Cloaked Thunder · defeat Larxene's Absent Silhouette");
  recipe("Shadow Archive", "S", { "Lost Illusion": 1, "Manifest Illusion": 1, "Remembrance Crystal": 1, "Serenity Gem": 3 }, "Shadow Archive+", "Serenity Crystal", "Recipes", "Book of Shadows · defeat Zexion's Absent Silhouette");
  recipe("Full Bloom", "S", { "Lost Illusion": 1, "Manifest Illusion": 1, "Tranquility Crystal": 1, "Serenity Gem": 3 }, "Full Bloom+", "Serenity Crystal", "Recipes", "Eternal Blossom · defeat Marluxia's Absent Silhouette");
  recipe("Draw Ring", "S", { "Manifest Illusion": 1, "Remembrance Shard": 3, "Bright Gem": 3, "Bright Stone": 5, "Bright Shard": 9 }, "Lucky Ring", "Serenity Crystal", "Recipes", "Rare Document · complete the Duality puzzle");
  recipe("Frozen Pride", "S", { "Lost Illusion": 1, "Tranquility Crystal": 1, "Tranquility Gem": 3, "Tranquility Stone": 5, "Tranquility Shard": 7 }, "Frozen Pride+", "Serenity Crystal", "Recipes", "Road to Discovery · defeat Vexen's Absent Silhouette");
  recipe("Centurion", "S", { "Lost Illusion": 1, "Remembrance Crystal": 1, "Remembrance Gem": 3, "Remembrance Stone": 5, "Remembrance Shard": 7 }, "Centurion+", "Serenity Crystal", "Recipes", "Strength Beyond Strength · defeat Lexaeus's Absent Silhouette");
  const byRecipe = Object.fromEntries(recipes.map((r) => [r.name, r]));
  const levels = ["Amateur", "Novice", "Junior", "Skilled", "Senior", "Artisan", "Master", "Superior", "Primo"];
  return { wiki, worlds, optional, materials, materialNames, recipes, byRecipe, levels, tiers, rewards };
})();

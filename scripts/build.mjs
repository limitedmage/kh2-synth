import { readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
let html = await read("src/page.html");
html = html.replace("/* STYLES */", await read("src/style.css"));
const scripts = await Promise.all(["data", "planner", "recognition", "icons", "app"].map((name) => read(`src/${name}.js`)));
html = html.replace("/* SCRIPTS */", scripts.join("\n\n").replace(/<\/script/gi, "<\\/script"));
await writeFile(new URL("index.html", root), html);
console.log("Built index.html (standalone, no server required).");

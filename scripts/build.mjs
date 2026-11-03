import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
let html = await read("src/page.html");
html = html.replace("/* STYLES */", await read("src/style.css"));
const { outputFiles } = await build({
  entryPoints: [fileURLToPath(new URL("src/app.js", root))],
  bundle: true,
  write: false,
  format: "iife",
  target: "es2023",
});
html = html.replace("/* SCRIPTS */", () => outputFiles[0].text.replace(/<\/script/gi, "<\\/script"));
await writeFile(new URL("index.html", root), html);
console.log("Built index.html (standalone, no server required).");

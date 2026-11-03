import planner from "./planner.js";
import { byId } from "./dom.js";

const maxSaveBytes = 1000000;

export async function encodeSaveURL(state, href) {
  const json = new TextEncoder().encode(JSON.stringify(planner.sanitize(state)));
  if (json.byteLength > maxSaveBytes) throw new Error("Save is too large (maximum 1 MB).");
  const stream = new Blob([json]).stream().pipeThrough(new CompressionStream("gzip"));
  const bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  const payload = btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
  const url = new URL(href);
  url.hash = `save=${payload}`;
  return url.href;
}

export async function decodeSaveURL(payload) {
  if (!payload || payload.length > maxSaveBytes * 2 || !/^[A-Za-z0-9_-]+$/.test(payload)) {
    throw new Error("Invalid save URL.");
  }
  const bytes = Uint8Array.from(atob(payload.replaceAll("-", "+").replaceAll("_", "/")), (character) => character.charCodeAt(0));
  let size = 0;
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip")).pipeThrough(new TransformStream({
    transform(chunk, controller) {
      size += chunk.byteLength;
      if (size > maxSaveBytes) throw new Error("Save is too large (maximum 1 MB).");
      controller.enqueue(chunk);
    },
  }));
  return planner.sanitize(JSON.parse(await new Response(stream).text()));
}

export function mountSaveTools(store, notice) {
  const menu = byId("save-export");
  const link = byId("save-url");
  const copyLink = byId("copy-save-url");
  const copyStatus = byId("save-copy-status");
  let generation = 0;
  menu.addEventListener("beforetoggle", async (event) => {
    const request = ++generation;
    if (event.newState !== "open") return;
    copyLink.disabled = true;
    link.value = "";
    copyStatus.textContent = "";
    try {
      const url = await encodeSaveURL(store.getState(), location.href);
      if (request !== generation) return;
      link.value = url;
      copyLink.disabled = false;
    } catch (error) {
      if (request === generation) copyStatus.textContent = `Could not create save URL: ${error.message}`;
    }
  });
  byId("export-file").addEventListener("click", () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(store.getState(), null, 2)], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url; anchor.download = "kh2-synthesis-save.json"; anchor.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    menu.hidePopover();
  });
  copyLink.addEventListener("click", async () => {
    copyStatus.textContent = "";
    try {
      await navigator.clipboard.writeText(link.value);
      copyStatus.textContent = "Save URL copied.";
    } catch {
      link.focus();
      link.select();
      copyStatus.textContent = "Copy the selected URL to share this save.";
    }
  });
  byId("load-save").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    try {
      if (file.size > maxSaveBytes) throw new Error("Save file is too large (maximum 1 MB).");
      const state = planner.sanitize(JSON.parse(await file.text()));
      if (!confirm("Replace this journal's current wish list, inventory and progress with the selected save? Each wishlist recipe will be included once.")) return;
      store.dispatch({ type: "replace-save", value: state });
      notice("Save loaded.");
    } catch (error) {
      notice(`Could not load save: ${error.message}`);
    } finally {
      event.target.value = "";
    }
  });
  async function importURL() {
    if (!location.hash.startsWith("#save=")) return;
    const payload = location.hash.slice("#save=".length);
    history.replaceState(null, "", "#plan");
    try {
      const state = await decodeSaveURL(payload);
      if (store.hasSave() && !confirm("A save already exists on this device. Replace its wishlist, inventory, progress and settings with this magic URL's save?")) {
        notice("Save URL import cancelled. Existing save kept.");
        return;
      }
      store.dispatch({ type: "replace-save", value: state });
      notice("Save imported from URL.");
    } catch (error) {
      notice(`Could not load save URL: ${error.message}`);
    }
  }
  window.addEventListener("hashchange", importURL);
  importURL();
}

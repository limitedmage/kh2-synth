import recognition from "../recognition.js";
import { createAlignment } from "./alignment.js";
import { createReview } from "./review.js";
import { createScanner } from "./scanner.js";

function loadVideo(video, url) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => finish(new Error("Video could not be opened. Try an H.264 MP4 export.")), 15000);
    function finish(error) {
      clearTimeout(timer);
      video.removeEventListener("loadeddata", ready);
      video.removeEventListener("error", fail);
      if (error) reject(error); else resolve();
    }
    const ready = () => finish();
    const fail = () => finish(new Error("Video codec not supported by this browser. Export to H.264 MP4, or use screenshots."));
    video.addEventListener("loadeddata", ready, { once: true });
    video.addEventListener("error", fail, { once: true });
    video.src = url;
    video.load();
  });
}

export function mountImport(root, { store, notice }) {
  const $ = (id) => root.querySelector(`#${id}`);
  const video = $("video");
  const getKind = () => $("import-kind").value;
  let media;
  let mediaURL;
  let ready = false;
  let busy = false;
  const alignment = createAlignment(root, { getMedia: () => ready ? media : null, getKind, isBusy: () => busy });
  const review = createReview($("import-review"), { store, notice });
  const scanner = createScanner();

  function syncMode() {
    const recipes = getKind() === "recipes";
    for (const id of ["two-columns", "column-split", "sampling"]) $(id).closest("label").hidden = recipes;
    $("inventory-video-help").hidden = recipes;
    $("import-instructions").textContent = recipes
      ? "Scan the left-hand names in Recipes and Free Development. Both lists combine here; ingredients and stock are ignored."
      : "Scan the Materials table. Check the corners and column divider before reading.";
    $("paste-help").textContent = recipes ? "One recipe name per line, from either recipe list" : "One material and current count per line";
    $("ocr-text").placeholder = recipes ? "AP Boost\nPetite Ribbon\nMythril Shard\nAcrisius" : "Dense Shard 4\nEnergy Crystal 3";
    $("import-policy").textContent = recipes
      ? "Adds recipes to the wishlist. Inventory stays unchanged."
      : "Replaces inventory. Omitted or unchecked materials become zero.";
  }

  function setBusy(value) {
    busy = value;
    for (const id of ["media-file", "import-kind", "two-columns", "column-split", "sampling", "parse-text", "crop-reset", "align-screen"]) $(id).disabled = busy;
    $("recognize").disabled = busy || !ready;
    $("cancel-ocr").hidden = !busy;
    $("ocr-progress").hidden = !busy;
  }

  $("import-kind").addEventListener("change", () => {
    syncMode();
    alignment.reset();
    review.setKind(getKind());
    $("ocr-status").textContent = "Choose a photo or video, or paste a list.";
  });
  $("media-file").addEventListener("change", async (event) => {
    const file = event.target.files[0];
    if (!file) return;
    ready = false;
    $("recognize").disabled = true;
    review.setKind(getKind());
    if (mediaURL) URL.revokeObjectURL(mediaURL);
    video.pause(); video.removeAttribute("src"); video.load();
    mediaURL = URL.createObjectURL(file);
    $("media-name").textContent = file.name;
    $("ocr-status").textContent = "Opening media…";
    try {
      const videoFile = file.type.startsWith("video/") || /\.(mov|mp4|webm|m4v)$/i.test(file.name);
      if (videoFile) {
        $("import-kind").value = "inventory";
        syncMode();
        review.setKind("inventory");
        media = video;
        await loadVideo(video, mediaURL);
        if (!Number.isFinite(video.duration) || !video.duration) throw new Error("Video duration could not be read. Export to H.264 MP4.");
        await recognition.seek(video, Math.min(0.1, video.duration / 2));
      } else {
        media = new Image();
        media.src = mediaURL;
        await media.decode();
      }
      ready = true;
      $("media-preview").hidden = false;
      $("recognize").disabled = false;
      alignment.reset();
      $("ocr-status").textContent = "Check the selected table corners, then read. All results remain editable.";
    } catch (error) {
      $("media-preview").hidden = true;
      $("ocr-status").textContent = error.message;
    }
  });
  $("parse-text").addEventListener("click", () => {
    const kind = getKind();
    const parsed = recognition.parseLines($("ocr-text").value.split(/\r?\n/), kind);
    review.accept(kind, recognition.merge(parsed.rows), parsed.unmatched.length);
  });
  $("cancel-ocr").addEventListener("click", () => {
    scanner.cancel();
    $("ocr-status").textContent = "Cancelling; partial readings will be available for review.";
  });
  $("recognize").addEventListener("click", async () => {
    if (!ready || busy) return;
    const kind = getKind();
    setBusy(true);
    review.hide();
    $("ocr-progress").value = 0;
    try {
      const result = await scanner.read({
        media, kind, video: media === video, interval: Number($("sampling").value),
        columns: kind === "inventory" && $("two-columns").checked ? 2 : 1,
        ...alignment.snapshot(), split: Number($("column-split").value) || 52,
        onStatus: (message) => { $("ocr-status").textContent = message; },
        onProgress: (progress) => { $("ocr-progress").value = progress; },
        onFrame: alignment.draw,
      });
      $("ocr-status").textContent = result.cancelled ? "Cancelled. Partial results are available below."
        : result.error ? `Recognition stopped: ${result.error.message}. Manual entry and pasted text remain available.`
        : kind === "recipes" ? "Reading complete. Recipe names combined below. Scan the other recipe list or apply checked names."
        : "Reading complete. Review recognized names and counts below.";
      $("ocr-text").value = result.raw;
      review.accept(kind, result.rows, result.unmatched);
    } catch (error) {
      $("ocr-status").textContent = `Recognition stopped: ${error.message}. Manual entry and pasted text remain available.`;
    } finally {
      setBusy(false);
    }
  });
  syncMode();
}

globalThis.KH2Recognition = (() => {
  const D = globalThis.KH2Data;
  const normalize = (text) => text.toLowerCase().replace(/[’‘]/g, "'").replace(/[^a-z0-9+]/g, "");
  const aliases = { "Petite Ribbon": ["Petit Ribbon"], "Ultima Weapon": ["Ultima Keyblade"], "Orichalcum+": ["Orichalcum Plus"] };
  function distance(a, b) {
    let row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const next = [i];
      for (let j = 1; j <= b.length; j++) next[j] = Math.min(next[j - 1] + 1, row[j] + 1, row[j - 1] + (a[i - 1] !== b[j - 1]));
      row = next;
    }
    return row[b.length];
  }
  function matchName(text, names) {
    const words = text.replace(/^[SCBA]\s+/i, "").trim().split(/\s+/);
    const whole = normalize(words.join(" "));
    const exact = names.find((name) => [name, ...(aliases[name] || [])].some((alias) => normalize(alias) === whole));
    if (exact) return { name: exact, score: 1 };
    const candidates = names.map((name) => {
      let score = 0;
      for (const alias of [name, ...(aliases[name] || [])]) {
        const target = normalize(alias);
        const expected = alias.split(/\s+/).length;
        for (let start = 0; start < words.length; start++) {
          for (let length = Math.max(1, expected - 1); length <= expected + 1; length++) {
            const fragment = normalize(words.slice(start, start + length).join(" "));
            if (!fragment || fragment.includes("+") !== target.includes("+") || (whole.includes("+") && !target.includes("+"))) continue;
            const value = 1 - distance(fragment, target) / Math.max(fragment.length, target.length);
            score = Math.max(score, value);
          }
        }
      }
      return { name, score };
    }).sort((a, b) => b.score - a.score);
    const best = candidates[0];
    if (!best || best.score < 0.74 || (candidates[1] && best.score - candidates[1].score < 0.035)) return null;
    return best;
  }
  function parseLines(lines, kind, source = "Pasted text") {
    const names = kind === "recipes" ? D.recipes.map((r) => r.name) : D.materialNames;
    const rows = [];
    const unmatched = [];
    for (const input of lines) {
      const text = typeof input === "string" ? input : input.text;
      if (!text?.trim()) continue;
      let nameText = text.trim();
      let quantity = kind === "recipes" ? 1 : null;
      if (kind === "inventory") {
        const number = nameText.match(/\s+(?:[x×]\s*)?([0-9OIl|SB]{1,4})\s*$/);
        if (number) {
          quantity = Number(number[1].replace(/[O]/g, "0").replace(/[Il|]/g, "1").replace(/S/g, "5").replace(/B/g, "8"));
          nameText = nameText.slice(0, number.index);
        }
      }
      const match = matchName(nameText, names);
      if (!match) { unmatched.push(text); continue; }
      const confidence = typeof input === "string" ? 100 : Number(input.confidence) || 0;
      rows.push({ name: match.name, quantity, confidence, score: match.score, raw: text, source });
    }
    return { rows, unmatched };
  }
  function merge(observations) {
    const groups = new Map();
    for (const row of observations) {
      if (!groups.has(row.name)) groups.set(row.name, []);
      groups.get(row.name).push(row);
    }
    return [...groups].map(([name, readings]) => {
      const valid = readings.filter((r) => r.quantity !== null);
      const votes = new Map();
      for (const row of valid) votes.set(row.quantity, (votes.get(row.quantity) || 0) + 1);
      const ranked = [...votes].sort((a, b) => b[1] - a[1]);
      const best = readings.toSorted((a, b) => b.confidence * b.score - a.confidence * a.score)[0];
      const quantity = ranked.length ? ranked[0][0] : null;
      const conflict = ranked.length > 1;
      return { name, quantity, conflict, checked: quantity !== null && !conflict && best.confidence >= 55 && best.score >= 0.82,
        readings: readings.length, alternatives: ranked.map(([value]) => value), confidence: Math.round(best.confidence), raw: best.raw };
    });
  }
  let loading;
  function loadEngine() {
    if (globalThis.Tesseract) return Promise.resolve(globalThis.Tesseract);
    if (!loading) loading = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
      script.crossOrigin = "anonymous";
      script.onload = () => resolve(globalThis.Tesseract);
      script.onerror = () => { script.remove(); loading = null; reject(new Error("Recognition engine could not download. Check the connection, or use manual entry / pasted text.")); };
      document.head.append(script);
    });
    return loading;
  }
  function cropCanvas(media, crop, column = 0, columns = 1) {
    const width = media.videoWidth || media.naturalWidth || media.width;
    const height = media.videoHeight || media.naturalHeight || media.height;
    const x = width * crop.x / 100;
    const y = height * crop.y / 100;
    const w = Math.min(width - x, width * crop.w / 100);
    const h = Math.min(height - y, height * crop.h / 100);
    const canvas = document.createElement("canvas");
    const part = w / columns;
    const scale = Math.min(3, 1500 / part);
    canvas.width = Math.round(part * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(media, x + column * part, y, part, h, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < image.data.length; i += 4) {
      const luminance = image.data[i] * 0.2 + image.data[i + 1] * 0.65 + image.data[i + 2] * 0.15;
      const value = 255 - Math.max(0, Math.min(255, (luminance - 30) * 1.5));
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }
  function seek(video, time, signal) {
    return new Promise((resolve, reject) => {
      if (signal?.aborted) return reject(new DOMException("Cancelled", "AbortError"));
      if (Math.abs(video.currentTime - time) < 0.01 && video.readyState >= 2) return resolve();
      let timer;
      const cleanup = () => {
        clearTimeout(timer);
        video.removeEventListener("seeked", done);
        video.removeEventListener("error", fail);
        signal?.removeEventListener("abort", cancel);
      };
      const done = () => { cleanup(); resolve(); };
      const fail = () => { cleanup(); reject(new Error("This video cannot be decoded. Export it as H.264 MP4, or import inventory screenshots.")); };
      const cancel = () => { cleanup(); reject(new DOMException("Cancelled", "AbortError")); };
      video.addEventListener("seeked", done, { once: true });
      video.addEventListener("error", fail, { once: true });
      signal?.addEventListener("abort", cancel, { once: true });
      timer = setTimeout(fail, 15000);
      video.currentTime = time;
    });
  }
  return { normalize, matchName, parseLines, merge, loadEngine, cropCanvas, seek };
})();

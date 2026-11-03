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
      if (kind === "recipes" && /\s+\d+(?:\s+\d+)*\s*$/.test(nameText)) {
        unmatched.push(text);
        continue;
      }
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
  function merge(observations, minimumReadings = 1) {
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
      return { name, quantity, conflict, checked: quantity !== null && !conflict && valid.length >= minimumReadings && best.confidence >= 65 && best.score >= 0.82,
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
  function cropCanvas(media, crop, column = 0, columns = 1, split = 50, preprocess = true) {
    const width = media.videoWidth || media.naturalWidth || media.width;
    const height = media.videoHeight || media.naturalHeight || media.height;
    const x = width * crop.x / 100;
    const y = height * crop.y / 100;
    const w = Math.min(width - x, width * crop.w / 100);
    const h = Math.min(height - y, height * crop.h / 100);
    const canvas = document.createElement("canvas");
    const fraction = Math.max(0.35, Math.min(0.65, split / 100));
    const part = columns === 1 ? w : w * (column === 0 ? fraction : 1 - fraction);
    const offset = columns === 1 || column === 0 ? 0 : w * fraction;
    const scale = Math.min(3, 1500 / part);
    canvas.width = Math.round(part * scale);
    canvas.height = Math.round(h * scale);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(media, x + offset, y, part, h, 0, 0, canvas.width, canvas.height);
    if (!preprocess) return canvas;
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < image.data.length; i += 4) {
      // Blue menu backgrounds and dim blue text separate best in the green channel.
      const value = 255 - Math.max(0, Math.min(255, (image.data[i + 1] - 12) * 3));
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }
  function quantityCanvas(column, bounds) {
    const canvas = document.createElement("canvas");
    const top = Math.max(0, bounds.y0 - 4);
    const height = Math.min(column.height - top, bounds.y1 - bounds.y0 + 8);
    const left = column.width * 0.79;
    const width = column.width * 0.185;
    canvas.width = Math.ceil(width) + 32;
    canvas.height = Math.ceil(height) + 32;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(column, left, top, width, height, 16, 16, width, height);
    const image = ctx.getImageData(16, 16, Math.ceil(width), Math.ceil(height));
    let end = image.width;
    let badgeRun = 0;
    // Counts sit on blue rows; stop at a neighboring grade badge's non-blue background.
    for (let x = 0; x < image.width; x++) {
      let blue = 0;
      for (let y = 0; y < image.height; y++) {
        const i = (y * image.width + x) * 4;
        if (image.data[i + 2] > image.data[i] * 1.35 && image.data[i + 2] > image.data[i + 1] * 1.5) blue++;
      }
      badgeRun = blue / image.height < 0.04 ? badgeRun + 1 : 0;
      if (badgeRun >= Math.max(3, Math.round(height * 0.06))) { end = x - badgeRun + 1; break; }
    }
    for (let i = 0; i < image.data.length; i += 4) {
      const value = (i / 4) % image.width < end && Math.min(image.data[i], image.data[i + 1], image.data[i + 2]) > 150 ? 0 : 255;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    }
    ctx.putImageData(image, 16, 16);
    return canvas;
  }
  function rectifyCanvas(media, corners) {
    const width = media.videoWidth || media.naturalWidth || media.width;
    const height = media.videoHeight || media.naturalHeight || media.height;
    const points = corners.map((p) => ({ x: p.x / 100 * width, y: p.y / 100 * height }));
    const [p0, p1, p2, p3] = points;
    const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round((length(p0, p1) + length(p3, p2)) / 2));
    output.height = Math.max(1, Math.round((length(p0, p3) + length(p1, p2)) / 2));
    const input = document.createElement("canvas");
    input.width = width; input.height = height;
    const sourceContext = input.getContext("2d", { willReadFrequently: true });
    sourceContext.drawImage(media, 0, 0, width, height);
    const source = sourceContext.getImageData(0, 0, width, height).data;
    const ctx = output.getContext("2d");
    const target = ctx.createImageData(output.width, output.height);
    const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
    const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
    const determinant = dx1 * dy2 - dx2 * dy1;
    if (Math.abs(determinant) < 0.001) throw new Error("Alignment corners are too close or crossed. Select four corners clockwise around the table.");
    const g = (dx3 * dy2 - dx2 * dy3) / determinant;
    const h = (dx1 * dy3 - dx3 * dy1) / determinant;
    const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + h * p3.x;
    const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + h * p3.y;
    // Inverse mapping samples the camera image through a square-to-quadrilateral homography.
    for (let y = 0; y < output.height; y++) for (let x = 0; x < output.width; x++) {
      const u = x / output.width, v = y / output.height, denominator = g * u + h * v + 1;
      const sx = Math.max(0, Math.min(width - 1.001, (a * u + b * v + p0.x) / denominator));
      const sy = Math.max(0, Math.min(height - 1.001, (d * u + e * v + p0.y) / denominator));
      const ix = Math.floor(sx), iy = Math.floor(sy), fx = sx - ix, fy = sy - iy;
      const offset = (iy * width + ix) * 4, out = (y * output.width + x) * 4;
      for (let channel = 0; channel < 3; channel++) {
        target.data[out + channel] = source[offset + channel] * (1 - fx) * (1 - fy) +
          source[offset + 4 + channel] * fx * (1 - fy) +
          source[offset + width * 4 + channel] * (1 - fx) * fy +
          source[offset + width * 4 + 4 + channel] * fx * fy;
      }
      target.data[out + 3] = 255;
    }
    ctx.putImageData(target, 0, 0);
    return output;
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
  return { normalize, matchName, parseLines, merge, loadEngine, quantityCanvas, cropCanvas, rectifyCanvas, seek };
})();

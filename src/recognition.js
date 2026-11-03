import D from "./data.js";

const recognition = (() => {
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
      const byConfidence = readings.toSorted((a, b) => b.confidence * b.score - a.confidence * a.score);
      const best = byConfidence[0];
      const quantity = ranked.length ? ranked[0][0] : null;
      const conflict = ranked.length > 1;
      const source = byConfidence.find((r) => r.quantity === quantity && r.image);
      return { name, quantity, conflict, checked: quantity !== null && !conflict && valid.length >= minimumReadings && best.confidence >= 65 && best.score >= 0.82,
        readings: readings.length, alternatives: ranked.map(([value]) => value), confidence: Math.round(best.confidence), raw: best.raw, image: source?.image, source: source?.source };
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
  function sourceCanvas(column, bounds) {
    const top = Math.max(0, bounds.y0 - 8);
    const height = Math.max(1, Math.min(column.height - top, bounds.y1 - bounds.y0 + 16));
    const canvas = document.createElement("canvas");
    canvas.width = Math.min(900, column.width);
    canvas.height = Math.max(1, Math.round(height * canvas.width / column.width));
    canvas.getContext("2d").drawImage(column, 0, top, column.width, height, 0, 0, canvas.width, canvas.height);
    return canvas;
  }
  function inventoryCanvas(column) {
    const canvas = document.createElement("canvas");
    const left = Math.round(column.width * 0.16);
    canvas.width = Math.round(column.width * 0.65); canvas.height = column.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(column, left, 0, canvas.width, canvas.height, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = Math.min(image.data[i], image.data[i + 1], image.data[i + 2]) > 120 ? 0 : 255;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    }
    ctx.putImageData(image, 0, 0);
    return canvas;
  }
  function detectCorners(media, kind, region = null) {
    const canvas = document.createElement("canvas");
    const width = media.videoWidth || media.naturalWidth || media.width;
    const height = media.videoHeight || media.naturalHeight || media.height;
    canvas.width = Math.min(640, width); canvas.height = Math.round(canvas.width * height / width);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    ctx.drawImage(media, 0, 0, canvas.width, canvas.height);
    const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const w = canvas.width, h = canvas.height;
    let best = null;
    const badges = [];
    const cross = (a, b, c) => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
    for (const theme of kind === "recipes" ? ["blue"] : ["badges"]) {
      const mask = new Uint8Array(w * h);
      for (let i = 0; i < mask.length; i++) {
        const x = i % w, y = Math.floor(i / w);
        if (region && (y < region.top || y > region.bottom || x < region.left(y) || x >= region.right(y))) continue;
        const r = pixels[i * 4], g = pixels[i * 4 + 1], b = pixels[i * 4 + 2];
        mask[i] = theme === "blue"
          ? b > 25 && b > r * 1.35 && b > g * 1.25
          : (g > 120 && g > r * 1.35 && g > b * 0.85) ||
            (r > 150 && r > g * 1.3 && b > g * 1.2) ||
            (r > 120 && g > 120 && b < Math.min(r, g) * 0.85);
      }
      for (let start = 0; start < mask.length; start++) {
        if (!mask[start]) continue;
        const component = [start];
        mask[start] = 0;
        let x0 = w, y0 = h, x1 = 0, y1 = 0;
        const left = new Int32Array(h).fill(w), right = new Int32Array(h).fill(-1);
        for (let i = 0; i < component.length; i++) {
          const x = component[i] % w, y = Math.floor(component[i] / w);
          x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y);
          left[y] = Math.min(left[y], x); right[y] = Math.max(right[y], x);
          for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            if (nx < 0 || nx >= w || ny < 0 || ny >= h || !mask[ny * w + nx]) continue;
            mask[ny * w + nx] = 0; component.push(ny * w + nx);
          }
        }
        const cw = x1 - x0, ch = y1 - y0;
        if (theme === "badges") {
          if (cw > w * 0.015 && cw < w * 0.12 && ch > h * 0.012 && ch < h * 0.08 && cw / ch > 1.4 && cw / ch < 4.5 && component.length > cw * ch * 0.35) {
            badges.push({ x: x0, y: (y0 + y1) / 2, width: cw, height: ch });
          }
          continue;
        }
        if (component.length < w * h * 0.035 || cw < w * 0.12 || ch < h * 0.2 || cw > w * 0.9 || ch > h * 0.9 || cw / ch > 3 || component.length < cw * ch * 0.4) continue;
        const points = [];
        for (let y = y0; y <= y1; y++) if (right[y] >= 0) points.push({ x: left[y], y }, { x: right[y], y });
        points.sort((a, b) => a.x - b.x || a.y - b.y);
        const half = (input) => {
          const result = [];
          for (const point of input) {
            while (result.length > 1 && cross(result.at(-2), result.at(-1), point) <= 0) result.pop();
            result.push(point);
          }
          return result.slice(0, -1);
        };
        const hull = [...half(points), ...half(points.toReversed())];
        while (hull.length > 4) {
          let index = 0, smallest = Infinity;
          for (let i = 0; i < hull.length; i++) {
            const area = Math.abs(cross(hull[(i + hull.length - 1) % hull.length], hull[i], hull[(i + 1) % hull.length]));
            if (area < smallest) { smallest = area; index = i; }
          }
          hull.splice(index, 1);
        }
        if (hull.length !== 4) continue;
        const area = Math.abs(hull.reduce((sum, p, i) => sum + p.x * hull[(i + 1) % 4].y - p.y * hull[(i + 1) % 4].x, 0)) / 2;
        if (area < cw * ch * 0.7 || (best && component.length <= best.score)) continue;
        const first = hull.reduce((index, p, i) => p.x + p.y < hull[index].x + hull[index].y ? i : index, 0);
        best = { score: component.length, corners: [...hull.slice(first), ...hull.slice(0, first)] };
      }
    }
    if (kind === "inventory") {
      const median = (values) => values.toSorted((a, b) => a - b)[Math.floor(values.length / 2)];
      const groups = [];
      for (const badge of badges.toSorted((a, b) => a.x - b.x)) {
        const group = groups.at(-1);
        if (group && badge.x - group.reduce((sum, p) => sum + p.x / group.length, 0) < w * 0.05) group.push(badge);
        else groups.push([badge]);
      }
      const columns = groups.map((group) => {
        const height = median(group.map((p) => p.height)), width = median(group.map((p) => p.width));
        return group.filter((p) => p.height > height * 0.7 && p.height < height * 1.4 && p.width > width * 0.7 && p.width < width * 1.4);
      }).filter((group) => group.length >= 4)
        .sort((a, b) => b.length - a.length).slice(0, 2).sort((a, b) => a[0].x - b[0].x);
      if (columns.length !== 2 || columns[1][0].x - columns[0][0].x < w * 0.1) return null;
      const fit = (group, y) => {
        const cy = group.reduce((sum, p) => sum + p.y / group.length, 0);
        const cx = group.reduce((sum, p) => sum + p.x / group.length, 0);
        const slope = group.reduce((sum, p) => sum + (p.y - cy) * (p.x - cx), 0) / group.reduce((sum, p) => sum + (p.y - cy) ** 2, 0);
        return cx + slope * (y - cy);
      };
      const rows = columns.map((group) => {
        group.sort((a, b) => a.y - b.y);
        const height = median(group.map((p) => p.height));
        const gaps = group.slice(1).map((p, i) => p.y - group[i].y).filter((gap) => gap > height * 0.6);
        const step = median(gaps.map((gap) => gap / Math.max(1, Math.round(gap / (height * 1.12)))));
        return { height, step, first: group[0].y, last: group.at(-1).y };
      });
      if (rows.some((row) => !row.step || row.last - row.first < h * 0.2)) return null;
      const top = Math.min(...rows.map((row) => row.first));
      for (const row of rows) row.first -= Math.round((row.first - top) / row.step) * row.step;
      const last = Math.max(...rows.map((row) => Math.round((row.last - row.first) / row.step)));
      const ends = rows.map((row) => ({ top: row.first - row.height * 0.65, bottom: row.first + last * row.step + row.height * 0.65 }));
      const edge = (key) => {
        const y = ends[0][key], my = ends[1][key];
        const x = fit(columns[0], y), mx = fit(columns[1], my);
        return [{ x: x - (mx - x) * 0.01, y }, { x: mx + (mx - x) * 1.01, y: my * 2 - y }];
      };
      const [tl, tr] = edge("top"), [bl, br] = edge("bottom");
      const first = Math.min(...columns.map((group) => group[0].y));
      const bottom = Math.max(...columns.map((group) => group.at(-1).y));
      const line = (y, fraction) => {
        const left = fit(columns[0], y), middle = fit(columns[1], y);
        return left + (middle - left) * fraction;
      };
      let boundary = 2;
      for (let fraction = 1.75; fraction < 2.2; fraction += 0.005) {
        let bright = 0;
        for (let sample = 0; sample < 40; sample++) {
          const y = Math.round(first + (bottom - first) * (0.15 + sample / 40 * 0.7));
          const x = Math.round(line(y, fraction));
          if (x < 0 || x >= w) continue;
          const i = (y * w + x) * 4;
          const r = pixels[i], g = pixels[i + 1], b = pixels[i + 2];
          if ((g > 95 && b > g * 1.2 && r < g * 0.85) || (g > 65 && Math.max(r, g, b) - Math.min(r, g, b) < 25)) bright++;
        }
        if (bright / 40 > 0.65) { boundary = fraction; break; }
      }
      const refined = detectCorners(media, "recipes", {
        top: first - rows[0].height,
        bottom: bottom + rows[0].height * 1.8,
        left: (y) => fit(columns[0], y) - median(columns[0].map((p) => p.width)) * 0.4,
        right: (y) => line(y, boundary) - 1,
      });
      const selected = refined || [tl, tr, br, bl].map((p) => ({ x: Math.max(0, Math.min(100, p.x / w * 100)), y: Math.max(0, Math.min(100, p.y / h * 100)) }));
      // Locate the second badge column after rectification; equal screen widths can clip counts.
      const [p0, p1, p2, p3] = selected.map((p) => ({ x: p.x / 100 * w, y: p.y / 100 * h }));
      const dx1 = p1.x - p2.x, dx2 = p3.x - p2.x, dx3 = p0.x - p1.x + p2.x - p3.x;
      const dy1 = p1.y - p2.y, dy2 = p3.y - p2.y, dy3 = p0.y - p1.y + p2.y - p3.y;
      const denominator = dx1 * dy2 - dx2 * dy1;
      if (Math.abs(denominator) < 0.001) return null;
      const g = (dx3 * dy2 - dx2 * dy3) / denominator, j = (dx1 * dy3 - dx3 * dy1) / denominator;
      const a = p1.x - p0.x + g * p1.x, b = p3.x - p0.x + j * p3.x;
      const d = p1.y - p0.y + g * p1.y, e = p3.y - p0.y + j * p3.y;
      const dividers = columns[1].map(({ x, y }) => {
        x -= 1;
        const determinant = (a - x * g) * (e - y * j) - (b - x * j) * (d - y * g);
        return ((x - p0.x) * (e - y * j) - (b - x * j) * (y - p0.y)) / determinant;
      });
      selected.columnSplit = Math.max(35, Math.min(65, Math.round(median(dividers) * 1000) / 10));
      return selected;
    }
    if (!best) return null;
    const center = best.corners.reduce((sum, p) => ({ x: sum.x + p.x / 4, y: sum.y + p.y / 4 }), { x: 0, y: 0 });
    return best.corners.map((p) => ({
      x: Math.max(0, Math.min(100, (center.x + (p.x - center.x) * 1.025) / w * 100)),
      y: Math.max(0, Math.min(100, (center.y + (p.y - center.y) * 1.025) / h * 100)),
    }));
  }
  function quantityCanvas(column, bounds) {
    const canvas = document.createElement("canvas");
    const lineHeight = bounds.y1 - bounds.y0;
    const top = Math.max(0, bounds.y0 - Math.round(lineHeight * 0.75));
    const height = Math.min(column.height - top, bounds.y1 + Math.round(lineHeight * 0.35) - top);
    const left = Math.floor(column.width * 0.72);
    const width = column.width - left;
    canvas.width = Math.ceil(width) + 32;
    canvas.height = Math.ceil(height) + 32;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(column, left, top, width, height, 16, 16, width, height);
    const image = ctx.getImageData(16, 16, Math.ceil(width), Math.ceil(height));
    const original = new Uint8ClampedArray(image.data);
    const background = (i) => {
      const r = original[i], g = original[i + 1], b = original[i + 2];
      return Math.max(r, g, b) < 120 || (b > r * 1.35 && b > g * 1.5);
    };
    let end = image.width;
    let badgeRun = 0;
    // Both the blue camera view and dark screen-capture rows differ from bright grade badges.
    for (let x = 0; x < image.width; x++) {
      let blue = 0;
      for (let y = 0; y < image.height; y++) {
        const i = (y * image.width + x) * 4;
        if (background(i)) blue++;
      }
      badgeRun = blue / image.height < 0.04 ? badgeRun + 1 : 0;
      if (badgeRun >= Math.max(3, Math.round(height * 0.06))) { end = x - badgeRun + 1; break; }
    }
    if (badgeRun) end = Math.min(end, image.width - badgeRun);
    for (let i = 0; i < image.data.length; i += 4) {
      const value = (i / 4) % image.width < end && (image.data[i] + image.data[i + 1]) / 2 > 140 ? 0 : 255;
      image.data[i] = image.data[i + 1] = image.data[i + 2] = value;
    }
    // Discard badge slivers and partial neighboring digits before normalizing the count.
    const seen = new Uint8Array(image.width * image.height);
    const glyphs = [];
    for (let start = 0; start < seen.length; start++) {
      if (seen[start] || image.data[start * 4] !== 0) continue;
      const pixels = [start];
      seen[start] = 1;
      let x0 = image.width, x1 = 0, y0 = image.height, y1 = 0;
      for (let cursor = 0; cursor < pixels.length; cursor++) {
        const x = pixels[cursor] % image.width, y = Math.floor(pixels[cursor] / image.width);
        x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
        for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy, next = ny * image.width + nx;
          if (nx < 0 || nx >= image.width || ny < 0 || ny >= image.height || seen[next] || image.data[next * 4] !== 0) continue;
          seen[next] = 1; pixels.push(next);
        }
      }
      const h = y1 - y0, w = x1 - x0;
      const offset = Math.abs((y0 + y1) / 2 - (bounds.y0 - top + lineHeight / 2));
      let surrounding = 0, onRow = 0;
      const margin = Math.max(3, Math.round(h * 0.12));
      for (let y = y0; y < y1; y += Math.max(1, Math.floor(h / 20))) for (const x of [x0 - margin, x1 + margin]) {
        if (x < 0 || x >= image.width) continue;
        surrounding++; if (background((y * image.width + x) * 4)) onRow++;
      }
      if (h < lineHeight * 0.45 || w < h * 0.22 || w > h * 1.4 || offset > lineHeight * 0.8 || x1 >= end || y0 === 0 || y1 === image.height || (surrounding && onRow / surrounding < 0.5)) {
        for (const pixel of pixels) image.data[pixel * 4] = image.data[pixel * 4 + 1] = image.data[pixel * 4 + 2] = 255;
      } else glyphs.push({ x0, x1, y0, y1, pixels, offset });
    }
    const closest = Math.min(...glyphs.map((glyph) => glyph.offset));
    for (let i = glyphs.length - 1; i >= 0; i--) {
      if (glyphs[i].offset <= closest + lineHeight * 0.2) continue;
      for (const pixel of glyphs[i].pixels) image.data[pixel * 4] = image.data[pixel * 4 + 1] = image.data[pixel * 4 + 2] = 255;
      glyphs.splice(i, 1);
    }
    glyphs.sort((a, b) => a.x0 - b.x0);
    for (let i = glyphs.length - 1; i > 0; i--) {
      if (glyphs[i].x0 - glyphs[i - 1].x1 <= lineHeight * 0.65) continue;
      for (const glyph of glyphs.slice(0, i)) for (const pixel of glyph.pixels) image.data[pixel * 4] = image.data[pixel * 4 + 1] = image.data[pixel * 4 + 2] = 255;
      glyphs.splice(0, i);
      break;
    }
    ctx.putImageData(image, 16, 16);
    let x0 = image.width, x1 = 0, y0 = image.height, y1 = 0;
    for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) if (image.data[(y * image.width + x) * 4] === 0) {
      x0 = Math.min(x0, x); x1 = Math.max(x1, x + 1); y0 = Math.min(y0, y); y1 = Math.max(y1, y + 1);
    }
    if (y1 <= y0) return canvas;
    const normalized = document.createElement("canvas");
    const scale = 64 / (y1 - y0);
    normalized.width = Math.ceil((x1 - x0) * scale) + 32; normalized.height = 96;
    const target = normalized.getContext("2d");
    target.fillStyle = "#fff"; target.fillRect(0, 0, normalized.width, normalized.height);
    target.drawImage(canvas, x0 + 16, y0 + 16, x1 - x0, y1 - y0, 16, 16, (x1 - x0) * scale, 64);
    normalized.lowerCounters = glyphs.map((glyph) => {
      const width = glyph.x1 - glyph.x0, height = glyph.y1 - glyph.y0;
      const visited = new Uint8Array(width * height), holes = [];
      for (let start = 0; start < visited.length; start++) {
        const white = (p) => image.data[((glyph.y0 + Math.floor(p / width)) * image.width + glyph.x0 + p % width) * 4] !== 0;
        if (visited[start] || !white(start)) continue;
        const area = [start];
        visited[start] = 1;
        let edge = false, cy = 0;
        for (let i = 0; i < area.length; i++) {
          const x = area[i] % width, y = Math.floor(area[i] / width);
          cy += y;
          if (!x || !y || x === width - 1 || y === height - 1) edge = true;
          for (const [nx, ny] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
            const p = ny * width + nx;
            if (nx < 0 || nx >= width || ny < 0 || ny >= height || visited[p] || !white(p)) continue;
            visited[p] = 1; area.push(p);
          }
        }
        if (!edge && area.length > width * height * 0.015) holes.push(cy / area.length / height);
      }
      return holes.length === 1 && holes[0] > 0.6;
    });
    normalized.sourceBounds = { y0: top + y0, y1: top + y1 };
    return normalized;
  }
  function quantityText(canvas, text) {
    if (!/^\d{1,4}$/.test(text) || canvas.lowerCounters?.length !== text.length) return text;
    // The game's square 6 is often read as 5, but only 6 has an enclosed lower counter.
    return [...text].map((digit, i) => digit === "5" && canvas.lowerCounters[i] ? "6" : digit).join("");
  }
  function rectifyCanvas(media, corners, verticalPadding = 0) {
    const width = media.videoWidth || media.naturalWidth || media.width;
    const height = media.videoHeight || media.naturalHeight || media.height;
    const points = corners.map((p) => ({ x: p.x / 100 * width, y: p.y / 100 * height }));
    const [p0, p1, p2, p3] = points;
    const length = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const output = document.createElement("canvas");
    output.width = Math.max(1, Math.round((length(p0, p1) + length(p3, p2)) / 2));
    output.height = Math.max(1, Math.round((length(p0, p3) + length(p1, p2)) / 2 * (1 + verticalPadding * 2)));
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
      const u = x / output.width, v = y / output.height * (1 + verticalPadding * 2) - verticalPadding, denominator = g * u + h * v + 1;
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
  return { normalize, matchName, parseLines, merge, loadEngine, sourceCanvas, inventoryCanvas, quantityCanvas, quantityText, detectCorners, cropCanvas, rectifyCanvas, seek };
})();

export default recognition;

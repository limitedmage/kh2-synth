import recognition from "../recognition.js";

async function recognizeQuantity(worker, canvas) {
  let result = await worker.recognize(canvas);
  if (result.data.confidence < 85) {
    await worker.setParameters({ tessedit_pageseg_mode: "8" });
    const alternate = await worker.recognize(canvas);
    await worker.setParameters({ tessedit_pageseg_mode: "7" });
    if (/^\d{1,4}$/.test(alternate.data.text.trim()) && alternate.data.confidence > result.data.confidence) result = alternate;
  }
  const text = recognition.quantityText(canvas, result.data.text.trim());
  return {
    quantity: /^\d{1,4}$/.test(text) && result.data.confidence >= 65 ? Number(text) : null,
    confidence: result.data.confidence,
  };
}

export function createScanner(engineLoader = recognition.loadEngine) {
  let activeRun = null;
  return {
    cancel() {
      activeRun?.controller.abort();
      for (const worker of activeRun?.workers || []) activeRun.terminate(worker);
    },
    async read({ media, kind, video, interval, columns, crop, alignment, split, onStatus, onProgress, onFrame }) {
      if (activeRun) throw new Error("Recognition is already running.");
      const controller = new AbortController();
      const { signal } = controller;
      const workers = new Set();
      const terminations = new Map();
      function terminate(worker) {
        if (!terminations.has(worker)) terminations.set(worker, Promise.resolve().then(() => worker.terminate()).catch(() => {}));
        return terminations.get(worker);
      }
      activeRun = { controller, workers, terminate };
      const checkCancelled = () => {
        if (signal.aborted) throw new DOMException("Cancelled", "AbortError");
      };
      const observations = [];
      const raw = [];
      const sourceReadings = new Map();
      let unmatched = 0;
      let done = 0;
      let error = null;
      try {
        onStatus("Loading text recognition…");
        const engine = await engineLoader();
        checkCancelled();
        const workerOptions = {
          workerPath: "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js",
          corePath: "https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1",
          langPath: "https://tessdata.projectnaptha.com/4.0.0",
          logger(event) {
            if (!done && !signal.aborted && event.status !== "recognizing text") {
              onStatus(`${event.status} ${Math.round((event.progress || 0) * 100)}%`);
            }
          },
        };
        const worker = await engine.createWorker("eng", 1, workerOptions);
        workers.add(worker);
        checkCancelled();
        await worker.setParameters({ tessedit_pageseg_mode: "6", preserve_interword_spaces: "1", user_defined_dpi: "150" });
        let numberWorker;
        if (kind === "inventory") {
          numberWorker = await engine.createWorker("eng", 2, { ...workerOptions, legacyCore: true, legacyLang: true });
          workers.add(numberWorker);
          checkCancelled();
          // Keep misread digits from retraining the classifier across video frames.
          await numberWorker.setParameters({
            tessedit_pageseg_mode: "7", tessedit_char_whitelist: "0123456789",
            classify_enable_learning: "0", classify_enable_adaptive_matcher: "0", user_defined_dpi: "150",
          });
        }
        const frames = video ? Math.ceil(media.duration / interval) : 1;
        if (frames > 1200) throw new Error("This recording would need more than 1200 frames. Choose a slower sampling interval or trim the recording.");
        const total = frames * columns;
        for (let frame = 0; frame < frames; frame++) {
          checkCancelled();
          if (video) await recognition.seek(media, Math.min(frame * interval, media.duration - 0.01), signal);
          onFrame();
          const frameMedia = alignment ? recognition.rectifyCanvas(media, alignment, kind === "inventory" ? 0.08 : 0) : media;
          const frameCrop = alignment ? { x: 0, y: 0, w: 100, h: 100 } : crop;
          for (let column = 0; column < columns; column++) {
            checkCancelled();
            onStatus(`Reading ${video ? `frame ${frame + 1}/${frames}, ` : ""}column ${column + 1}/${columns}. ${Math.round(done / total * 100)}% complete.`);
            const numberColumn = kind === "inventory" ? recognition.cropCanvas(frameMedia, frameCrop, column, columns, split, false) : null;
            const canvas = numberColumn ? recognition.inventoryCanvas(numberColumn) : recognition.cropCanvas(frameMedia, frameCrop, column, columns, split);
            const result = await worker.recognize(canvas);
            const lines = result.data.lines || result.data.text.split(/\r?\n/).map((text) => ({ text, confidence: result.data.confidence }));
            if (kind === "inventory") {
              const columnText = [];
              for (const line of lines) {
                const source = `${video ? `Video ${media.currentTime.toFixed(2)}s` : "Photo"}, column ${column + 1}`;
                const parsed = recognition.parseLines([line], kind, source);
                unmatched += parsed.unmatched.length;
                if (!parsed.rows.length || !line.bbox) { columnText.push(line.text); continue; }
                checkCancelled();
                const countCanvas = recognition.quantityCanvas(numberColumn, line.bbox);
                const digits = await recognizeQuantity(numberWorker, countCanvas);
                for (const row of parsed.rows) {
                  row.quantity = digits.quantity;
                  columnText.push(`${row.name}${row.quantity === null ? "" : ` ${row.quantity}`}`);
                  row.confidence = Math.min(row.confidence, digits.confidence);
                  const key = `${row.name}:${row.quantity}`;
                  const previous = sourceReadings.get(key);
                  if (!previous || row.confidence * row.score > previous.confidence * previous.score) {
                    if (previous) delete previous.image;
                    const sourceBounds = countCanvas.sourceBounds || line.bbox;
                    row.image = recognition.sourceCanvas(numberColumn, {
                      y0: Math.min(line.bbox.y0, sourceBounds.y0), y1: Math.max(line.bbox.y1, sourceBounds.y1),
                    }).toDataURL("image/jpeg", 0.9);
                    sourceReadings.set(key, row);
                  }
                  observations.push(row);
                }
              }
              raw.push(columnText.join("\n"));
            } else {
              const parsed = recognition.parseLines(lines, kind, `Frame ${frame + 1}, column ${column + 1}`);
              observations.push(...parsed.rows);
              unmatched += parsed.unmatched.length;
              raw.push(result.data.text);
            }
            done++;
            onProgress(done / total);
          }
        }
      } catch (caught) {
        error = signal.aborted ? null : caught;
      } finally {
        await Promise.all([...workers].map(terminate));
        activeRun = null;
      }
      return {
        rows: recognition.merge(observations, video ? 2 : 1),
        raw: raw.join("\n"), unmatched, cancelled: signal.aborted, error,
      };
    },
  };
}

import { test } from "node:test";
import assert from "node:assert/strict";
import recognition from "../src/recognition.js";
import { createScanner } from "../src/import/scanner.js";

const textResult = () => ({ data: { text: "AP Boost", lines: [{ text: "AP Boost", confidence: 100 }] } });
const options = () => ({
  media: {}, kind: "recipes", video: false, interval: 0.2, columns: 1,
  crop: { x: 0, y: 0, w: 100, h: 100 }, alignment: null, split: 50,
  onStatus() {}, onProgress() {}, onFrame() {},
});
function deferred() {
  let resolve;
  const promise = new Promise((done) => { resolve = done; });
  return { promise, resolve };
}
function worker(recognize = async () => textResult()) {
  return {
    terminated: 0, setParameters: async () => {}, recognize,
    async terminate() { this.terminated++; },
  };
}

test("cancelling during worker creation cleans up the late worker and allows another scan", async (context) => {
  context.mock.method(recognition, "cropCanvas", () => ({}));
  const creating = deferred();
  const release = deferred();
  const workers = [];
  const scanner = createScanner(async () => ({
    async createWorker() {
      const next = worker();
      workers.push(next);
      if (workers.length === 1) { creating.resolve(); await release.promise; }
      return next;
    },
  }));
  const pending = scanner.read(options());
  await creating.promise;
  await assert.rejects(scanner.read(options()), /already running/);
  scanner.cancel();
  release.resolve();
  const cancelled = await pending;
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.error, null);
  assert.deepEqual(cancelled.rows, []);
  assert.equal(workers[0].terminated, 1);
  const restarted = await scanner.read(options());
  assert.equal(restarted.cancelled, false);
  assert.equal(restarted.error, null);
  assert.equal(restarted.rows[0].name, "AP Boost");
  assert.equal(restarted.rows[0].checked, true);
  assert.equal(workers[1].terminated, 1);
});

test("recognition failure keeps partial rows and releases workers", async (context) => {
  context.mock.method(recognition, "cropCanvas", () => ({}));
  context.mock.method(recognition, "seek", async (media, time) => { media.currentTime = time; });
  let calls = 0;
  const failure = new Error("Frame could not be read");
  const reader = worker(async () => {
    if (++calls === 2) throw failure;
    return textResult();
  });
  const scanner = createScanner(async () => ({ createWorker: async () => reader }));
  const result = await scanner.read({ ...options(), video: true, media: { duration: 0.4 } });
  assert.equal(result.error, failure);
  assert.equal(result.cancelled, false);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].name, "AP Boost");
  assert.equal(result.rows[0].checked, false, "One video reading is insufficient for automatic selection");
  assert.equal(result.raw, "AP Boost");
  assert.equal(reader.terminated, 1);
});

test("cancelling in-flight recognition preserves completed frames and terminates only once", async (context) => {
  context.mock.method(recognition, "cropCanvas", () => ({}));
  context.mock.method(recognition, "seek", async (media, time) => { media.currentTime = time; });
  const recognizing = deferred();
  let interrupt;
  let calls = 0;
  const reader = worker(async () => {
    if (++calls === 1) return textResult();
    return new Promise((resolve, reject) => {
      interrupt = reject;
      recognizing.resolve();
    });
  });
  reader.terminate = async () => {
    reader.terminated++;
    interrupt(new Error("Worker terminated"));
  };
  const scanner = createScanner(async () => ({ createWorker: async () => reader }));
  const pending = scanner.read({ ...options(), video: true, media: { duration: 0.4 } });
  await recognizing.promise;
  scanner.cancel();
  const result = await pending;
  assert.equal(result.cancelled, true);
  assert.equal(result.error, null);
  assert.equal(result.rows[0].name, "AP Boost");
  assert.equal(result.raw, "AP Boost");
  assert.equal(reader.terminated, 1);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import data from "../src/data.js";
import planner from "../src/planner.js";
import { encodeSaveURL, decodeSaveURL } from "../src/save.js";

test("magic URLs round-trip every saved field and keep the hosted page address", async () => {
  const state = planner.sanitize({
    version: 1,
    goals: { "Save the King+": 1, "AP Boost": 1 },
    inventory: { "Orichalcum+": 7, "Dense Shard": 9999 },
    crafted: { "Save the King": true },
    worlds: { tt: 2, hb: 3 },
    chests: { tt: true, hb: false },
    optional: { [data.optional[0][0]]: true },
    rewards: { [data.rewards[0].id]: true },
    methods: { "Mythril Shard": "collect", "Energy Crystal": "craft" },
    moogle: 8, energy: "farm", expand: false, materialTypes: 60, luckyLuckyCount: 7,
  });
  const url = new URL(await encodeSaveURL(state, "https://example.com/guide/index.html?edition=fm#materials"));
  assert.equal(url.origin + url.pathname, "https://example.com/guide/index.html");
  assert.equal(url.search, "?edition=fm");
  assert.deepEqual(await decodeSaveURL(url.hash.slice("#save=".length)), state);
});

test("magic URLs from a local HTML file preserve its current path", async () => {
  const url = new URL(await encodeSaveURL(planner.defaults(), "file:///local/guide/index.html#plan"));
  assert.equal(url.href.split("#")[0], "file:///local/guide/index.html");
  assert.deepEqual(await decodeSaveURL(url.hash.slice("#save=".length)), planner.sanitize(planner.defaults()));
});

test("magic URLs reject corrupt, unsupported, and oversized saves", async () => {
  const payload = (value) => gzipSync(value).toString("base64url");
  for (const invalid of ["", "%%%", "not-a-save", payload("not JSON"), payload('{"version":2}')]) {
    await assert.rejects(decodeSaveURL(invalid));
  }
  await assert.rejects(decodeSaveURL(payload(" ".repeat(1000001))), /too large/);
});

import { test } from "node:test";
import assert from "node:assert/strict";
import icons from "../src/icons.js";
import data from "../src/data.js";
import thumbnails from "../src/wiki-thumbnails.json" with { type: "json" };

test("all materials and recipes select embedded wiki artwork and remain decorative", () => {
  for (const name of [...Object.keys(data.materials), ...data.recipes.map((recipe) => recipe.name)]) {
    const icon = icons.item(name);
    assert.match(icon, /^<svg class="kh-icon" /, name);
    assert.match(icon, /viewBox="0 0 32 32"/, name);
    assert.match(icon, /aria-hidden="true" focusable="false"/, name);
    assert.match(thumbnails[name].src, /^data:image\/webp;base64,[A-Za-z0-9+/]+=*$/, name);
    assert.ok(icon.includes(`<image href="${thumbnails[name].src}"`), name);
    assert.match(thumbnails[name].file, / KHII(?:FM)?\.png$/, name);
    assert.doesNotMatch(icon, /<script|\bid=|\burl\(|\bon\w+=/i, name);
  }
});

test("unknown icon names retain safe, self-contained vector fallbacks", () => {
  for (const value of [undefined, null, {}, "__proto__", "constructor", '<img src=x onerror="alert(1)">']) {
    assert.equal(icons.item(value), icons.item(""), "Unknown items use the safe armor fallback");
    assert.equal(icons.material(value), icons.material(""), "Unknown materials use the safe gem fallback");
    assert.doesNotMatch(icons.item(value) + icons.material(value), /<image|<script|\bhref=|\bon\w+=/i);
  }
});

test("wiki artwork distinguishes material grades and special variants", () => {
  for (const family of ["Blazing", "Bright", "Remembrance", "Tranquility"]) {
    const grades = ["Shard", "Stone", "Gem", "Crystal"].map((tier) => icons.material(`${family} ${tier}`));
    assert.equal(new Set(grades).size, 4, `${family} grades have distinct silhouettes`);
  }
  assert.notEqual(icons.material("Bright Gem"), icons.material("Blazing Gem"));
  assert.notEqual(icons.material("Lost Illusion"), icons.material("Manifest Illusion"));
  assert.notEqual(icons.material("Orichalcum"), icons.material("Orichalcum+"));
});

test("equipment names do not collide with materials and retain category-specific artwork", () => {
  assert.notEqual(icons.item("Orichalcum Ring"), icons.material("Orichalcum"));
  assert.notEqual(icons.item("Orichalcum Ring"), icons.item("Mythril Ring"));
  assert.equal(icons.item("Orichalcum+"), icons.material("Orichalcum+"));
  assert.equal(icons.item("Energy Crystal"), icons.material("Energy Crystal"));
  assert.notEqual(icons.item("Firaga Bangle"), icons.item("Blizzaga Armlet"));
  assert.notEqual(icons.item("Ultima Weapon"), icons.item("Centurion"));
  assert.notEqual(icons.item("Save the Queen"), icons.item("Save the King"));
});

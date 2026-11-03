import { test } from "node:test";
import assert from "node:assert/strict";
import icons from "../src/icons.js";
import data from "../src/data.js";

test("all material and recipe icons remain decorative, self-contained SVGs", () => {
  for (const name of [...Object.keys(data.materials), ...data.recipes.map((recipe) => recipe.name)]) {
    const icon = icons.item(name);
    assert.match(icon, /^<svg class="kh-icon" /, name);
    assert.match(icon, /viewBox="0 0 32 32"/, name);
    assert.match(icon, /aria-hidden="true" focusable="false"/, name);
    assert.doesNotMatch(icon, /<image|<script|\bid=|\bhref=|\burl\(/i, name);
  }
  for (const value of [undefined, null, {}, '<img src=x onerror="alert(1)">']) {
    assert.equal(icons.item(value), icons.item(""), "Unknown items use the safe armor fallback");
    assert.equal(icons.material(value), icons.material(""), "Unknown materials use the safe gem fallback");
  }
});

test("grade silhouettes distinguish standard, modifier, and Final Mix material families", () => {
  const geometry = (svg) => [...svg.matchAll(/\b(d|cx|cy|rx|ry|r|transform)="([^"]+)"/g)]
    .map((match) => `${match[1]}=${match[2]}`).join("|");
  for (const family of ["Blazing", "Bright", "Remembrance", "Tranquility"]) {
    const grades = ["Shard", "Stone", "Gem", "Crystal"].map((tier) => geometry(icons.material(`${family} ${tier}`)));
    assert.equal(new Set(grades).size, 4, `${family} grades have distinct silhouettes`);
  }
  assert.notEqual(geometry(icons.material("Bright Gem")), geometry(icons.material("Blazing Gem")));
  assert.notEqual(geometry(icons.material("Lost Illusion")), geometry(icons.material("Manifest Illusion")));
  assert.notEqual(geometry(icons.material("Orichalcum")), geometry(icons.material("Orichalcum+")));
});

test("equipment names do not collide with materials and retain category-specific artwork", () => {
  assert.notEqual(icons.item("Orichalcum Ring"), icons.material("Orichalcum"));
  assert.equal(icons.item("Orichalcum Ring"), icons.item("Mythril Ring"));
  assert.equal(icons.item("Orichalcum+"), icons.material("Orichalcum+"));
  assert.equal(icons.item("Energy Crystal"), icons.material("Energy Crystal"));
  assert.notEqual(icons.item("Firaga Bangle"), icons.item("Blizzaga Armlet"));
  assert.notEqual(icons.item("Ultima Weapon"), icons.item("Centurion"));
  assert.notEqual(icons.item("Save the Queen"), icons.item("Save the King"));
});

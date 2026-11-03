import thumbnails from "./enemy-thumbnails.json" with { type: "json" };
import wikiThumbnails from "./wiki-thumbnails.json" with { type: "json" };
import { escape, link } from "./dom.js";

export const enemyImages = thumbnails;

export function enemyImageMarkup(enemy, url) {
  const image = enemyImages[enemy];
  if (!image) return "";
  return `
    <a class="route-enemy-image" href="${escape(url)}" target="_blank" rel="noreferrer"
      aria-label="${escape(`View ${enemy} on KH Wiki`)}">
      <img src="${image.src}" width="76" height="76" alt="" decoding="async">
    </a>`;
}

export function imageCreditsMarkup() {
  return Object.entries({ ...enemyImages, ...wikiThumbnails }).map(([name, image]) => `
    <li>${link(image.source, name)} · ${escape(image.copyright)}
      KH Wiki file contributors: ${escape(image.contributors.join(", "))}.</li>
  `).join("");
}

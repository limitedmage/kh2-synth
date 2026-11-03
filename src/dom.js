import icons from "./icons.js";

export const byId = (id) => document.getElementById(id);
export const escape = (value) => String(value).replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);
export const link = (url, text) => `<a href="${escape(url)}" target="_blank" rel="noreferrer">${escape(text)}</a>`;
export const icon = (kind, name) => icons[kind](name);
export const ingredientText = (ingredients) => Object.entries(ingredients).map(([name, quantity]) => `
  <span class="ingredient icon-label">${icon("material", name)}<span>${quantity} ${escape(name)}</span></span>
`).join(" · ");

export function on(root, type, selector, handler) {
  root.addEventListener(type, (event) => {
    const target = event.target.closest(selector);
    if (target && root.contains(target)) handler(target, event);
  });
}

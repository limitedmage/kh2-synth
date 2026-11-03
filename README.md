# KH2 Final Mix Synthesis Journal

**Open [index.html](index.html) directly in a modern browser. No server, account, or build step is needed.**

1. Choose recipes under **Recipes**, or import a game photo. The wishlist requests one of each.
2. Enter stock under **Materials**, or import a scrolling inventory video.
3. Set **World progress**, optional unlocks, chest completion, and the Moogle level.
4. Open **Farming plan** for readiness checkmarks, ingredient counts, missing materials, and farming locations.

The page saves locally in the browser. **Export save** offers a JSON backup or a **magic URL** containing a compressed snapshot of the complete save. Open that URL on another device to import it; an existing save requires confirmation before replacement. The payload is removed from the address bar after opening, so reloading does not import it again. Magic URLs preserve the current page address, including custom hosting paths. Save data stays in the URL fragment, not a server upload.

The magic URL is generated automatically whenever **Export save** opens. Choose **Copy URL** to share it, or **Download JSON** for a file backup.

**Load save** restores JSON backups. Keep the HTML at the same path for consistent browser storage. Browser restrictions/private mode may prevent saving; JSON backups work independently. Ordinary URL fragments keep the current tab.

Ready checkmarks and ingredient costs are calculated independently for each wishlist item using the full current inventory, without reserving materials for other items. Ingredient chips show owned/needed counts and retain surplus; combined totals appear only under **Materials to collect**. Shared-material warnings flag conflicts only between items that are independently ready to craft; missing and locked items are excluded. **End-game preset** unlocks every world and optional area without marking chests collected or adding inventory. Menu styling and item/material icons are original artwork.

## Media import

- Choose **Import media** and select a photo or video. Media never leaves the device.
- Table corners and the inventory column divider are detected from the image, including camera perspective. Drag individual handles to adjust. If detection fails, a starting selection is shown for manual alignment.
- To select new corners, choose **Realign four corners**, then click top-left, top-right, bottom-right, and bottom-left. **Reset corners** retries detection on the current frame. Keep the camera still while scrolling; adjust again if it moves.
- Recipe photos read names from the left list only, never ingredients or stock from the right panel. Scan **Recipes** and **Free Development** one after another: both lists accumulate into one deduplicated review before applying. Dim unmade items can be harder to recognize.
- Inventory is read column-by-column, sampling every 0.2 seconds by default. Overlapping rows are not summed. Conflicting counts require review.
- Material names are read without grade badges or quantities. A dedicated combined legacy/LSTM numeric recognizer reads white or yellow counts on blue or dark rows, rejecting badge fragments, neighboring rows, and low-confidence guesses. Video counts require repeated agreement before being preselected. Adjust **First column width %** if the preview separator clips the left counts or overlaps the right column.
- Inventory alignment includes a small vertical margin to tolerate camera drift and avoid dropping the bottom rows while scrolling.
- Recipe review shows names only. Applying it keeps one of each selected recipe; inventory never changes. Older saved wishlists also normalize to one of each. Read inventory separately from the game's **Materials** list.
- Inventory review includes quantities. Use **Check all** or select individual rows, then correct any unreadable counts before applying. Applying replaces all previous inventory: omitted and unchecked materials become zero. Selecting or scanning a file does not clear stock.
- Each material recognized from media shows a compact original-color name/count image on the right for correction. Hover for its photo/column or video timestamp. Repeated readings use the clearest source matching the displayed count. These images stay local and are not included in exported saves.
- OCR downloads pinned Tesseract.js 5.1.1 and its English model from public CDNs on first use. Manual entry, planning, and saved data work without internet. No API key is needed.
- MOV playback depends on browser codec support. If unsupported, export the recording as H.264 MP4 or use screenshots. Short recordings with pauses produce better results.
- Cancel keeps partial readings for review. Pasted text is also supported.

## Calculation rules

Stock is shared across the entire wish list. Missing Mythril can be recursively synthesized when its unlocks are met; Mythril has no enemy drops. Other craftable materials default to collecting, with a per-material synthesis switch. Chest tracking consists only of global and per-world completion switches: **no chest routes are planned, and unchecked chests never count as stock**.

Moogle rank discounts and Energy reductions stack, rounding up per ingredient per craft. For combined material totals, Energy is allocated in goal order, then to material sub-recipes; available-stock mode never assumes unlimited Energy. Upgrades require Moogle level 3, and combining their Serenity modifier with Energy requires level 4. First-time base crafts are included unless marked previously made; an upgrade does not consume the base equipment. The calculator holds Moogle level constant rather than predicting experience gains.

Recipe selections assume their recipe documents have been collected. Free Development checks the lifetime number of material types discovered, independently of current stock. World stages conservatively gate farming locations; temporary story encounters can differ. Chest switches do not alter world progress. Orichalcum+ is finite, with non-chest reward tracking separate from inventory.

Recipe, material, and enemy source links are included in the page. Final Mix data is used rather than original KH2 data, notably Petite Ribbon quantities and Serenity drop sources. Principal references: [Kingdom Hearts Wiki](https://www.khwiki.com/Synthesis) and [Destiny Islands](https://www.destinyislands.com/kh2-fm/synthesis/materials/). This unofficial fan tool contains no game assets.

The Farming plan's **Lucky Lucky abilities** setting counts equipped copies across the active party, including equipment, and is saved/exported with the journal (default: 0). Final Mix stacks additively: `effective % = min(100, base % × (1 + 0.5 × count))`, per [KH Wiki's mechanics section](https://www.khwiki.com/Lucky_Strike#Mechanics), corroborated by the [Final Mix explanation](https://kingdomhearts.fandom.com/wiki/Lucky_Strike). Route rates show effective and unchanged base percentages; display values are rounded to two decimal places, not whole percentages. Unknown rates remain unknown. The input accepts nonnegative integers without assuming a mode/form-dependent game cap.

## Development

The generated **index.html is committed** and contains all application code, styles, and guide data. ES modules in `src/` are bundled inline by esbuild at build time; there is no runtime framework or module download.

### Source layout

| Path | Responsibility |
| --- | --- |
| `src/app.js` | Startup, navigation, and notices |
| `src/save.js` | JSON backups, compressed save URLs, and import/export controls |
| `src/store.js` | Journal actions, state transitions, and browser persistence |
| `src/views/` | Screen-owned rendering and events; HTML templates receive state rather than mutating it |
| `src/import/` | Media loading, crop alignment, OCR worker lifecycle, and editable review |
| `src/selectors.js` | Pure wishlist and route projections |

`src/planner.js`, `src/recognition.js`, `src/data.js`, and `src/icons.js` provide the calculation, image-processing, guide-data, and artwork modules. The OCR scanner reports status and results through callbacks; it does not read or update page controls. Only journal actions update saved state. Preview media, workers, and uncommitted review edits remain local to the import feature.

Plain modules are sufficient for five fixed screens. A UI framework, custom elements, a virtual DOM, or a home-grown template engine would add machinery without removing the need for these ownership boundaries. Existing light-DOM markup, accessibility, save format, and direct `file://` usage are preserved.

### Commands

```sh
npm install
npm run build
npm test
npx playwright install chromium
npm run test:browser
npm run test:ui
```

`npm run check` rebuilds and runs all suites. Browser checks use `file://`, not a development server. Sample media in `samples/` stays local and is ignored by Git.

With the supplied samples present, `node tests/browser.mjs --media` exercises local OCR on both recipe photos and all three inventory recordings (`materials.MOV`, `materials-2.MOV`, and `materials-3.mp4`). It checks every visible material and count against the footage, including Orichalcum+, camera alignment, and yellow screen-capture counts. This check needs internet for OCR engine/model downloads. Disputed readings intentionally remain unchecked for manual review.

# KH2 Final Mix Synthesis Journal

**Open [index.html](index.html) directly in a modern browser. No server, account, or build step is needed.**

1. Add recipes and quantities under **Recipes**, or import a game photo.
2. Enter stock under **Materials**, or import a scrolling inventory video.
3. Set **World progress**, optional unlocks, chest completion, and the Moogle level.
4. Open **Farming plan** for shared material deficits, synthesis prerequisites, and available/locked enemy locations.

The page saves locally in the browser. **Export save** downloads a JSON backup; **Load save** restores it. Keep the HTML at the same path for consistent browser storage. Browser restrictions/private mode may prevent saving; JSON backups work independently.

## Media import

- Choose **Photo & video import** and select a photo or video. Media never leaves the device.
- Drag a reading area over the recipe list or inventory table; percentage fields also adjust it. Default crops fit the supplied TV photos/video, but other captures may need adjustment.
- For a crooked camera capture, select **Align four corners**, then click the table's top-left, top-right, bottom-right, and bottom-left corners. The page corrects perspective before recognition. Keep the camera still while scrolling; align again if it moves.
- Recipe photos read names from the left list only, never ingredients or stock from the right panel. Scan **Recipes** and **Free Development** one after another: both lists accumulate into one deduplicated review before applying. Dim unmade items can be harder to recognize.
- Inventory is read column-by-column, sampling every 0.2 seconds by default. Overlapping rows are not summed. Conflicting counts require review.
- Quantities are recognized separately from names, with their own image thresholding. Video counts require repeated agreement before being preselected. Adjust **First column width %** if the preview separator clips the left counts or overlaps the right column.
- Recipe review shows names only. Applying it adds missing goals at quantity 1 and preserves existing desired quantities; inventory never changes. Read inventory separately from the game's **Materials** list.
- Inventory review includes quantities. Check the desired rows, then apply to replace only those material totals. Unreadable counts stay blank.
- OCR downloads pinned Tesseract.js 5.1.1 and its English model from public CDNs on first use. Manual entry, planning, and saved data work without internet. No API key is needed.
- MOV playback depends on browser codec support. If unsupported, export the recording as H.264 MP4 or use screenshots. Short recordings with pauses produce better results.
- Cancel keeps partial readings for review. Pasted text is also supported.

## Calculation rules

Stock is shared across the entire wish list. Missing Mythril can be recursively synthesized when its unlocks are met; Mythril has no enemy drops. Other craftable materials default to collecting, with a per-material synthesis switch. Chest tracking consists only of global and per-world completion switches: **no chest routes are planned, and unchecked chests never count as stock**.

Moogle rank discounts and Energy reductions stack, rounding up per ingredient per craft. Energy is allocated in goal order, then to material sub-recipes; available-stock mode never assumes unlimited Energy. Upgrades require Moogle level 3, and combining their Serenity modifier with Energy requires level 4. First-time base crafts are included unless marked previously made; an upgrade does not consume the base equipment. The calculator holds Moogle level constant rather than predicting experience gains.

Recipe selections assume their recipe documents have been collected. Free Development checks the lifetime number of material types discovered, independently of current stock. World stages conservatively gate farming locations; temporary story encounters can differ. Chest switches do not alter world progress. Orichalcum+ is finite, with non-chest reward tracking separate from inventory.

Recipe, material, and enemy source links are included in the page. Final Mix data is used rather than original KH2 data, notably Petite Ribbon quantities and Serenity drop sources. Principal references: [Kingdom Hearts Wiki](https://www.khwiki.com/Synthesis) and [Destiny Islands](https://www.destinyislands.com/kh2-fm/synthesis/materials/). This unofficial fan tool contains no game assets.

## Development

The generated **index.html is committed** and contains all application code, styles, and guide data. `src/` contains the maintainable source.

```sh
npm install
npm run build
npm test
npx playwright install chromium
npm run test:browser
```

`npm run check` rebuilds and runs both suites. Browser checks use `file://`, not a development server. Sample media in `samples/` stays local and is ignored by Git.

With the supplied samples present, `node tests/browser.mjs --media` also exercises real local OCR on both photos and the crooked MOV, including four-corner alignment. This check needs internet for OCR engine/model downloads. Some sample readings intentionally remain unchecked for manual review.

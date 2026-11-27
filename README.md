# Beans Card Generator

Static site (no build step) that turns one bean's details into four print files:

| Format  | Size            | Output PNG                        |
|---------|-----------------|-----------------------------------|
| Card    | 5 × 7 cm        | `stickers_<bean>_card.png`        |
| Sticker | 7 × 10 cm       | `stickers_<bean>_sticker.png`     |
| Donut   | 10 × 5 cm (arc, 6 cm inner / 10 cm outer diameter) | `stickers_<bean>_donut.png` |
| Tube    | A4, 10 × 14 circles of 2 cm | `stickers_<bean>_tube.png` |

PNGs are exported at 150 / 300 / 600 dpi with the DPI written into the file, so they open at the real physical size in Illustrator, Preview, etc.

## Use

Open `index.html` (double-click works) or host it. Fill in name, roastery, origins (% / origin / process), black & white notes, 4 gradient colours (top / right / bottom / left as seen on the card) and the line-up months. Previews update live; download each PNG or all four as a ZIP.

"Library" keeps beans in your browser (localStorage). Use **Export JSON / Import JSON** to back up or move to another computer.

## Publish on GitHub Pages

1. Push this folder to a repo.
2. Settings → Pages → Deploy from branch → `main` / root.

## Fonts & licensing

`assets/fonts/NeueMontreal-*.otf` are your licensed Neue Montreal files. **A public repo makes them publicly downloadable** — check your licence, or keep the repo private (GitHub Pages on private repos needs a paid plan).
The donut's line-up text uses DM Mono Light (OFL) as a stand-in for the mono face in your reference; replace `assets/fonts/DMMono-Light.*` and the `"DM Mono"` family name in `css/style.css` / `js/render.js` if you have the original.

## How it works

- `js/render.js` — the four renderers on a canvas. All positions are in 300-dpi pixels measured from your Illustrator exports (`B.SPECS` at the top: font sizes, margins, baselines, line spacing). Tweak there if you want to nudge a layout.
- `js/gradient.js` + `js/data.js` — your reference gradients were decomposed into weight maps for "colour 1…4 + white", so any four colours get the same swirl. Card & sticker use the card field, the donut is the same field rotated 90°, the tube uses its own field.
- `js/png.js` — DPI metadata. `js/app.js` — form, previews, ZIP (vendored JSZip), library.

Long names/lists shrink or wrap automatically (card/sticker title and body, donut title).

## Dev check (optional)

`npm i && npm test` renders all four formats with node-canvas into `test/out/` to compare against the references.

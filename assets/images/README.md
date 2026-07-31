# dano — icon assets

Mark: the peak + macro bar. Lime `#b5f23d` on ink `#0f0f0f`.

| File | Size | Alpha | Wired in app.json |
|---|---|---|---|
| `icon.png` | 1024² | no | `expo.icon`, `web.favicon` |
| `adaptive-icon.png` | 1024² | yes | `android.adaptiveIcon.foregroundImage` (background `#0f0f0f`) |
| `splash-icon.png` | 1024² | yes | `expo-splash-screen` plugin `image` (background `#0f0f0f`) |
| `icon-1024.svg`, `mark-lime.svg`, `mark-ink.svg` | vector | — | Source — regenerate PNGs from these if the mark changes |

PNGs were rendered from the SVG sources via `sharp` (1024×1024, `density: 384`).
`icon.png` is flattened onto `#0f0f0f` (no alpha, per iOS App Store icon rules —
transparency is rejected). `adaptive-icon.png`/`splash-icon.png` keep alpha so
the mark composites over the background colors set in `app.json`.

## Notes

- Do not pre-round `icon.png`'s corners — iOS applies its own squircle mask.
- Android's adaptive-icon safe zone is a centered circle ~61% of the canvas;
  the macro-bar's right edge sits outside that circle, so aggressive
  circular-mask launchers may clip it slightly. Not currently an issue in
  practice (no Android build exists yet), but worth a look before shipping one.
- `mark-ink.svg` isn't wired anywhere yet — kept as source for a future
  light-background variant (e.g. a light-mode splash or web favicon).

# Supernova → DTCG exporter

Exports Supernova design tokens as W3C DTCG (Design Tokens Format Module)
JSON, targeting the subset **Style Dictionary v4/v5 reliably digest today**
by default, with a `structured` mode for teams already on a Style
Dictionary release with fuller 2025.10 support.

## Before you build/run this

This was written against Supernova's public docs and SDK reference pages,
**not** by compiling against the live `@supernovaio/sdk-exporters` package
(no network access at write time). Every place that's an inference rather
than a confirmed fact is marked `VERIFY` in a comment. Before shipping,
run `Supernova: Create a new exporter package` in VS Code once to get a
real, current scaffold, then:

1. Compare `manifest.json` against the freshly-scaffolded one (engine
   version, executable path conventions may have moved on).
2. Confirm the exact entry function signature in `src/index.ts` — the
   `sdk`/`context` argument shape is a best guess based on documented SDK
   call patterns (`sdk.tokens.getTokens(...)`, `sdk.tokens.getTokenGroups(...)`),
   not a confirmed function signature.
3. Confirm the `TokenType` enum member names used as string literals
   throughout `src/convert/index.ts` (`"dimension"`, `"size"`, `"space"`,
   `"fontSize"`, etc.) against the real enum — these were inferred from the
   `*TokenValue` type names documented in the SDK reference, following the
   one confirmed example (`TokenType.color`), not dumped from the enum
   itself.
4. Confirm the `Unit` enum member names in `src/util/units.ts` — only
   `Unit.raw` is confirmed from the docs; `px`/`rem`/`pt`/`percent`/`ms`/`s`
   are reasonable guesses.
5. Confirm `ColorTokenValue.color.{r,g,b}` range (0–255 vs 0–1) —
   `src/convert/color.ts` defensively handles both, but double check against
   real data.

None of this changes the shape of the DTCG output or the conversion
decisions below — it's wiring, not logic.

## Config (`config.json`)

| Key | Default | What it does |
|---|---|---|
| `valueFormat` | `flat` | `flat`: hex color strings, `"16px"` dimension strings — what Style Dictionary v4/v5 handle without special cases. `structured`: full 2025.10 object values (`colorSpace`/`components`, `{value,unit}`) — only turn this on once you've confirmed your Style Dictionary version's coverage for the composite types you actually use (see caveats below). |
| `outputFileStructure` | `single-file` | One `tokens.json`, or one file per Supernova token type. |
| `preserveVendorExtensions` | `true` | Properties with no DTCG equivalent (border position, gradient angle, typography textCase/textDecoration) are kept under `$extensions["io.supernova.exporter"]` instead of silently dropped. |
| `includeUnmappableTokenTypes` | `false` | Whether tokens whose *entire type* has no DTCG equivalent (blur, visibility, standalone textCase/textDecoration tokens) get exported as `$type: "string"` fallbacks, or skipped. |

## Known, permanent fidelity gaps

These aren't bugs to fix later — they're places where Supernova's token
model has more information than the DTCG spec can currently hold. All are
logged as build warnings when they occur; with `preserveVendorExtensions`
on, the original data survives in `$extensions` even though downstream
CSS/Swift/Compose output generated from the file won't use it.

- **Gradient direction/type/coordinates** — DTCG's gradient type is only a
  list of `{color, position}` stops. Linear-vs-radial, angle, and start/end
  points are not representable. This is a spec-level gap (open in the
  DTCG community group), not something we can work around.
- **Border position** (inside/outside/center) — no DTCG equivalent.
- **Typography textCase, textDecoration, paragraphIndent,
  paragraphSpacing** — DTCG's typography composite only defines
  fontFamily/fontSize/fontWeight/letterSpacing/lineHeight. (This is the
  same gap the old first-party Supernova DTCG exporter flagged in 2021 and
  never resolved — it's the spec, not the tooling.)
- **lineHeight** — DTCG expects a unitless multiplier of fontSize.
  Supernova line-height defined as an absolute px value, or as "auto"
  (`null`), doesn't convert cleanly; percent-based line-height converts
  correctly (÷100).
- **fontWeight free text** — Supernova stores font weight as arbitrary
  text; anything that isn't a number 1–1000 or a recognized DTCG keyword
  falls back to `400` with a warning rather than emitting spec-illegal
  output.
- **Partial references (mixins)** — e.g. a color token that references
  another color's hue but overrides its own opacity. DTCG's curly-brace
  alias syntax can only reference a *whole* token. These are resolved to a
  literal value (not an alias) with a warning. Full support would need
  `structured` mode's JSON Pointer property-level references
  (`$ref: "#/path/$value/..."`), which isn't implemented here yet.

## Style Dictionary compatibility notes

- `flat` mode output works against Style Dictionary v4 and v5 without
  special config.
- `structured` mode requires checking your installed Style Dictionary
  version's changelog for the specific composite types you use — 2025.10
  support has been landing incrementally (dimension objects and sRGB color
  objects are solid; some composite/motion types were still catching up
  as of late 2025). It is **not** simply gated behind "v4 vs v5."
- Either mode: don't emit aliases pointing at a group or a sub-property —
  only whole tokens. This exporter already only does that (see the mixin
  note above), and it also happens to be required by Style Dictionary v5's
  stricter reference resolution.

## Migrating from `flat` to `structured` later

No exporter rewrite needed — flip `valueFormat` to `structured` in
`config.json`, re-run the export, and re-test your generated platform
output (new color functions like `oklch()`/`color(display-p3 ...)` become
available; dimension/typography/shadow/border sub-values become objects
instead of strings).

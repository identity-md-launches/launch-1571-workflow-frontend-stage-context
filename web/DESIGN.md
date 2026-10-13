# CAT WARS design

Written from the final source of the frontend (`web/src/styles.css`, `web/index.html` and the
components under `web/src/components/`). This file sits under `web/` because the frontend stage's
write scope excludes the repository root.

## Overview

CAT WARS is a one-page betting game for people with a Sepolia wallet. The visual character is a
dark arena: a near-black page, slightly lighter panels, bright lime for the one primary action,
hot red and cyan for the two sides of a fight, gold for warnings and the testnet badge. Density is
moderate: panels stack vertically in a single 1100px column, each with one heading and its
controls. Hierarchy comes from size and weight alone (no colour on headings, no eyebrow labels).
The arena's headline-plus-roster arrangement is one page's layout; the panel, button, field and
hint rules below are system-wide.

## Colors

All tokens are CSS custom properties on `:root` in `web/src/styles.css`, hex or rgba as written
there. `color-scheme: dark` is set; there is no light theme.

| Token | Value | Job |
|---|---|---|
| `--bg` | `#08080b` | page background, field background |
| `--bg-panel` | `#101014` | panels, arena cards, dialog |
| `--bg-panel-2` | `#15151b` | nested surfaces: menus, notices, admin items, default button fill |
| `--line` / `--line-strong` | `rgba(255,255,255,.1)` / `.2` | hairlines, table rules, button and field borders |
| `--text` | `#eef0e8` | primary text |
| `--text-dim` | `#9d9daa` | hints, labels, secondary text (`.hint`, `dt`) |
| `--lime` | `#c9ff3d` | primary action (`.btn-primary`), focus ring, success text, open-round status |
| `--gold` | `#ffcc45` | warnings (`.btn-warn`, testnet badge, pending text, winner ring) |
| `--red` / `--blue` | `#ff2f6e` / `#3ddcff` | side 0 and side 1 (`.side-0`, `.side-1` set `--accent`); `--blue` is also the link colour |
| `--danger` | `#ff7b7b` | error text |
| `--ink` | `#0b0710` | text on lime, gold, red or blue fills |

Side colour flows through `--accent`, set on `.side-0` / `.side-1` and read by card borders, dots,
HP bars and labels. Add a status by reusing these tokens; do not add a second accent. The design
probe measured every rendered text pair at 4.5:1 or better (3:1 for large type) in Chromium.

## Typography

System stacks only, no font files: `--font` is `ui-sans-serif, system-ui, -apple-system,
"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`; `--font-mono` is `ui-monospace,
"SF Mono", Menlo, Consolas, "Liberation Mono", monospace` for addresses, seeds and hashes
(`.mono`, which also allows `overflow-wrap: anywhere`).

One scale of six sizes: `--fs-1` 13px (hints, labels, table, mono), `--fs-2` 15px (body),
`--fs-3` 17px (h3, cat names, brand), `--fs-4` 22px (h2, timer and pot figures, result heading),
`--fs-5` 28px (h1 at 400px and below), `--fs-6` 36px (h1). Three weights: 400 body, 600 headings
h2/h3, buttons and emphasised values, 800 the h1, brand name and big figures. The h1 is the
heaviest type on the page; it uses `line-height: 1.1` and `letter-spacing: -0.02em`, everything
else has natural tracking and `line-height: 1.5` (headings 1.2 to 1.3). Measures: `.headline`
14ch, `.lede` 48ch. Numbers use `.num` for tabular figures. No all-caps text except the brand
"CAT WARS" and the "TESTNET" badge, both literal strings.

## Layout

Spacing tokens `--space-1` to `--space-6` are 4, 8, 12, 16, 24 and 40px. `main` is a centred
grid, max width 1100px, 16px padding, 24px between panels. Panels (`.panel`, `.bet`, `.cat`,
`.action`) are grids with 12px internal gaps and 16px padding. The arena uses
`.arena-grid`: `minmax(0,1fr) auto minmax(0,1fr)` (red cat, centre timer and pot, blue cat).

Breakpoints, all `max-width`: 720px stacks the arena to two columns with the centre column first
and full width, shrinks portraits to 64px and admin items to one column; 400px stacks the two bet
buttons, the brand name and badge, and drops the h1 to `--fs-5`; 340px makes the arena one column.
`body` has `min-width: 320px` and `overflow-x: hidden`; long values rely on `overflow-wrap:
anywhere` (`.mono`, `.pot-num`, `.odds dd`, `.cat-id`) and the history table scrolls inside itself
(`.history { display: block; overflow-x: auto }`). Menus are capped at
`min(320px, 100vw - 32px)`. Checked in Chromium at 320, 390 and 1440 with full addresses, the
open account menu and the no-wallet hint rendered; other widths were not measured.

## Elevation & Depth

Flat tonal layers: page `--bg`, panel `--bg-panel`, nested `--bg-panel-2`. Borders are hairlines
from `--line` / `--line-strong`; the only shadow is the 2px gold ring on the winning fighter
(`.fighter.winner`). Overlays: `.overlay` is a fixed `rgba(0,0,0,.8)` scrim at `z-index: 30`,
menus sit at 10, the skip link at 20. No gradients, no border-plus-shadow combinations.

## Shapes

`--radius` 14px for panels, cards and the dialog; `--radius-sm` 8px for buttons, fields, menus,
notices and admin items; pills (`999px`) for the badge, chips and progress bars; circles for
portraits and the timer. Side cards and fighters carry a 3px top border in their accent.

## Components

- **Buttons** (`.btn` in `styles.css`, used everywhere): 44px minimum height, 600 weight, border
  `--line-strong`. Variants: `.btn-primary` lime for the single main action of a panel, `.btn-warn`
  gold for the network switch, `.btn-red` / `.btn-blue` for the two sides, `.btn-ghost`
  transparent for secondary actions. Disabled is 50% opacity with `not-allowed`. `.icon-btn` and
  `.link-btn` are underlined text buttons (Copy, Replay). Focus is a 2px lime outline on every
  control (`:focus-visible`).
- **Header** (`components/Header.tsx`): brand, TESTNET badge, and the wallet control. States:
  Connect (primary), connector menu when several injected or WalletConnect connectors exist,
  no-wallet hint popover (`.menu`, `role="status"`), connected short address (`.btn-ghost`),
  "Wrong network" (`.btn-warn`). `NetworkGate` is the banner (`.gate`) with the single
  "Switch to Sepolia" control, reused inside the account menu as `SwitchButton`.
- **Panel** (`components/common.tsx`): section with an h2 and optional right-aligned aside; every
  secondary block (claims, history, trade, owner) is one.
- **Notice** (`common.tsx`): `.notice`, `.notice-warn`, `.notice-error` (`role="alert"`).
- **TxStatus and inline `.tx` lines**: `.tx-pending` gold, `.tx-ok` lime, `.tx-error` red with
  `role="alert"`; each transaction shows checking, confirm-in-wallet, sent, confirmed or the
  failure text, plus an explorer link when a hash exists.
- **AddressLink** (`common.tsx`): mono address (short or `full`), explorer link and Copy button;
  inside `.about-addrs` it becomes a flex row where the address wraps and Copy stays beside it.
- **Fields and chips**: `.field` label-over-input (44px inputs), `.field-sm` for short values,
  `.chips` / `.chip` / `.chip-on` for quick amounts and direction.
- **History table** (`components/History.tsx`): `.history`, 13px, left-aligned, `nowrap` cells,
  horizontal scroll inside the panel; unsettled rows leave Seed and Link empty.
- **Arena pieces** (`components/Arena.tsx`): `.cat` side cards with `Portrait` (inline SVG from
  the verbatim art), `.odds` and `.stats` definition grids, `.timer` ring, `.pot`, `.tug` share
  bar, `.bet` form, `.action` rows.
- **Replay dialog** (`components/Overlays.tsx`): `.overlay` + `.dialog`, fighters with HP bars,
  scrolling log, result block; HP transitions are removed under `prefers-reduced-motion`.

## Do's and Don'ts

- Start a new block as a `Panel` inside `main`; keep one h2 per panel and one `.btn-primary`.
- Use `.hint` for explanations and put them next to the control they explain, not in a hero.
- Pick the action style by consequence: lime for the main step, gold for fixing a prerequisite,
  red/blue only for choosing a side, ghost for the rest. Keep actions disabled until the wallet is
  connected on the right chain and the contract state allows them.
- Show long values with `.mono` or `overflow-wrap: anywhere`; never ellipsize an address.
- Do not add a font, a fourth weight, a seventh size, a new accent colour, shadows on panels or an
  em dash in copy.
- Recipe for another page: copy `index.html`'s head (title, description, og tags, favicon), mount
  `Header` + `NetworkGate` + `main`, add `Panel`s with `.field`, `.btn` and `.tx` lines, read
  config through `useConfig()` from `imd-deployment.json`, and keep all styling in `styles.css`
  using the tokens above.

# lota.tools — Design & UX Guidelines

The single reference for how the lota web client **looks, behaves and is built**. Read it before touching any
user-facing screen, and keep it updated when a new pattern is introduced. The goal: anyone (human or
AI) can pick up a page and continue **in the same style and with the same behaviour** without guessing.

**This document is normative, not descriptive.** Where the product does not yet follow a rule, the rule still
stands and the gap is tracked in `docs/UX_AUDIT.md` (findings carry IDs such as `X1`, `M3`, `F2`). When you
touch a screen, move it toward these rules; never copy a violation because "the screen next door does it".

| Part | Covers |
|---|---|
| **I. Visual system** (§1–§13) | Tokens, primitives, components, motion, storefronts, per-app skins |
| **II. UX guidelines** (§U0–§U20) | Who we design for, information architecture, screen archetypes, lists, forms, feedback, mobile, speed, copy, a11y, audit method |
| **III. Roles, data access, sensitive actions** (§R) | What the UI must hide, mask or re-authenticate |
| **IV. Engineering conventions & decisions** (§E) | Layouts, i18n, CSS, SSR, server layer, working agreements |

Stack: Nuxt 3 · @nuxt/ui (v1, `UModal`/`USlideover`/`UButton`…) · Tailwind · Iconify (`lucide:*`).
Shared styles live in `assets/css/` and are all registered in `nuxt.config.ts → css`:
`surface.css` (platform primitives, header, footer, switch skin), `storefront.css` (public tenant storefronts),
`atrace.css` (workspace kit: `.at-*`, modals), `console.css` (`.cn-*`), `contacts.css` (re-skin of generic Tailwind blocks inside
`.ct-scope` / `.at-modal`), `issues.css` (kanban). Modal ui presets: `utils/atraceUi.ts`; per-app brand gradients: `config/apps.ts`.

# Part I — Visual system

---

## 1. Design philosophy

The look is **"bezel / pill / brand-gradient"**: soft, rounded, layered, calm. Think machined
hardware with a glass plate sitting in a tray, not flat boxes with 1px grey borders.

1. **Layered surfaces.** Containers are nested: a hairline outer tray holds a lighter inner core
   (double bezel). Flat cards on a flat background are the exception.
2. **Pills and circles over rectangles.** Buttons, chips, filters, search, nav items — all fully
   rounded. Cards use big radii (1.4–2rem).
3. **One brand gradient** (blue → emerald) carries emphasis. Everything else stays quiet and neutral.
4. **Soft, diffused shadows** and hairline rings (`inset 0 0 0 1px …`) instead of harsh drop shadows
   and solid borders.
5. **Calm, physical motion.** Springy cubic-bezier easing, tiny translate/scale, transform+opacity only.
6. **Neutral dark theme.** Dark mode is gray, not navy (see §3).
7. **Never break function for style.** A redesign changes templates/classes/CSS; handlers, data flow,
   SEO markup (`time`, `dl`, JSON-LD) and routes stay as they were.

### Hard rules (learned the hard way)

- **Never use black / near-black as an accent** (active pills, selected filters, primary buttons).
  Use the brand gradient or a soft blue tint. Neutral surfaces stay neutral.
- **Active header/nav item = plain light blue** (`rgba(37,99,235,.12)`, text `#1d4ed8`). No gradient there.
- **No raw `<input type="color">`** in user-facing UI. Always a curated palette (`ColorSwatch.vue`,
  `BRAND_COLORS` in `utils/color.ts`).
- **No dashed placeholder tiles** or generic blue-50 boxes for "see all" actions — use a pill link
  (`.sec-link`) in the section header.
- **Don't use Tailwind `aspect-square/video/auto`** — they generate no CSS here (nuxt/ui plugin
  clobbers the scale). Use inline `style="aspect-ratio: …"`.
- **Switches are never restyled by button rules.** The global skin lives in `surface.css` (`button[role="switch"]`: gradient track on,
  grey track off, white knob). A checked `UToggle` carries `bg-primary-500` in its class list, so any `[class*="bg-primary-500"]` button
  rule must add `:not([role="switch"])`, otherwise the padding collapses the knob to 0 width.
- **Match Tailwind tokens with `[class~="…"]`, not `[class*="…"]`** (`*=` also hits `bg-primary-500` when you meant `bg-primary-50`).
- **Never apply a blanket `padding-left` to inputs**: leading-icon inputs (`ps-9`) lose their icon gutter. Exclude `[class*="ps-"]`/`[class*="pl-"]`.
- **Overlays dim with neutral black** (`rgba(0,0,0,.6)`), never a slate/navy tint: in the dark theme a tinted dim is lighter than the page.
- **A strip that scrolls must never end in a hard cut.** A row of tabs/chips/cards that scrolls sideways (or a list that scrolls
  vertically inside a fixed box) and ends mid-element looks broken — people think the content was clipped by a bug. Give the
  scrolling edge a soft haze that dissolves into the background, and only on the side that still has hidden content: add
  `v-scroll-fade` (`.y` for vertical) to the scroll container (`plugins/scrollFade.ts`, `.scroll-fade` in `surface.css`). It
  needs no extra markup and does not hide anything when everything fits. Use it with `no-scrollbar` rows (`.at-seg` tab strips,
  `.pill-filter` rows, card scrollers). Data tables keep their real scrollbar instead.
- **Dashed "empty slot" tiles** are rewritten globally to a soft ring tile inside `.at-scope`/`.at-modal`; don't add new ones.
- **Don't rely on Tailwind classes inside server-rendered HTML strings** (`server/api/publications/*`,
  `api/publications.ts`): they are not scanned. Use inline `style` there.

---

## 2. Tokens

### Colour

| Role | Light | Dark |
|---|---|---|
| Page background | `#f6f6f7` / white | `#141414` |
| Surface (card) | `#fff` | `#1a1a1a` (core) / `#1f1f1f` (storefront card) |
| Tray (bezel outer) | `rgba(15,23,42,.04)` + 1px ring `.06` | `rgba(255,255,255,.05)` + ring `.08` |
| Soft fill (rows, lists) | `rgba(15,23,42,.03)` + ring `.07` | `rgba(255,255,255,.04)` + ring `.08` |
| Text strong | `#0f172a` / `gray-900` | `#fff` / `#f5f5f5` |
| Text body | `#334155` / `gray-600` | `#d4d4d4` |
| Text muted / label | `#94a3b8`, `#64748b` | `#737373`, `#a3a3a3` |
| Brand blue | `#2563eb` | `#60a5fa` (text/tints) |
| Brand emerald | `#10b981` | `#6ee7b7` (text) |
| **Brand gradient** | `linear-gradient(90deg, #2563eb, #10b981)` (135° for tiles) | same |
| Soft blue tint (active) | bg `rgba(37,99,235,.12)`, text `#1d4ed8` | bg `rgba(96,165,250,.18)`, text `#bfdbfe` |
| Success | text `#047857`, bg `rgba(16,185,129,.14)` | text `#6ee7b7`, bg `rgba(16,185,129,.18)` |
| Rose (favourites) | `#f43f5e` | same |

Dark theme: overlays are `white/5–10%` on `#141414/#1a1a1a`. Never navy (`#0b1220`-style) or
blue-tinted greys.

### Radius scale

| Use | Radius |
|---|---|
| Pills, chips, buttons, inputs, nav items | `9999px` |
| Bezel outer / big sheets | `2rem` (core = `calc(2rem − 0.4rem)`) |
| Cards, soft lists | `1.4–1.75rem` |
| Rows inside a list tray | `1.2rem` |
| Icon tiles | `0.7–1rem` |
| Bottom sheets / side sheets | `2rem` (sheet) · `2.25rem 2.25rem 0 0` (storefront footer) |

Inner radius = outer radius − padding (concentric curves). A row inside a `p-1.5` tray with a
`1.6rem` outer radius gets `~1.2rem`.

### Spacing & rhythm

- Page content width: `max-w-7xl mx-auto px-4`. Public storefronts: `max-w-3xl`-ish centred column.
- Section vertical rhythm: `py-10`–`py-24` on landing-style pages; `gap-6`/`gap-8` inside pages.
- Trays pad `0.4rem` (`p-1.5`), cards `p-5`/`p-6`, sheets `p-5`.
- Mobile: 16px gutter (`px-4`), no horizontal page scroll, controls ≥ 36px tall.

### Typography

- Font: the project font (see `assets/css/fonts.css`). Headings are heavy and tight.
- Page/section title: `font-extrabold tracking-tight`, `1.4rem` for section heads (`.sec-title`),
  `text-xl–2xl` in cards, `text-3xl+` on heroes.
- Body: `text-sm`/`text-[0.9375rem]`, `leading-6`/`1.7` for prose.
- **Eyebrow / label:** `0.6875rem`, uppercase, `letter-spacing .1–.16em`, weight 600, muted colour
  (`.eyebrow` pill, `.sf-label` plain).
- Brand word accent: `.grad-text` (gradient-clipped text) — use sparingly, e.g. "lota **Гид**".
- Numbers in prices/steppers: `tabular-nums`.

### Shadows

- Resting card: `inset 0 0 0 1px rgba(15,23,42,.07), 0 1px 2px rgba(15,23,42,.04), 0 18px 36px -26px rgba(15,23,42,.2)`.
- Floating (header, sheets): large blur, negative spread, low alpha (`0 10px 30px -14px rgba(15,23,42,.25)`).
- Coloured glow only on brand CTAs: `0 12px 28px -12px rgba(37,99,235,.65)`.
- Dark mode: drop soft shadows, rely on the 1px white/8–10% ring.

---

## 3. Dark theme

- Toggle via `.dark` on `<html>` (nuxt color-mode). Every new style needs a `.dark` counterpart.
- Surfaces: page `#141414`, bezel core `#1a1a1a`, storefront card `#1f1f1f`, inputs `white/6%`.
- Dividers/rings: `rgba(255,255,255,.08–.12)`.
- Active/selected: soft blue tint (`rgba(96,165,250,.14–.2)`) with `#bfdbfe` text — **never** white-on-black inversion.
- Always screenshot both themes before calling a screen done.

---

## 4. Shared primitives (`assets/css/surface.css`)

| Class | What it is | Notes |
|---|---|---|
| `.bezel` + `.bezel-core` | Double-bezel card. Outer tray `p-0.4rem` radius 2rem; core is the content surface. | Add `.bezel-hover` for lift (`translateY(-4px)`). Put content in the core, `overflow-hidden` for media. |
| `.cta-pill` `--primary` / `--ghost` | Pill button with room for a nested arrow circle. Primary = brand gradient + glow; ghost = neutral. | `padding: .45rem .45rem .45rem 1.5rem`. For block buttons that sit beside `.pl-active`, add `.pl-btn` (same box). |
| `.cta-arrow` | Circle holding the arrow, flush right inside a CTA. On hover it nudges `translate(2px,-1px) scale(1.06)`. | Needs a `.group` parent or `.cta-pill`. Tint override: `!bg-blue-500/10`. |
| `.eyebrow` | Tiny uppercase pill above headings. | One per hero/section at most. |
| `.icon-tile` | Gradient square (blue→emerald) holding a white icon. | Use `!h-9 !w-9 !rounded-xl` for section heads. |
| `.grad-text` | Gradient-clipped text. | |
| `.hero-mesh` | Soft radial blue/emerald/indigo glow behind heroes (masked fade). | Decorative, `pointer-events-none`. |
| `v-reveal` (plugin `plugins/reveal.ts`) | Fade-up once on scroll via IntersectionObserver. Optional delay: `v-reveal="120"`. | transform/opacity only. SSR-safe. |
| `.pill-filter` `--active` `--rose` | Filter chip. Active = brand gradient (never black). Rose = favourites. | |
| `.catalog-panel` | Rounded panel wrapper for catalog pages. | |
| `.no-scrollbar` | Hides scrollbars on horizontal chip rows. | |
| `v-scroll-fade` / `.scroll-fade` | Soft haze on the scrolling edge of a strip (only where content is hidden), so it never ends in a hard cut. Required on every `no-scrollbar` scroller. | `plugins/scrollFade.ts` |
| `.sec-head` `.sec-title` `.sec-link` | Section header: icon tile + title on the left, soft-blue pill link ("Все новости →") on the right. | Used on home/hub news + feed. |
| `.hdr-*` | App header (floating glass pill): `hdr-shell`, `hdr-item(--on/--off)`, `hdr-lang-group`/`hdr-lang`, `hdr-cta`, `hdr-chip`, `hdr-avatar`, `hdr-icon-btn(--solid)`. | See §6. |
| `.mm-*` | Mobile burger sheet: `mm-list`, `mm-row(--on/--off)`, `mm-ico`. | Teleported → must stay global. |
| `.gw-*` | Guide side widget (`gw-card`, `gw-row`, `gw-tour`, `gw-open`, `gw-prose`, …). | Teleported → global. |
| `.profile-*` | Catalog profile sheet. | Teleported → global. |
| `.fd-search` | Feed search input. | |
| `.pl-*` | Tariffs/bundles: `pl-toggle`, `pl-save`, `pl-card(--featured)`, `pl-ribbon`, `pl-check`, `pl-active`, `pl-btn`, `pl-ns`, `pl-table`. | |

### The double bezel, concretely

```html
<article class="bezel bezel-hover group">
  <div class="bezel-core overflow-hidden">
    <!-- media -->
    <div class="p-5">…</div>
  </div>
</article>
```

Outer tray: hairline ring + tiny padding. Inner core: lighter surface, inner top highlight,
big diffused shadow. Radius of core = outer − padding.

### Outline pill (`.pill-outline`)
Transparent pill with a `1.5px` brand-blue hairline ring and blue text; hover = faint blue tint + stronger ring. Use it for **secondary
"add / create" actions that sit next to filter chips or tabs** (e.g. "+ Добавить маршрут" beside the route chips) and for any
"second-tier" action that must not look like a filled button or a neutral chip. Hierarchy of pills: gradient `.cta-pill--primary` /
`.at-btn--primary` (the one main action) → `.pill-outline` (secondary add/create) → soft-blue `.at-btn--blue` (navigation/neutral
actions) → neutral `.at-btn` / `.pill-filter` (filters, tabs). Never replace an outline action with a filled soft-blue one.

### Soft list in a tray (menus, FAQ, settings rows)

A `1.6rem` rounded soft-fill tray (`.gw-card` / `.mm-list`) with `0.4rem` padding; rows inside are
`1.2rem`-rounded buttons: transparent by default, `rgba(15,23,42,.05)` on hover, soft-blue tint
when active/open. Each row leads with a tinted icon tile (`2–2.2rem`, radius `.7–.8rem`,
blue icon on `rgba(37,99,235,.09)`).

---

## 5. Components & patterns

### Buttons
- **Primary:** `.cta-pill--primary` (brand gradient, white text, coloured glow). One per view/card.
- **Secondary:** `.cta-pill--ghost` or soft-blue pill (`.sec-link`, `.gw-open`).
- **Icon button:** round 2–2.25rem, `rgba(15,23,42,.05)` fill (`.hdr-icon-btn`, `.gw-icon-btn`); solid variant = soft blue.
- **Success / done state:** `.pl-active` (green tint, check icon) — same box size as the CTA it replaces.
- **Press feedback:** `:active { transform: scale(.96–.98) }`. Hover on primaries: `translateY(-1px)` + stronger glow.
- Disabled: opacity `.4–.5`, no transform, `cursor-not-allowed`.

### Cards
- Content card = bezel (public/marketing/feed) or `.sf-card` (storefronts) or `.gw-card` (soft tray).
- Media cards: image on top inside the core, category pill overlaid top-left (`bg-white/90`, dark: `bg-black/60`), inset ≥ `0.75rem` from the corner so it clears the radius.
- Hover: lift (`-3/-4px`), image `scale(1.03)` over `700ms` with the spring curve.
- Footer of a card: author avatar (`.hdr-avatar`) + "Читать" + `.cta-arrow`.

### Filters, chips, toggles
- Filter chips: `.pill-filter`; active = brand gradient with white text.
- Any chip/tab row wider than its box scrolls sideways **with `v-scroll-fade`** — a faded edge says "there is more"; a hard cut says "broken".
- Segmented toggle (Month/Year, language): pill group on a soft fill; selected segment = white pill
  with tiny shadow (dark: `white/14%`).

### Inputs & search
- Pill-shaped, `1px` hairline ring, **no browser outline** (`outline:none` + our own focus ring:
  `inset 0 0 0 1.5px brand + 0 0 0 4px brand/16%`). Search icon inside, clear button hidden natively.
- Nuxt UI inputs inside storefronts are re-skinned in `storefront.css` (rounder, brand focus).

### Modals / sheets / slideovers
- **Teleported content does not get scoped styles.** Anything inside `UModal`/`USlideover` must be styled
  by global classes (surface.css), or wrap content in an element carrying the scope. Re-apply
  CSS variables (e.g. `--brand`) on the wrapper inside the sheet.
- Side sheet (Guide): white / `#1a1a1a`, `sm:rounded-l-[2rem]`, `ring-1 ring-black/5 dark:ring-white/10`,
  header with logo + round close button, scroll body `px-5`.
- Bottom sheet (burger, storefront): `rounded-[2rem]`, `pb-2 px-2` gutter from the screen edge, drag handle `.sf-handle`.
- Close button always top-right, round icon button.

### Section headers
Icon tile (gradient, `2.25rem`) + `.sec-title` left; optional `.sec-link` pill right. No dashed
"see all" tiles.

### Empty / loading / error
- Empty: centred muted icon + one line of muted text inside a soft tray; no dashed borders.
- Loading: spinner icon in muted/brand colour, or skeleton with soft-fill blocks.
- Images that fail: neutral placeholder block with a muted lucide icon (`newspaper`, `image`); never a broken-image glyph.

### Iconography
- `lucide:*` via `<UIcon>`/`<Icon>`. Sizes: `h-4 w-4` inline, `h-[18px]` in tiles/buttons, `h-5–6` in headers.
- Icons sit in tinted tiles; colour = brand blue on `rgba(37,99,235,.09)` (dark: `#93c5fd` on `white/8%`).

---

## 6. Navigation

### App header (`components/ui/AppHeader.vue`, shared by every section)
- A **floating glass pill**: `fixed top-3 left-2 right-2`, fully rounded, `backdrop-blur(18px) saturate(1.6)`,
  translucent white (dark `rgba(26,26,26,.8)`), hairline ring + soft shadow. Never an edge-to-edge
  sticky bar glued to the top.
- Nav items: rounded pills, muted text, hover `rgba(15,23,42,.06)`; **active = plain light blue**.
- Right side: language group (segmented), CTA (`.hdr-cta`, brand gradient), user chip with avatar.
- Mobile: logo left; round help (`life-buoy`) and burger (`menu`, soft-blue solid) buttons right.
  Burger opens a **bottom sheet** (`.mm-*`): title "Приложения", round close button, apps in a soft tray,
  each row = tinted icon tile + label; active row soft-blue, unavailable rows muted.

### Guide (`/guide`, widget)
- Pages: product nav, category and article views with `.gw-prose`-like typography, a "back" pill, scroll
  reset to top on entry (`plugins/guide-scroll.client.ts`).
- Widget (slideover): tour CTA card (brand gradient), FAQ accordion in a soft tray (rows transparent,
  open row soft-blue), product list, "Open guide" soft-blue pill at the bottom.

---

### Footer (`components/ui/AppFooter.vue`, `.ft-*`)
- `full` = rounded sheet (`2.25rem` top corners, `#fff` / `#1a1a1a`, hairline ring) that sits **flush with the bottom edge**: it
  cancels the layout's `pb-safe-or-4` with a negative bottom margin and re-adds the safe-area as its own padding. Don't add
  extra bottom padding after it.
- Brand block (logo, tagline, round social buttons `.hdr-icon-btn`), three link columns with micro-caps titles (`.sf-label`)
  and pill-hover links (`.ft-link`), bottom bar with copyright + soft-blue email pill (`.sec-link`). Mobile: brand and legal
  span two columns, products/resources side by side, rows kept tight.
- `minimal` = one hairline strip with `.ft-chip` links. All links keep `target="_blank"` on purpose.

## 7. Motion

- **Easing:** `cubic-bezier(0.32, 0.72, 0, 1)` everywhere (spring-like). Never `linear`/`ease-in-out`
  for UI movement.
- **Durations:** hover/press `0.3–0.5s`; card lift/arrow `0.6–0.7s`; image zoom `0.7s`; reveal `0.8s+`.
- **Allowed properties:** `transform`, `opacity` (plus colour/background/box-shadow for states). Never
  animate `width/height/top/left`.
- **Scroll reveal:** `v-reveal` (fade-up + slight blur resolve). Use for page sections and card grids; stagger with delay.
- **Hover micro-physics:** buttons `translateY(-1px)`; nested arrow circle drifts diagonally; list rows
  `translateX(2px)`.
- **Press:** `scale(.96–.98)`.
- Backdrop blur only on fixed/sticky chrome (header, overlays) — never on scrolling content.
- Respect `prefers-reduced-motion` for any new looping animation.

---

## 8. Public storefronts (`/to/:namespace/*`, `assets/css/storefront.css`)

Menu, memberships, plans and their order/booking tracking pages. **Every tenant brings its own colours**,
so the system is driven by CSS custom properties set on the page root (and re-set on every teleported
sheet, e.g. the `sf-fields` wrapper):

| Var | Meaning |
|---|---|
| `--brand` | Tenant **primary** colour — the *background/fill* colour (hero band, buttons, chips, steppers). |
| `--brand-ink` | Readable text colour **on** `--brand` (`getContrastTextColor`). |
| `--brand-fg` | Tenant **accent** colour for text/icons/selection **on neutral surfaces** (icons in tinted tiles, soft buttons, selected option ring, prices). For Menu = `secondaryColor`. For Plans/Memberships (single colour) = `readableOnLight(primary)`. |

Rules:
- **Fills use `--brand` + `--brand-ink`. Text, icons and "selected" outlines on white/grey use `--brand-fg`.**
  Never put the pale primary on a white card as an icon/text colour — it vanishes.
- Derive tints with `color-mix(in srgb, var(--brand…) N%, transparent)`; no hard-coded colours.
- Pages share building blocks: `StorefrontTopBar`, `StorefrontHero`, `StorefrontFooter`, `.sf-card`,
  `.sf-option`, `.sf-chip`, `.sf-btn(--soft/--block)`, `.sf-search`, `.sf-qty`, `.sf-step-btn`.
- Hero: brand-coloured band with big rounded bottom corners, logo tile, name, pills (address, phone) in
  `--brand-ink` at 14% tint.
- Item cards: image with badges inset `top-3 left-3` (clears the radius), floating round "+" button
  half-overlapping the photo, price in accent colour.
- Selection rows (`.sf-option`): neutral until selected; selected = accent ring `2px` + accent 10% tint;
  radio/checkbox fills with accent.
- Always test with a **pale** brand colour (white/yellow/mint) and a **dark** one.
- `/to/:ns/plans` is a public route (allow-listed in `middleware/auth.global.ts`).

---

## 9. Feed, news, articles

- Feed card (`HomePostsFeed`): bezel, image header with category pill, date · read-time, title
  (`text-xl–2xl font-extrabold`), excerpt, tags (`#tag` pills), footer with avatar + "Читать" + arrow.
- News on home/hub (`HomeNewsSection`): two-column bezel cards, `.sec-head` with "Все новости" pill.
  Components in `components/ui/` are **not** auto-resolved by their short name — import explicitly
  (`HomePostsFeed`, `HomeNewsSection`, `UserAvatar`, `EmptyState`).
- Article page: card in a tray, large title, byline block, typography for headings/lists/quotes/images,
  "continue reading" in the same card style.
- Gated ("exclusive") blocks inside articles are produced server-side as HTML: **inline styles only**,
  CTA = brand-gradient pill with white text.

---

## 10. Tariffs & bundles (billing)

- Billing toggle = `.pl-toggle` pill segmented control with `.pl-save` badge.
- Plan/bundle card = `.pl-card`; featured (`start`) gets a `2px` blue ring (`--featured`); `.pl-ribbon`
  for "N days free"; `.pl-check` bullets; big price; connect button `.cta-pill .pl-btn` (same box as
  `.pl-active` "Подключено!").
- Comparison tables = `.pl-table` (rounded `2rem`, neutral header in dark mode).
- Logic is sacred here: only restyle blocks. Never change subscribe handlers or disabled-state logic.

---

## 10a. lota A-Trace (`assets/css/atrace.css`, `.at-*`)

First product workspace restyled in the new system — use it as the template for the other apps (Issues, Menu, Contacts, Goods, Plans).
Rules: **UX and logic untouched**, only chrome changes.
- Page header: `.at-title` (1.5rem/800) + `.at-sub`; actions as pills: `.at-btn` (neutral), `--blue` (soft blue), `--amber` (upgrade), `--primary` (brand gradient, one per view). Keep `data-tour` attributes.
- Tabs/filters: `.pill-filter` chips (active = brand gradient); segmented section tabs `.at-seg` / `.at-seg__btn(--on)` (scrolls horizontally, no scrollbar); view toggles `.pl-toggle`.
- Entity cards (locations): `.at-post` (+ `--on` = brand gradient with white text); "add" tile `.at-post-add` (soft blue, dashed look avoided). Leave bottom padding on horizontal scrollers so shadows are not clipped. **Cards that contain buttons/dropdowns must not move on hover/press** (no `transform`): the shift between mousedown and mouseup retargets the click to the card ("first click selects, second clicks the button"), and a transformed ancestor also breaks `position: fixed` dropdown popovers (they get clipped). Use shadow/ring changes for hover instead.
- Panels / stats / rows / chips: `.at-panel`, `.at-h2`, `.at-stat`, `.at-row`, `.at-chip`; money/score highlights use `.grad-text`.
- Tables: `AppTable` has a `soft` prop → `.at-tray` (rounded tray, micro-caps header, hairline rows, soft footer). Pass `soft` for every product table; legacy callers keep the old look until restyled.
- Banners: `.at-banner` (soft blue). Empty states: `.at-empty.at-panel`.
- Employee check-in flow (`atrace/qr`, `atrace/recorded`, public `to/:ns/atrace/post/:id`): single rounded `2rem` card on a neutral page, pill buttons, no gradient page backgrounds.
- `PinPrompt` is the reference for small input modals: icon tile + title, pill input, ghost + gradient pill actions.
- Semantic status colours inside data (emerald ok / red problem / amber late / blue geo) stay, but badges are pills.
- **Modals recipe (all A-Trace modals):** `<UModal class="at-modal" :ui="{ ...atModalUi }">` + `<UCard :ui="{ ...atCardUi }">` (`utils/atraceUi.ts`: `2rem` radius, generous `px-7/8` header/body/footer padding so content clears the rounded corners — when you round more, **pad more and widen the modal**). `.at-modal` globally skins the teleported content: pill inputs/selects (`rounded-full`, textareas `1.2rem`), pill buttons, **solid-primary UButton → brand-gradient pill**. Footers use `flex flex-wrap justify-end` so long labels wrap on mobile.
- `AppTable soft` is content-height (`max-h-full`), not stretched to the container — no big empty white area under short tables.
- Segmented period/view filters → `.pill-filter`; analytics KPI cards → `.at-panel`; inner mini-tiles → `.at-row` / `.at-stat`.
- Still to restyle in A-Trace: fine details of a few rarely-opened modals (`RouteModal` list rows, `PostRecordsDetails`, `UserAttendanceDetails`) — they already inherit the modal recipe.

## 10b. Page shells, layouts and landing pages

- Layouts (`layouts/`): `default`, `full`, `quiet`, `workspace`. All render the floating `AppHeader`, then
  `<main class="pt-20 …">` (top padding clears the floating pill — never remove it), then `AppFooter`
  (`variant="full"` on `full`/`default`, `"minimal"` on `quiet`/`workspace`). Marketing/catalog/guide/feed pages use
  `definePageMeta({ layout: 'full' })`; app workspaces use `workspace` (page roots are `h-full` and scroll internally).
  Public storefronts opt out (`layout: false`) and own their whole shell (`.sf` root, `min-h-screen`, own scroll).
- Page background in layouts is `bg-white dark:bg-gray-900` where `gray` is the neutral scale (`app.config.ts`:
  primary = `blue`, gray = `neutral`) — keep it neutral, never retint.
- **Landing-style pages** (home, product landings): hero = `.hero-mesh` glow + `.eyebrow` + oversized heading with one
  `.grad-text` word + one primary and one ghost `.cta-pill`; below, sections at `py-14 md:py-24` made of bezel cards /
  asymmetric bento (`col-span` mix collapsing to one column on mobile). Reveal every section with `v-reveal`.
  Use real product screenshots/mocks inside bezel cores rather than stock imagery.
- **Settings-like pages** (e.g. `/people`): compact title (not hero-sized), content in bezel/soft trays, two-column
  where it helps; no decorative eyebrow labels that add nothing ("КОМАНДА"-style tags were rejected).
- Public back-navigation: a small round/pill "back" control (`.sf-back`, or the Guide's back pill), never a bare link.

## 10c. Forms, inputs, selects, tabs

- Text fields: pill (single line) or `1.2–1.4rem` radius (textarea, `.sf-textarea`), hairline ring, brand focus ring,
  `outline: none`. Labels use `.sf-label`-style micro-caps or `text-sm font-semibold`; helper text `text-xs` muted.
- Choice rows (radio/checkbox/modifier lists): neutral `.sf-option`/`.pl-ns` rows that become ringed + tinted when
  selected; the control glyph fills with the accent colour. Never a native bare radio.
- Segmented controls / tabs: pill group on a soft fill (`.pl-toggle`, `.hdr-lang-group`); selected segment = raised white
  pill (dark: `white/12%`). Product/category tabs use `.pill-filter` chips.
- Validation: error text `text-xs text-red-600 dark:text-red-400` under the field; danger rings use red at low alpha.
  Don't colour whole fields red.
- Phone fields use `PhoneInput.vue`; colour fields use `ColorSwatch.vue` (curated palette only).
- Required Nuxt UI inputs/selects inherit the global skin; when a page needs it rounder, override by class on a
  wrapper (`.sf-fields …` pattern) instead of editing `app.config.ts` per page.

## 10d. Feedback: modals, confirms, toasts, banners, badges

- **Modals (`UModal`)** — centred dialog recipe: `rounded-2xl` (or `rounded-[2rem]` for large), overlay
  `bg-gray-900/30 dark:bg-gray-950/60 backdrop-blur-sm`, card `bg-white/90 dark:bg-gray-900/85 backdrop-blur-xl`
  (modal chrome is allowed to blur — it is fixed, not scrolling content), `ring-1 ring-black/5 dark:ring-white/10`,
  header = title + round close button, footer = ghost "Cancel" + primary action pill. Width presets: `sm:max-w-sm`
  confirms, `max-w-lg` forms, `max-w-3xl` complex editors. Long content scrolls inside the body, header/footer stay.
  Prefer the shared `ConfirmDialog` + `useConfirm` for confirmations (colours: `red` destructive, `primary` neutral,
  `amber` warning — tinted icon tile + title + text + two pills).
- **Sheets**: side (`USlideover`, desktop) and bottom (mobile) — see §5. Same tray/row/tile vocabulary inside.
- **Cookie notice** (`CookieNotice`, `.ck-*`): small quiet glass pill at the bottom (`1.25rem`, 11px text, hairline ring), one line + underlined link + neutral soft pill "Хорошо". **No accent colours, no icon tile** — a notice must not compete with the page (owner feedback: "too accent").
- **Toasts** (`useToast`): styled globally via `app.config.ts` (rounded-3xl, white/90 + hairline, small title/description,
  primary-colour action). Use short, neutral sentences; success = green icon, error = red icon. Never custom-built toasts.
- **Banners / inline notices**: soft tinted pill-rounded blocks (`rounded-2xl`), tint = blue (info), green (success),
  amber (warning), rose/red (error); icon tile on the left, one line + optional action link. No full-saturation alerts.
- **Status badges**: tiny pills (`px-2.5 py-1 text-xs font-semibold rounded-full`) with tinted bg + darker text of the same
  hue (blue info / emerald ok / amber pending / rose problem / slate neutral); dark = `/18%` bg with `-300` text.
- **Destructive affordances**: neutral until hover, then red tint (`rgba(239,68,68,.1)`, text `#dc2626`; dark `#f87171`)
  — see `.profile-logout`. Never a permanently red big button unless it is the confirm step of a destructive flow.

## 10e. Tables & data views

- Wrap tables in a rounded tray (`.pl-table` look: `2rem` radius, hairline ring, soft shadow, `overflow-hidden`).
  Header row: muted micro-caps on a soft fill (neutral in dark — never the brand colour); rows separated by `rgba(15,23,42,.06)`
  hairlines; hover row = soft fill; numbers `tabular-nums` right-aligned.
- Use `AppTable`/`Table` as the base and re-skin via wrapper classes rather than forking.
- Mobile: tables become stacked cards or scroll horizontally inside the tray (`overflow-x-auto no-scrollbar`) — never overflow the page.
- Pagination/filters sit above the tray as `.pill-filter` chips + a pill search; pager buttons are round icon buttons.
- Charts: soft tray, brand-blue→emerald palette for series, muted gridlines, no 3D/shadows.

## 10f. People, avatars, identity

- User avatar: round, brand-gradient background with initials (`.hdr-avatar` 1.75rem, `.profile-avatar` 3.25rem, ring/glow on
  large ones); photo avatars use the same circle with `object-cover`. Use `UserAvatar.vue`.
- Tenant/business logos: rounded-square tile (`.sf-logo`, radius ≈ 1.2–1.6rem) on white with a thin ring.

## 10g. Content & copy

- UI language: ru is the most complete; every user-visible string goes through `useI18n()` (`t('key') || 'fallback'`) and must
  exist in `locales/ru.json`, `en.json` and `kk.json`. No hard-coded Russian/English in templates (except fallbacks).
  Don't add terminology that contradicts the neutral vocabulary (catalog, item, spot, customer, executor — not
  "menu/dish/table/guest" in generic screens).
- Product names: **lota** (lowercase), "lota Гид", app names as in `config/apps`. Russian UI term for bundles = «готовая сборка».
- Tone: short, plain, friendly; verbs on buttons ("Подключить", "Читать", "Посмотреть"); no exclamation spam
  (one positive confirmation like "Подключено!" is fine).
- Money via the shared formatters (`formatMoney`), dates localised (`ru-RU`), never raw ISO.

## 10h. Accessibility & robustness

- Interactive cards: `role="button" tabindex="0"` with Enter handler, or real `<a>/<button>`; icon-only buttons need `aria-label`.
- Visible focus: rely on the brand focus ring / `focus-visible`; never remove focus without replacing it.
- Contrast: text on brand fills uses `--brand-ink`; text/icons on neutral surfaces use ≥ 3:1 colours (use `--brand-fg` on storefronts).
- Respect `prefers-reduced-motion` for looping/auto motion; no motion is required to understand a screen.
- Touch targets ≥ 36px, spacing for thumbs, safe-area padding at the bottom (`pb-safe-or-4`).
- Images: always `alt`, `width/height` set to avoid layout shift, `loading="lazy"` except above-the-fold (first card `eager`),
  graceful fallback block on error.
- SSR: data that should be in the first paint goes through `useAsyncData`; anything touching `window`/timers goes in `onMounted`
  (watch for `setInterval` leaks on the server).

## 10j. Console and Contacts (`console.css`, `contacts.css`)

- **Console** (`/console/*`): `.cn-head` (hairline header), `.cn-card` (module cards), `.cn-ico`; tables use `.at-tray`,
  panels `.at-panel`, modals `at-modal` + `atModalUi`/`atCardUi`.
- **"My stats"** (`/atrace/me`): salary hero (`.me-hero`), SVG attendance ring, weekday chips, month cards, check-in timeline.
- **Contacts** (`/ns/contacts/*`) is re-skinned with *no markup rewrite*: page roots carry `at-scope ct-scope`, every `UModal`
  carries `class="at-modal" :ui="atModalUi"` (+ `UCard :ui="atCardUi"`), and `contacts.css` turns the generic Tailwind blocks
  (bordered `rounded-lg`/`rounded-xl` boxes, soft/solid `UButton` as `<button>` **and** `<a>`, raw inputs) into the pill/hairline look.
  Soft button selectors use `[class~="bg-primary-50"]` (token match) because `*=` also matches `bg-primary-500`.
- Natural-height pages inside the `workspace` layout (`new`, `[id]`, list) must be `h-full overflow-y-auto`, otherwise their content
  spills under the footer. A table that scrolls itself inside `.at-tray` needs the `keep-scroll` class.

## 10i. Process for redesigning a page (what we actually do)

1. Read the page + its child components; list the logic that must not change (handlers, queries, SEO, routes).
2. Rewrite the **template and styles only**, reusing §4 primitives; add new prefixed classes to `surface.css` (global when
   anything is teleported).
3. Seed realistic local data to see real states (empty, long titles, no image, many items).
4. Screenshot **light, dark, and 390px mobile**; compare against neighbouring pages for consistency.
5. Run a **production build** and hit the real route before pushing; stop `nuxt dev` first, restart after.
6. Commit only your files; commit message describes the redesign; **no Claude/Co-Authored-By attribution lines**.
   Standing instruction from the owner: push to `main` as each step finishes (after the production build + route check); don't watch
   the deploy afterwards unless asked — report the commit hash. Never commit foreign local edits (`api/menu/**`, `locales/*.json`, others' WIP).
7. Responsive check before calling a page done: 390px and 320px (no horizontal page scroll, headers don't collide with CTAs), 768px, dark theme.

## 10k. Issues (`issues.css`)

Same recipe as Contacts/Menu: page roots carry `at-scope ct-scope`, every modal is `class="at-modal" :ui="atModalUi"`
+ `UCard :ui="atCardUi"` (board settings cards use `{ ...atCardUi, body: { padding: 'p-5' } }`), tabs are `.at-seg`,
tables are `AppTable soft`. Kanban: `.is-col` (1.75rem soft ring column, status tint kept from `columnColorClass`),
`.is-col__head`, `.is-card` (1.25rem ring card, hover lifts with a brand ring, overdue = red ring). Board picker tiles
are `.bezel .bezel-hover` + `.icon-tile`. Pitfall fixed here: raw `rounded-md` inputs with a leading icon (`ps-9`) must
not get the blanket `padding-left: 1rem` from `contacts.css`.

## 10l. Goods, Plans, shared modals, Console, responsive rules

- Goods / Plans / Console pages follow §10j–§10k: root `at-scope ct-scope`, modals `at-modal` + `atModalUi`/`atCardUi`, tabs `.at-seg`, tables `AppTable soft`.
- Shared dialogs (`ConfirmDialog`, `Modal`, `PinPrompt`, `StaffRoleModal`, `TourGuide`) use the same skin; destructive confirm is `.at-btn--danger` (red gradient, never black).
- Dashed "empty slot" tiles are rewritten globally (`.at-scope/.at-modal .border-dashed`) to a soft ring tile.
- Tour spotlight dim is neutral black (`rgba(0,0,0,.62)`): a slate tint is lighter than the dark theme and the dim disappears.
- Responsive: back buttons inside `flex-col` headers need `self-start`; page headers with a CTA need `min-w-0` on the text block and an icon-only CTA below `sm`; floating decorative chips only from `xl`; popups cap their width to `viewport - 32px`.

## 10m. Motion speed, loading, pending states, media (2026-10-10)

- **Motion is 2x faster than the original spec.** Tailwind's `duration-*`/`delay-*` scale is halved in `tailwind.config.ts`
  (`duration-300` = 150ms) and every CSS `transition`/`animation` duration was halved. New code: use the Tailwind scale or half of
  the old numbers (`.15–.35s`), never the old `.4–.9s` values. Ambient loops (spinners, floating chips, shimmer) keep their rhythm.
- **Loading = skeletons, not spinners.** `components/ui/AppSkeleton.vue` (`variant`: `list`, `table`, `cards`, `kanban`, `panel`,
  `stats`; `rows`, `cols`) renders the shape of what is loading; the shimmer is `.sk*` in `surface.css`. `AppTable` shows skeleton
  rows on first load; page/section loaders use `<AppSkeleton>` inside the original `v-if="loading"`. A spinner is only for
  in-place actions (upload overlay, button `loading`).
- **Pending clicks show a spinner on the clicked element:** Google sign-in buttons (`utils/loginPending.ts` marks the clicked button
  with `data-login-pending`) and header app items (`.hdr-item` gets `data-nav-pending` until `page:finish`,
  `plugins/login-click.client.ts`). CSS in `surface.css` swaps the icon for a spinner.
- **Tables with a pagination footer must fill the available height with flex** (`flex-1 min-h-0` on the table wrapper, scroller
  `flex-1 min-h-0`) — a fixed `max-h-[calc(100vh-…)]` pushes the footer under the page fold (contacts table lost its pager that way).
- **Domains never live in the database.** Uploads store `/api-<svc>/media/…` (`utils/mediaUrl.ts → toStoredMediaPath`); absolute URLs are
  built on the fly from the current origin (`absoluteMediaUrl`, e.g. og:image); legacy rows with a host are rewritten on read
  (`utils/legacyMedia.ts`, applied in `ApiClient.request`).
- **Reads retry on 502/503/504** (backoff ~10s, `ApiClient.request`); mutations are never retried.

## 11. Writing a new screen — checklist

1. **Archetype:** pick the container (bezel / soft tray / storefront card) and the layout (bento, split,
   single column). Don't invent a new card style if one above fits.
2. **Compose with primitives** from §4. Prefer adding a small prefixed class group (`.xx-*`) to
   `surface.css` over long Tailwind chains repeated in many places.
3. **Dark mode:** add `.dark` rules for every new colour.
4. **Teleported UI** (UModal/USlideover/dropdowns): global styles, not `<style scoped>`.
5. **Colours:** brand gradient for emphasis, soft blue for active, neutral for the rest; **no black accents**.
6. **Motion:** spring easing, transform/opacity only, `v-reveal` on sections.
7. **Responsive:** check 390px. Collapse multi-column to one, keep `px-4`, no horizontal scroll, tap targets ≥ 36px.
8. **Icons:** lucide, tinted tiles, no thick default sets.
9. **Imports:** explicit imports for components under `components/ui/` subfolders.
10. **Verify:** run the page in light + dark + mobile, then a **production build**
    (`npm run build` + serve) before pushing — dev mode has missed real crashes. Stop `nuxt dev`
    before building, restart afterwards.
11. **Don't touch generated files**; don't commit unrelated working-tree changes (e.g. other people's
    `locales/*.json` edits).

### Anti-patterns (instant rejection)

- Black/near-black accent surfaces, white-on-black inversion for "active".
- Generic `1px solid gray` boxes, `shadow-md` stock shadows, harsh dark drop shadows.
- Edge-to-edge sticky header glued to the top.
- Dashed "empty slot" tiles; blue-50 boxes with blue-500 text as the default "info" look.
- `linear` / `ease-in-out` transitions; animating layout properties.
- Raw `<input type="color">`; hand-picked colours instead of the curated palette.
- Tenant primary colour used as text/icon colour on white (use `--brand-fg`).
- Scoped styles for teleported content.
- Navy/blue-tinted dark theme.

---

## 12. Where things live

| Thing | Path |
|---|---|
| Platform primitives & feature groups | `assets/css/surface.css` |
| Storefront system | `assets/css/storefront.css` |
| Scroll-reveal directive | `plugins/reveal.ts` |
| Guide scroll reset | `plugins/guide-scroll.client.ts` |
| App header + burger sheet | `components/ui/AppHeader.vue` |
| Guide widget / pages | `components/guide/*`, `pages/guide/**` |
| Catalog family | `components/catalog/*`, `pages/{catalog,stores,memberships,services}.vue` |
| Storefront blocks | `components/storefront/*`, `components/menu/storefront/*`, `pages/to/[namespace]/**` |
| Feed / news | `components/ui/{HomePostsFeed,HomeNewsSection,FeedSidebarWidget}.vue`, `pages/{feed,news}.vue`, `pages/[category]/[slug].vue` |
| Billing UI | `components/billing/*`, `pages/[namespace]/bundles.vue` |
| Colour helpers | `utils/color.ts` (`getContrastTextColor`, `readableOnLight`, `BRAND_COLORS`) |

### Design-system files (quick map)

| Need | Use |
|---|---|
| Modal / slideover skin | `class="at-modal"` + `:ui="atModalUi"` (modal) or `:ui="{ ...atCardUi }"` (card) from `utils/atraceUi.ts` |
| Page root of a workspace screen | `at-scope ct-scope h-full flex flex-col p-4 pb-safe-or-4 min-h-0` |
| Section tabs | `.at-seg` + `.at-seg__btn(--on)`; filters `.pill-filter(--active)` |
| Buttons | `.at-btn`, `--blue`, `--amber`, `--primary` (one per view), `--danger` (destructive confirm) |
| Panels / rows / stats | `.at-panel`, `.at-row`, `.at-stat`, `.at-chip`, `.at-banner` |
| Tables | `AppTable soft` (`.at-tray`; self-scrolling tables add `keep-scroll`) |
| Loading placeholder | `<AppSkeleton variant="list\|table\|cards\|kanban\|panel\|stats" :rows="n" />` |
| Cards with brand icon | `.bezel` + `.bezel-core` + `.icon-tile`; per-app gradient via `appIconStyle(key)` (`config/apps.ts`) |
| Kanban | `.is-col`, `.is-col__head`, `.is-card` (`issues.css`) |

## 13. Current state of the design (2026-10-10)

**Language:** bezel / pill / brand-gradient, neutral gray dark theme, motion at 2x speed, skeleton loaders, spinner feedback on pending
clicks. Every user-facing screen of the web client is in it, including the former "not yet redesigned" block (product landing pages,
shared dialogs, onboarding wizards, QuickSetup, EmptyState, Console).

| Area | State | How it was checked |
|---|---|---|
| Home, hub, burger menu (coloured per-app tiles), header (pending spinner), footer | Done | light + dark + 390px |
| Public: catalog, stores, memberships, services, feed, news, guide, landing pages, Chekalka | Done | light desktop, selected dark/mobile |
| Public storefronts `/to/:ns/{menu,plans,memberships}` | Done (own storefront system, §8) | light desktop, images crawled on prod |
| A-Trace, Menu, Contacts, Issues, Goods, Plans (pages, settings, all modals) | Done | light + dark + 390px; modals opened one by one |
| Console (home, billing, analytics, namespaces, team, publications, guide admin + editors) | Done | light + dark + 390px |
| Shared dialogs (Confirm, Modal, PinPrompt, StaffRole, nickname, ContactUs, PhoneRequired, Downgrade, Renewal), onboarding tour, wizards | Done | Confirm/Pin/tour rendered; ContactUs/PhoneRequired/Downgrade/Renewal/wizards compile, not rendered |
| Loading states | `AppSkeleton` in ~60 places; kanban + board cards rendered | delayed-API screenshots |
| Pagination | Contacts table fixed (flex fill); Menu/A-Trace/Goods footers verified in view | Playwright footer-visibility probe |
| Responsive | No horizontal page overflow at 320 / 390 / 768 on 37 routes | Playwright overflow scan |

**Known gaps (honest list)**
- Not visually verified: Issues *Automations* slideover (button hidden for the test tenant), Zen Mode with real tasks, publications
  editor with real content, the four shared modals listed above and both onboarding wizards.
- Dark and 390px were reviewed on contact sheets of key routes plus targeted modals, not on every single screen.
- Skeletons were only seen rendered for the kanban and board cards; other variants were not caught mid-load.
- Entity colour palettes (Plans service/brand, task types) still include a near-black swatch — a data colour the owner picks, not a UI accent.
- Some table columns are intentionally wider than a phone and scroll inside their tray (orders, goods, attendance).

**Data / backend notes that affect the UI**
- Media URLs in the DB are path-only. On 2026-10-10 36 legacy rows (`https://lota.kz|lota.tools/api-*/media/…`) in goods, menu, hub catalog
  and plans were rewritten through the postgres bastion (old values: scratchpad `media-url-backup-2026-10-10.json`); the client still
  strips a stored host on read as a safety net.
- Plans/Goods `getToken` must go through `ensure()` (sets the in-memory client token); returning the bare cookie made requests go out
  without the app header after a full page reload.
- `capital-gtw` still crashes occasionally with the `x/net` HPACK panic (also present in v0.60); the client retries reads on 502/503/504
  but that only hides short restarts.

---

# Part II — UX guidelines

## U0. Who we design for

The primary user is an **employee of a small business** (cashier, courier, dispatcher, storekeeper,
administrator, manager) using lota several hours a day, often one-handed on a phone, often in a hurry,
often interrupted by a customer. Secondary users: the owner (setup, money, reports) and the end
customer on a public page.

Consequences that drive every rule below:

- **Frequency beats novelty.** Optimise the 20 actions done 100 times a day, not the 200 done once.
- **Interruption is normal.** Work must survive a phone call, a tab switch, a dropped connection.
- **Mistakes are cheap in real life, so they must be cheap here.** Prefer undo over "are you sure".
- **Nobody reads.** Labels, position and shape carry the meaning; paragraphs do not.
- **Roles differ.** A cashier must not see the owner's settings; an owner must not dig through the
  cashier's screens to see the day.

---

## U1. Principles

1. **One screen, one job.** A screen has a single primary question ("what needs doing now?", "who is
   this client?"). Everything else is secondary, collapsed, or elsewhere.
2. **Show the next action.** After every state the user must see what to do next, without thinking
   (empty state CTA, "next step" button on a record, success toast with a follow-up).
3. **Minimum clicks, maximum context.** Reaching any frequent object takes ≤ 2 interactions from the
   app home; creating a frequent object takes ≤ 3 (open → fill required fields → save).
4. **Recognition over recall.** Show options, recent items, and defaults; do not make people remember
   codes, ids, or what a button did last time.
5. **Direct manipulation.** Edit where the thing is shown (inline, in a side panel) rather than
   navigating to a separate "edit page" and back.
6. **Forgiveness.** Undo, drafts, confirmation-only-for-the-irreversible, clear recovery from errors.
7. **Honest state.** The UI always says what is happening: loading, saving, saved, offline, failed,
   stale. Never a silent no-op, never an optimistic lie that is not rolled back.
8. **Consistency is a feature.** The same thing looks and works the same everywhere (see §U14).
9. **Phone is a first-class client.** Every flow is completable at 390 px with one thumb.
10. **Fast is a UX property.** Perceived speed (skeletons, optimistic updates, instant navigation)
    matters as much as actual speed.

---

## U2. Information architecture

### 2.1 Three levels, no more

```
Platform  →  Hub (all apps of a namespace) → App workspace → Object
```

- **Hub** is a launcher: apps the user can use, what needs attention in each (badges), recent
  objects. It is not a dashboard of everything.
- **App workspace** has a top-level section bar (`.at-seg`) of **at most 6 sections**, ordered by
  frequency of use, not alphabet. The first section is the daily work screen ("Orders", "Board",
  "Register", "Calendar"). Reports and Settings are always last, in that order.
- **Object** (an order, a client, a task) opens in place (side panel / detail route), never as a deep
  new top-level section.

### 2.2 Where things go

| Content | Home |
|---|---|
| Things done many times a day | First section; also a primary button on the app home |
| Things a manager looks at daily/weekly | "Reports" section, with period presets |
| Rare configuration | "Settings" section, grouped, never mixed with daily work |
| Account / billing / team of the namespace | Console, never inside an app |
| One-off setup | Onboarding checklist that disappears when done |

### 2.3 Navigation rules

- **MUST:** the user always knows where they are: active section highlighted, page title says the
  place (and the object for detail views), the browser title matches.
- **MUST:** every URL is a place. Reload, back, forward and "copy link" all land on the same screen
  with the same filters, tab and selected object. State that defines "what I am looking at" (tab,
  filters, search, sort, open record, page) lives in the **route query**, not in component memory.
- **MUST:** detail views have a visible **back** control that returns to the *same list state* the
  user came from (filters, scroll, page preserved).
- Cross-app links are first-class: a task shows its client; a client shows their orders; an order
  shows the stock it consumes. Linked things are links, with a hover/preview where cheap.
- Breadcrumbs only where depth ≥ 3. Otherwise title + back is enough.
- Never strand the user: a dead end (empty, forbidden, not found, expired) always offers the one
  most likely way out.

### 2.4 Global search & jump

Every workspace has one search entry point for "find the thing by what I remember" (name, phone,
number). Shortcut `/` or `⌘K` focuses it. Results are grouped by type and open the object directly.
Lists additionally have a local filter bar; the two do not duplicate each other's job.

---

## U3. Screen archetypes

Every screen is one of these. Pick one; do not invent a seventh.

### 3.1 Work list (the daily screen)

Header: **title · short subtitle · primary action (right)**. Under it, in this order:

1. **Status strip** — counts that double as filters (`.at-stat` tiles that are clickable): "New 4 ·
   In progress 7 · Overdue 2". The user sees what needs attention without opening anything.
2. **Filter bar** — search (pill), 2–4 `.pill-filter` chips for the most-used dimensions, "More
   filters" for the rest, saved views if the list is used by several roles.
3. **The list** — table on desktop, cards on phone (see §U9).
4. **Footer** — pagination or infinite load, total count, export (secondary).

Rules:
- Default sort puts **what needs action first** (overdue, new, unpaid), not oldest-first.
- Default filter is the **user's own working set** ("Mine", "Today", "Open"), never the entire
  history. An "All" option is one click away.
- A row shows: identity (what it is), state (badge), the one or two facts needed to decide
  (date, amount, assignee), and the next action. No more than ~6 columns visible by default; the
  rest via column picker.
- Clicking the row opens the object. Row-level quick actions (call, mark done) are separate hit
  targets that do **not** open the object.
- Selecting rows reveals a bulk-action bar (§U6.4).

### 3.2 Board (kanban / calendar / timeline)

- Same header and filter bar as a work list; the board replaces only the list.
- Dragging is never the only way: every card has a menu / detail action that does the same.
- Column headers show counts and a quick-add `+`.
- Cards show ≤ 4 facts; open on click into the same detail panel the list uses.
- Empty columns say what they are for ("Nothing in progress").

### 3.3 Detail (object view)

- Opens in a **side panel or a route with back**, same content either way.
- Top: identity + **state + the primary next action** ("Mark paid", "Accept", "Call"). The next
  action is the biggest control on the card.
- Middle: facts in labelled groups, editable in place. Frequently-needed facts first.
- Bottom/side: **activity timeline** (what happened, who, when) with a composer for comments/files.
- Related objects are listed and linked (client → orders, order → items → stock).
- Destructive and rare actions live in an overflow menu, never beside the primary action.

### 3.4 Create / edit form

See §U5. One-sentence rule: **ask for the minimum, default the rest, save without leaving context.**

### 3.5 Report / analytics

- Period presets in one tap ("Today · 7 days · Month · Custom"), remembered per user.
- Headline numbers first (3–5 tiles), then one chart, then the table that explains it.
- Every number is explainable: click-through to the rows behind it.
- Export (Excel/print) is a visible secondary action. Auto-refresh; no manual "Refresh" button as
  the way to see current data.

### 3.6 Settings

- Grouped under human headings ("Working hours", "Notifications", "Roles"), 5–7 groups per page,
  each saves independently with its own confirmation, or one sticky save bar for the page — not a
  mix.
- A setting says **what it changes for the user**, in one line, next to the control. Technical
  names never appear.
- Dangerous settings (delete, reset, change owner) are at the bottom, in their own "Danger" group.
- A setting that is the *first thing a new tenant must do* is surfaced by onboarding, not buried.

### 3.7 Focus / field mode (Zen, POS, check-in)

Full-screen, one task at a time, thumb-reachable controls at the bottom, large targets (≥ 48 px),
no navigation chrome, works with unstable network, instant feedback. These screens are the most
important on the platform; they deserve the most testing on real devices.

---

## U4. Lists, search, filters, sorting

- **Search** is instant (debounced ~250 ms), searches the fields people actually remember (name,
  phone, number, barcode), highlights nothing fancy, and is **forgiving** (case, spaces, phone
  formats, ё/е). It never requires pressing Enter on desktop. `Esc` clears.
- **Filters** show their current state as chips and a count ("Filters · 3"); "Reset" is always one
  click and visible whenever any filter is active. A filtered list never looks like a broken list:
  when 0 results because of filters, the empty state says so and offers "Reset filters".
- **Sorting** is by clicking column headers (desktop) or a sort chip (phone); the active sort is
  visible. Sort and filters persist in the URL and per-user memory for that list.
- **Pagination vs infinite load:** pages for tables a person navigates by position (stock, history);
  infinite/"load more" for feeds and timelines. Always show how many exist ("1–50 of 1 240").
- **Counts** are cheap and honest; if a count is expensive, drop it rather than show a wrong one.
- **Saved views** are for lists shared by roles; the user's last used view is the default.
- **Recently used** surfaces at the top of any picker (client picker, product picker, assignee).

---

## U5. Forms and data entry

### 5.1 Structure

- **MUST:** required fields are the minimum to make the record useful. Everything else is optional
  and may sit under "More details" (collapsed by default).
- Order fields in the order the user *thinks* of them (who → what → when → how much), not the order
  of the database.
- One column on phone; at most two on desktop. Group with headings, not boxes within boxes.
- **MUST:** every field has a visible label (placeholder is an example, not a label). Optional
  fields are not marked; required ones are, once, in a consistent way.
- Use the right control: segmented/chips for ≤ 5 choices, picker with search for many, date/time
  pickers with sensible presets ("Today", "Tomorrow", "+1 h"), number steppers for quantities,
  `PhoneInput` for phones, `ColorSwatch` for colours. Never a free-text field for something that has
  a fixed set of values.
- **Defaults** are the most common value for *this* user: last used, current user, today, the
  tenant's currency, the default warehouse. A pre-filled form that is right 80% of the time is the
  single biggest speed-up we have.
- **Inline creation:** if a picker cannot find what the user needs ("client not found", "product not
  in catalog"), it offers "Create «<typed text>»" in place, in a nested dialog that returns the new
  item to the picker. No forced navigation away from a half-filled form.

### 5.2 Validation and errors

- Validate **on blur** and on submit, never on every keystroke (except password strength-type
  helpers). Never block typing.
- Message sits under the field, says **what to do**, not what is wrong ("Enter a phone like
  +7 700 123 45 67", not "Invalid format").
- On failed submit, scroll to and focus the first invalid field; if the form is long, show a summary
  line at the top of the submit area.
- Server errors are translated to a human sentence and keep the user's input intact. A raw code,
  `Internal Server Error`, `null`, or an untranslated key is a bug.
- Duplicate protection: when a likely duplicate exists (same phone, same SKU), say so with a link to
  the existing record and let the user choose, instead of failing.

### 5.3 Saving

- **MUST:** the user always knows if the data is saved. Either explicit save with a clear button +
  success toast, or autosave with a persistent "Saved · 12:41" indicator. Never both, never neither.
- Primary action label is a verb + noun ("Create order", "Save client"); never "OK" / "Submit".
- The primary button shows a spinner and is disabled while the request runs (prevents double
  submit); the form stays visible until success.
- After create: land the user where they will want to be next — usually the new object, with the
  "next action" visible; offer "Create another" for high-volume entry (stock receipt lines, clients
  at an event).
- **Drafts:** long forms (order, receipt, document, article) keep a local draft keyed by form and
  record; reopening restores it with a "Restore draft / Discard" notice. Leaving a dirty form asks
  once (route guard + `beforeunload`), and **only** if it is dirty.
- `Enter` submits single-purpose forms; `Esc` closes dialogs (with dirty-guard); `⌘/Ctrl+Enter`
  submits multi-line forms.
- Keyboard order matches visual order; first field is autofocused on desktop (not on phone, to avoid
  the keyboard covering the form).

### 5.4 Dialogs vs panels vs pages for forms

| Use | When |
|---|---|
| **Dialog** (`UModal`) | ≤ 6 fields, one decision, returns to the same screen (add note, change status, confirm) |
| **Side panel / slideover** | Viewing + light editing of an object while keeping the list visible |
| **Full page** | Long or multi-step creation (order with items, receipt, onboarding), things with their own URL |
| **Inline** | One value changed often (quantity, status, assignee, price) |

Dialogs never stack more than one level deep. A "dialog opens a dialog" is allowed only for inline
creation from a picker (§U5.1) and must return the user to the parent with the new value selected.

---

## U6. Actions, feedback and recovery

### 6.1 Action hierarchy

Per view: **one** primary (brand gradient), a few secondary (soft), the rest in an overflow `…`
menu. The primary action matches the screen's job ("New order" on the orders list; "Accept payment"
on an unpaid order). Never two primaries, never a primary that is destructive.

### 6.2 Feedback ladder

Match the weight of the feedback to the weight of the event:

| Event | Feedback |
|---|---|
| Toggle, inline edit, quantity change | The control itself updates instantly; no toast |
| Create / save / send | Toast (≤ 4 s) naming the thing: "Order #1042 created" + link/action "Open" |
| Slow operation (> 1 s) | Button spinner, then progress text for > 5 s ("Importing 340 / 1 200") |
| Background result (import, export, sync) | Persistent notification entry, toast with "Open" |
| Recoverable error | Inline message at the cause + "Try again" |
| Blocking error (no access, plan limit) | Full explanation + the way out ("Upgrade plan", "Ask owner") |

- A success toast that says only "Success" or "Done" is a bug: name the object.
- Toasts never carry the only copy of important information (ids, links) for less than ~6 s.
- Plan limits are shown **before** the user hits them (usage meter, "9 of 10 used"), and the limit
  message offers the exact action to resolve it.

### 6.3 Undo beats confirm

- **Reversible** actions (archive, status change, move, remove a line item, mark done): **do it
  immediately and show "Undo" in the toast** for ~8 s. No confirmation dialog.
- **Irreversible or externally-visible** actions (delete forever, send to customer, charge money,
  merge records, cancel a paid order): confirm with `ConfirmDialog`. The dialog names the object
  and the consequence ("Delete client «Anna K.»? Their 12 orders stay, the card is removed.") and its
  confirm button repeats the verb ("Delete client"). Never "Yes/No".
- Prefer **soft delete / archive** over hard delete wherever business logic permits.
- Bulk destructive actions state the count and require typing nothing, but show what will happen to
  related records.

### 6.4 Bulk actions

Selecting ≥ 1 row shows a sticky bar: count · 2–4 most useful actions · "Clear". "Select all"
offers "all on this page" vs "all N matching the filter". Results report partial failure honestly
("18 updated, 2 failed — Show").

### 6.5 State changes (workflows)

Orders, tasks, payments, bookings are state machines. The UI:
- shows the current state as a badge **and** the available next transitions as buttons, in the
  order the process normally goes;
- never offers a transition that will be rejected (hide or disable with a reason tooltip);
- allows going back one step where the business allows it, with an audit trail;
- collects required data *at the transition* (price at "Price agreed", reason at "Cancel"), not on
  a separate screen.

---

## U7. Feedback of system state

- **Loading:** `AppSkeleton` in the shape of the content on first load; keep previous content
  visible while refreshing (stale-while-revalidate), with a subtle indicator. A blank screen or a
  centred spinner on a content page is a bug.
- **Empty:** three flavours, each different:
  1. *First-use empty* — explains the value + the primary CTA ("Add your first product") + a link to
     the guide/import.
  2. *Filtered empty* — "Nothing matches" + "Reset filters".
  3. *Cleared empty* ("all done") — positive, brief, no CTA noise.
- **Error:** says what failed, whether data is safe, and offers "Try again". Distinguish: no network
  (offline banner, queued actions), server error (retry), no access (who can grant it), not found
  (link to the list).
- **Offline / flaky network:** field screens (POS, check-in, Zen) must queue or retry and tell the
  user. Everyone else gets a quiet offline banner and disabled write actions, not mystery failures.
- **Stale data:** when another person changes the open object, show "Updated by Anna — Refresh"
  rather than silently overwriting or silently going stale. Never overwrite someone's edit without
  a conflict message.
- **Real-time:** lists that several people work on (orders, tasks, bookings) update live; the
  change is highlighted briefly so the eye finds it.

---

## U8. Onboarding and first run

- A new tenant gets a **setup checklist** per app (3–6 steps: "Add a location", "Invite staff",
  "Create first order"), each step a deep link into the exact place, ticking off automatically, and
  disappearing when complete. Not a modal wall, not a video.
- **Templates over blank pages:** offer ready-made starting points (board templates, catalog
  import, sample data) with one click to remove.
- Contextual **hints** appear once, at the moment they matter, are dismissible forever, and never
  block the UI. The product tour is opt-in and re-launchable from help.
- Terminology: neutral vocabulary in generic screens (catalog, item, spot, customer, executor);
  industry words only where the tenant chose them.
- Permissions: a user who cannot do something sees **why and who can** ("Only managers can change
  prices"), not a missing button with no explanation, unless the feature is irrelevant to their
  role entirely (then hide it).

---

## U9. Responsive and touch

- **Phone is a design target, not a fallback.** Test every flow at 390 px (and 320 px).
- Tables → cards on phone: identity + state + one key fact + the primary quick action; tap opens
  detail. Never a horizontally scrolling page; inner horizontal scroll only inside a tray for
  genuinely tabular data.
- **Primary action reachable by thumb:** on phones, the main CTA of a form/detail is a bottom bar
  (safe-area aware), not a top-right corner link.
- Dialogs become bottom sheets on phone; sheets have a drag handle and a close button.
- Touch targets ≥ 44 px for primary controls (≥ 36 px absolute minimum), ≥ 8 px between neighbours.
- Hover is never the only way to discover or use something (tooltips are supplements; row actions
  are visible or reachable by tap).
- Respect safe areas, avoid fixed elements that cover content or the keyboard, and keep forms
  usable while the on-screen keyboard is open (the focused field is scrolled into view).
- Use native affordances where they win: `tel:`, `mailto:`, `inputmode`, `autocomplete`, camera
  capture for photos, share sheet, installable PWA for field apps.

---

## U10. Speed and efficiency

- **Perceived performance:** navigation is instant (skeleton immediately), optimistic updates for
  cheap reversible actions, prefetch likely next screens, never block the whole page on a secondary
  request.
- **Shortcuts for power users:** `/` search, `N` new, `⌘/Ctrl+Enter` save, `Esc` close, arrow keys
  in lists, `?` shows the cheat-sheet. Shortcuts are additive; every shortcut has a visible button.
- **Barcode/scan-first** where hardware exists (POS, receipts, inventory): the scan field is always
  focused, a successful scan beeps and shows the item, a failed one says why.
- **Repeat work is a feature:** "Duplicate", "Repeat last order", "Create another", templates,
  recent clients — every high-volume object has at least one.
- **Remember** per-user: column choices, page size, last filter, last period, last warehouse/board.
- **Bulk import/export** (Excel/CSV) exists for any object a business has hundreds of, with a
  preview and per-row error report.

---

## U11. Roles, permissions and plan limits

- The UI is **role-shaped**. A cashier's Menu is the order queue; a manager's Menu adds reports; the
  owner's adds settings. The role decides which sections exist, not which buttons are secretly
  disabled.
- Permission failures are explained in the UI **before** the action where known, and with a clear
  message when discovered from the server.
- Plan limits: meter near the relevant create button, a warning at 80%, a specific message at 100%
  with the upgrade action. Never a generic "Error" on a blocked create.
- Impersonation / acting-as modes are visibly marked on every screen while active.

---

## U12. Notifications

- Three levels: **badge** (counts on nav — needs me), **toast** (just happened — informs me),
  **inbox / feed** (history — I can look later). Do not use a toast for something that needs action
  later.
- A notification is actionable: it deep-links to the exact object.
- Users can mute per type. Defaults are quiet: only things that need *this* user.
- Staff alerts (Telegram, push) mirror what would be a badge, never more.

---

## U13. Writing for the UI (UX copy)

- **Buttons:** verb + object ("Add client", "Save changes"). Not "OK", "Submit", "Yes".
- **Titles:** the noun the user is looking at ("Orders", "Client Anna K."), not a sentence.
- **Empty states / hints:** one sentence of value, one action. Second person, present tense.
- **Errors:** what happened → what to do. No blame, no jargon, no codes ("Couldn't save — check your
  connection and try again").
- **Numbers & dates:** locale formatters only (`formatMoney`, localised dates, relative time for
  < 7 days with absolute on hover). Units next to numbers.
- **Status words** are the same everywhere for the same meaning (one vocabulary: "New · In progress
  · Done · Cancelled"). Raw enum values (`VACATION`, `IN_PROGRESS`) must never be visible.
- **Language:** every string via i18n in ru/en/kk; no mixing of languages on one screen; neutral
  vocabulary in generic screens (see §10g).
- Length: labels 1–3 words, hints ≤ 1 line, toasts ≤ 2 lines.

---

## U14. Consistency contract (what must be the same everywhere)

| Concern | The one way |
|---|---|
| Page header | Title + subtitle left, primary action right (`.at-title`, `.at-sub`, `.at-btn--primary`) |
| Section tabs | `.at-seg` |
| Filters | `.pill-filter`, search pill, "Reset" when active |
| Tables | `AppTable soft`; cards on phone |
| Create from list | Primary button top-right; empty state repeats it |
| Row open | Click row → detail; quick actions separate |
| Confirm destructive | `ConfirmDialog` with named object & verb |
| Reversible change | Immediate + Undo toast |
| Success/error | `useToast`, naming the object |
| Loading | `AppSkeleton` of the right variant |
| Empty | `EmptyState` (first-use / filtered / cleared) |
| Dates/money | shared formatters |
| Statuses | shared badge component and vocabulary |
| Back | Round back pill, returns to previous list state |

When you need something not in the table, extend the table (and `DESIGN.md`) rather than inventing
locally.

---

## U15. Accessibility (UX side)

Visual a11y rules are in §10h. UX additions:
- Everything doable with a mouse is doable with a keyboard; focus order follows visual order; focus
  is moved into dialogs and returned on close.
- State is never conveyed by colour alone (badge text/icon accompanies it).
- Announce async results to assistive tech (`aria-live` on toasts, inline errors tied to fields).
- Don't rely on drag, hover, long-press or double-click as the only path.
- Respect reduced motion; no time-limited actions without a way to extend.

---

## U16. The Object Lifecycle Matrix (how we audit every app)

For **each object type** in an app, answer every row. A "no" is a finding.

| # | Question | Check |
|---|---|---|
| 1 | **Find** — how does the user find an existing one? | search, filters, sort, recents, deep link |
| 2 | **See** — what does the list show, and is the "needs attention" visible? | status strip, badges, sorting |
| 3 | **Open** — what is shown in detail, and is the next action obvious? | primary next action, timeline, related |
| 4 | **Create** — steps, required fields, defaults, inline creation, duplicates | ≤ 3 steps, draft, "create another" |
| 5 | **Edit** — inline vs form, who may, concurrent edit | in place, saved-state, conflict |
| 6 | **Change state** — transitions, required data, undo | buttons per state, undo toast |
| 7 | **Remove** — archive vs delete, confirm vs undo, effect on related | soft delete, named confirm |
| 8 | **Bulk** — select, act, export, import | bar, partial-failure report |
| 9 | **Share/print/export** — outputs the business needs | print, Excel, link, message |
| 10 | **Roles** — who sees/does what, explained | role-shaped nav, reasons |
| 11 | **Phone** — completable at 390 px | cards, bottom CTA, targets |
| 12 | **Empty/loading/error/offline** — each designed | per §U7 |
| 13 | **Connections** — links to other objects/apps | clickable, previewed |
| 14 | **First run** — what a new tenant sees | checklist, template, sample |

Plus per app: **the 3–5 jobs-to-be-done** ("take an order and get paid", "check in for a shift")
timed in clicks from the app home. A job with > 7 interactions or any forced detour is a finding.

### Severity scale used in `docs/UX_AUDIT.md`

| Level | Meaning | Examples |
|---|---|---|
| **S1 Blocker** | Prevents a core job, loses data, or misleads about state | lost draft, silent failure, wrong data shown |
| **S2 Major** | Core job possible but slow, confusing or error-prone | extra navigation, no undo for destructive action |
| **S3 Minor** | Friction or inconsistency, workaround obvious | label wording, missing default, odd position |
| **S4 Polish** | Nice-to-have | shortcuts, micro-copy, animation |

Effort: **XS** (< 1 h, copy/class), **S** (≤ ½ day), **M** (1–2 days), **L** (> 2 days / needs backend).

---

## U17. Review checklist (copy into PRs touching a screen)

- [ ] Which archetype (§U3) is this? Does it follow it?
- [ ] Is the primary action obvious and singular?
- [ ] Defaults filled with the most likely value? Inline creation in pickers?
- [ ] Filters/tab/search/selected object in the URL; back returns to the same state?
- [ ] Saved state visible; draft/dirty guard on long forms?
- [ ] Reversible → undo toast; irreversible → named confirm?
- [ ] First-use / filtered / cleared empty states; skeleton; error with retry?
- [ ] Phone at 390 px: cards, thumb-reachable CTA, no horizontal scroll?
- [ ] Roles: reasons shown, irrelevant things hidden?
- [ ] Success/error messages name the object; no raw enums/codes?
- [ ] ru / en / kk strings present; shared formatters used?
- [ ] Keyboard path works; focus managed in dialogs?
- [ ] Added to the audit matrix if it introduces a new object type?

---

## U18. Mobile first-screen budget and the filter pattern

The first screen of a work list on a 390×844 phone must show **content, not controls**: at least the first two
records fully visible without scrolling. Measured against the current product (see `docs/UX_AUDIT.md`), Orders and the
Issues board spend ~60 % of the first screen on header buttons and filters — that is the anti-pattern.

- **Header on phone:** title, one primary action (floating bottom-right `+` or a single gradient pill), and an overflow `⋯`
  holding every secondary tool (reports, settings, external links). Never two rows of equal-weight buttons.
- **Filters on phone:** one row — search field + a single **«Filters · N»** button opening a bottom sheet with the rest;
  quick views (status chips) are one horizontally scrollable row. Branch/assignee/type selectors live **in the sheet**.
- **Records on phone:** a card is ≤ 3 lines — identity (number/name), the one deciding fact (amount/time/assignee), state badge —
  plus the next action. «Key: value» tables of 6 rows per record are not allowed.
- **Create:** on phones the primary create action is thumb-reachable (bottom), never the last control of a filter stack.
- Dialogs become **bottom sheets** with a sticky action bar (summary on the left, primary on the right, above the safe area);
  inside them the usable width is ≥ 92 % of the viewport (no double padding).

## U19. The standard form kit (target architecture)

Forms are built from shared primitives so that Enter, Esc, focus, required marks, errors, saved-state and the keyboard
layout behave identically everywhere. **New forms must use the kit; migrating old ones is tracked in `docs/UX_AUDIT.md`.**

| Primitive | Contract |
|---|---|
| `FormModal` / `FormPage` | Renders a real `<form @submit.prevent>`; Enter submits, Esc closes with a dirty-guard, first invalid field is focused and scrolled into view; sticky footer (cancel = quiet, primary = brand gradient, verb + object label); spinner + double-submit protection; bottom sheet on phones. |
| `Field` | Label **above** the control, `required` as the only way to mark mandatory (one visual), hint, error (`aria-describedby`), optional-by-default; sets `autocomplete` / `inputmode` / `enterkeyhint` from the control type. |
| `MoneyField` / `QtyField` | Decimal keyboard (`inputmode=decimal`), no spinner, no scroll-wheel changes, locale formatting, currency/unit suffix inside the field. |
| `DateField` / `DateRangeField` | Interface-language formatting, presets (Today, Tomorrow, +1 h, 7 days, Month), keyboard entry, native picker only as a fallback. |
| `SegmentedField` | For ≤ 4 options (priority, type, method): one tap instead of two. A dropdown is for ≥ 6 options or searchable data. |
| `ClientPicker` | Phone-first search over Contacts, shows history/last order, «Create "<typed text>"» inline; used by every form that captures a person (orders, bookings, tasks, sales). |
| `SaveBar` / saved indicator | Settings pages: toggles and selects save immediately with a «Saved» chip; text groups show a sticky «Save / Reset» bar when dirty. Inline edits commit on blur with the same chip. One model per screen type (§U5.3). |

Rules that apply even before the kit exists: no placeholder-as-label; no disabled primary button without telling the user
what is missing (highlight the field instead); `PhoneInput` for phones; `ColorSwatch` for colours; never a raw `<select>`.

## U20. Dates, numbers, money and locale

- **Interface language wins.** Format dates, numbers and money with the *app* locale (`ru` / `en` / `kk`), never the browser default —
  a Russian UI on an English browser must not show «Oct 10, 03:02 AM». Use the shared `formatDate`/`formatMoney` helpers and pass the app locale.
- Money is always shown with currency (or in a column whose header names it), with thousands separators and the correct decimals;
  amounts in a table are right-aligned and `tabular-nums`. Never a bare «3000».
- Dates: relative for < 7 days with the absolute value on hover; always include the year when it differs from the current one.
- Phone numbers are displayed in one format (`formatDisplayPhoneUniversal`) and stored normalised.
- Error and toast copy is translated like any other UI string — no English API messages in a Russian interface; map server codes to human sentences.

## U21. Conformance snapshot (2026-10-14)

Honest status of the rules above. Details, evidence and fixes are in `docs/UX_AUDIT.md`.

| Area | Status | Gap IDs |
|---|---|---|
| Visual system (tokens, pills, bezel, dark theme, skeletons) | **Met** | — |
| Primary action hierarchy in page headers | **Gap** — 4–8 equal buttons per header, create is soft/last | X2, X3, M2, I1, C1 |
| Undo instead of confirm; named toasts | **Gap** — 1 of 258 toasts has an action | X1, X11, F9 |
| State in URL, back returns to the same list | **Partial** | X4 |
| Empty states (first-use / filtered / cleared) | **Partial** — one generic message in `AppTable` | X5 |
| Forms: real `<form>`, Enter/Esc, dirty-guard, drafts | **Gap** — 7 `<form>` tags in 98 modals, no `enterkeyhint` | F1, X7 |
| Save model consistency | **Gap** — five different models | F2 |
| Client picked from Contacts, not typed | **Gap** in Menu, Plans, Issues | X6, F18 |
| Mobile first-screen budget | **Gap** in Orders, Issues board, Goods | V3, V4, V9 |
| Date / money / locale formatting | **Partial** | V2, F10, X9 |
| Role-shaped navigation | **Gap** | X15, A1 |
| Notifications / toasts placement and language | **Gap** — toast covers the header, English texts | V1, W4 |
| Error ≠ empty state (never show «nothing here» when loading failed) | **Gap** — error banner and empty state shown together | W1, W2 |
| Navigation never depends on a secondary request | **Gap** — Goods tabs vanish if the role request fails | W3 |
| Accessible names and 36–44 px targets on icon buttons | **Gap** — 63 unlabeled icon buttons on one page | W5 |
| Keyboard shortcuts, global find | **Gap** | X10 |

---

# Part III — Roles, data access and sensitive actions (§R)

The UI never decides who may see data; the **gateway does** (checks live in the gateways, the role comes from the app token).
The UI's job is to *reflect* that decision honestly: hide what is irrelevant to the role, explain what is blocked, never offer a
button that will fail (§U6.5, §U11).

## R1. Personal-data masking by role

| App | Role that does **not** see client PII | What is hidden | Where enforced |
|---|---|---|---|
| Menu | COOK | name, phone, address, client link | `maskedOrder` — the only path that returns an order |
| Issues | VIEWER | name, phone, address, client link | `maskedTask` |
| Plans | MASTER | client phone in a booking (name stays) | `maskedBooking` |
| Contacts | VIEWER (read-only) | phones and e-mail in lists and cards | gateway helpers, `AccessRoleContextKey` |
| Goods | stores no customers as personal data | — | roles limit operations |

UI consequences: masked values render as a neutral placeholder (never as «—» that looks like missing data), `tel:` links and
export buttons for hidden fields are not rendered, and screens must remain usable with masked data (no layout that assumes a phone exists).

## R2. Export and report permissions

| What | Who | Notes |
|---|---|---|
| Contacts → Excel | OWNER, ADMIN (`contacts.client.export`) | button shown by `contactsCan`; data is already masked |
| Menu orders → Excel | OWNER, MANAGER | built in the browser from already-masked rows |
| Menu executor report, Issues daily report | OWNER, MANAGER | enforced by `@menuAuth` / `@issuesAuth` |
| Goods (stock, register) | CASHIER+ for the register, STOCKKEEPER+ for stock, OWNER/MANAGER for management | `@goodsAuth(roles: …)` per field |

## R3. Sensitive actions require a fresh Google sign-in

Telephony settings and saving/deleting an integration (Contacts) need a sign-in **no older than 5 minutes** (`@freshAuth`,
error `REAUTH_REQUIRED`, web shows the «Confirm sign-in» prompt via `ReauthPrompt`). Passwords are not stored; Google is the only
auth. Any new sensitive action follows the same pattern: the prompt appears *in place*, the user's input is preserved, and the action
retries after confirmation.

## R4. Files

Uploads require at least the editor role; links are signed and bound to the namespace. Each app has a storage quota defined by the plan
(`storage_mb`); an upload over the quota is rejected with a human message and an upgrade path — never «internal error».

## R5. Role-shaped UI (rules)

- The role decides which sections **exist**, not which buttons are secretly disabled (§U11).
- If a role cannot do something that is relevant to it, say who can («Only managers can change prices»).
- Impersonation / acting-as modes are marked on every screen while active.
- Plan limits are shown before they are hit (usage meter near the create button; warning at 80 %).

---

# Part IV — Engineering conventions and decisions (§E)

## E1. Working agreements

- **Never hand-edit generated code** (`api/__generated__/`, protoc/gqlgen output); change the source and regenerate (`npm run codegen`).
- Before pushing web: `typecheck` + `vitest` + a **production build served and the real route opened** — dev mode has missed real crashes.
- **Deploy order:** proto → backend → gateway → web. A web release that uses new GraphQL fields must wait until the gateway serving them is live.
- Commits and PR descriptions carry only the owner's authorship — no `Co-Authored-By` or tool-attribution lines.
- New capabilities are **off by default** and enabled by a setting or preset; setup must never require a manager or support (low entry threshold).
- Less important functions may be hidden on mobile rather than crammed in; dark theme and mobile are checked for everything that ships.
- Don't increase infrastructure cost (replicas/resources) without asking.

## E2. Layouts (decided; former ADR-0003)

Layouts are chosen per page with `definePageMeta({ layout })`, never by path regex: `full` (marketing, full footer), `quiet`
(console, bundles and per-app `/plans` pricing, minimal footer), `workspace` (app pages, minimal footer, internal scroll), or
`layout: false` for storefronts, kiosks and field screens that own their shell. A new route **must** pick one explicitly.
`layouts/default.vue` is an unused safety net — do not extend it.

## E3. `emerald-*` utilities render the brand gradient (former ADR-0002)

`assets/css/global.css` overrides every `emerald-*` utility with `!important` so it resolves to the brand gradient. Consequences:
a plain `bg-emerald-600` is **not** solid emerald; solid emerald needs `bg-gradient-to-r from-emerald-500 to-emerald-600`.
Do not remove the overrides in one commit (full visual-regression risk). Migration path: a real `tailwind.config` token (`accent` backed by a CSS
variable + `.brand-gradient`), move screens one by one, delete the overrides when no `emerald-*` remains. Prefer the tokens/primitives of Part I for new work.

## E4. i18n (former ADR-0004)

`useI18n()` is hand-rolled. `t()` falls through **all three locales** and returns `''` only if the key is missing everywhere — so a key
missing from `kk` renders **Russian text** to a Kazakh reader (wrong-language text, not blank UI). Therefore: add every key to `ru`, `en` **and** `kk`;
run `npm run locales:check`; never rely on a blank fallback. Dev should warn when the *primary* locale lacks a key.

## E5. CSS delivery (former ADR-0005)

`experimental.inlineSSRStyles` is `false`: CSS ships as a cached external stylesheet instead of ~200 KiB of inline `<style>` on every page.
Do not re-enable without re-measuring critical CSS.

## E6. The atrace PIN hash (former ADR-0001)

The client sends `MD5(pin)` to `atrace.gtw` because that is the wire format the backend compares against — it is a protocol requirement, **not**
a security control. Do not remove it without a matching backend change (server-side bcrypt/argon2, raw PIN in the request body over TLS, never in a URL/WS query string).

## E7. The Nitro layer (`server/`)

- `server/api/**` — internal BFF endpoints for the few cases that need server logic: analytics proxy (`analytics/collect`, same-origin so ad blockers
  don't drop it), Atrace helpers and the QR WebSocket proxy, client error log, public-publications listing.
- `server/routes/**` — real public URLs: host-aware `robots.txt` and `sitemap.xml` (lota.tools vs. mirror hosts), `l/[code]` deep-link resolver,
  `r/[code]` referral cookie, `publication/*/[filename]` on-the-fly WebP re-encoding (`sharp`, server-only).
- `server/plugins/**` — `deferMapsCss` (Leaflet CSS only where maps render), `forwarded-host` (adds `X-Forwarded-Host` so OAuth redirects and cookies land on the right domain).
- Ordinary backend calls go through `api/clients.ts` (`ApiClient` + per-service clients) to the `/api-<service>/**` proxy rules in `nuxt.config.ts`. Reads retry on 502/503/504; mutations are never retried.

---

# Part V — How we audit UX

Every new or changed screen is checked with the **Object Lifecycle Matrix** (§U16) and the **PR checklist** (§U17). Findings are logged in
`docs/UX_AUDIT.md` with an ID, severity (S1–S4) and effort (XS–L). Audits combine three sources: a **code read** (forms, labels, states),
a **scripted inventory** (field counts, labels, native controls, handlers), and a **real-browser pass** at 1440 px and 390 px in light and dark
themes — locally and on production in read-only mode (mutations blocked at the network layer; never submit forms on production).

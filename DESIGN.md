# lota.tools — Design Guidelines

The single reference for how the lota web client looks and moves. Read it before touching any
user-facing screen, and keep it updated when a new pattern is introduced. The goal: anyone (human or
AI) can pick up a page and continue **in the same style** without guessing.

Stack: Nuxt 3 · @nuxt/ui (v1, `UModal`/`USlideover`/`UButton`…) · Tailwind · Iconify (`lucide:*`).
Shared styles live in `assets/css/surface.css` (platform) and `assets/css/storefront.css`
(public tenant storefronts). Both are registered in `nuxt.config.ts → css`.

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

### Not yet redesigned (candidates, in the same style)

Product landing pages (`components/marketing/ProductLanding.vue`: /issues /menu /contacts /atrace
/goods /plans, plus /chekalka), `AppFooter`, shared modals (`TourGuide`, `ConfirmDialog`,
`ContactUsModal`, `PhoneRequiredModal`, `PinPrompt`, `CookieNotice`), shared `AppTable`/`Card`/`Accordion`,
onboarding (`QuickSetupButton`, `OnboardingWizard`), `/console/*` (low priority). The `lota.tools/ns/{app}`
product workspaces are intentionally out of scope for this redesign.

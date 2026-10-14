# lota.tools — UX Guidelines

How the product **behaves and flows**. Companion to `DESIGN.md`, which defines how it **looks**.
`DESIGN.md` answers "which class do I use"; this document answers "what should happen when the user
does X, and how many steps may it take". Read both before building or changing any screen.

Audience: designers, frontend engineers and AI agents working on the web client. Every rule has a
short "why" and, where useful, a way to check it. Rules marked **MUST** are review blockers.

Scope: the signed-in workspace of every app (A-Trace, Menu, Issues, Goods, Contacts, Plans), Console,
Hub and the public storefronts. Findings against these rules live in `UX_AUDIT.md`.

---

## 0. Who we design for

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

## 1. Principles

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
8. **Consistency is a feature.** The same thing looks and works the same everywhere (see §14).
9. **Phone is a first-class client.** Every flow is completable at 390 px with one thumb.
10. **Fast is a UX property.** Perceived speed (skeletons, optimistic updates, instant navigation)
    matters as much as actual speed.

---

## 2. Information architecture

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

## 3. Screen archetypes

Every screen is one of these. Pick one; do not invent a seventh.

### 3.1 Work list (the daily screen)

Header: **title · short subtitle · primary action (right)**. Under it, in this order:

1. **Status strip** — counts that double as filters (`.at-stat` tiles that are clickable): "New 4 ·
   In progress 7 · Overdue 2". The user sees what needs attention without opening anything.
2. **Filter bar** — search (pill), 2–4 `.pill-filter` chips for the most-used dimensions, "More
   filters" for the rest, saved views if the list is used by several roles.
3. **The list** — table on desktop, cards on phone (see §9).
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
- Selecting rows reveals a bulk-action bar (§6.4).

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

See §5. One-sentence rule: **ask for the minimum, default the rest, save without leaving context.**

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

## 4. Lists, search, filters, sorting

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

## 5. Forms and data entry

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
creation from a picker (§5.1) and must return the user to the parent with the new value selected.

---

## 6. Actions, feedback and recovery

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

## 7. Feedback of system state

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

## 8. Onboarding and first run

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

## 9. Responsive and touch

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

## 10. Speed and efficiency

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

## 11. Roles, permissions and plan limits

- The UI is **role-shaped**. A cashier's Menu is the order queue; a manager's Menu adds reports; the
  owner's adds settings. The role decides which sections exist, not which buttons are secretly
  disabled.
- Permission failures are explained in the UI **before** the action where known, and with a clear
  message when discovered from the server.
- Plan limits: meter near the relevant create button, a warning at 80%, a specific message at 100%
  with the upgrade action. Never a generic "Error" on a blocked create.
- Impersonation / acting-as modes are visibly marked on every screen while active.

---

## 12. Notifications

- Three levels: **badge** (counts on nav — needs me), **toast** (just happened — informs me),
  **inbox / feed** (history — I can look later). Do not use a toast for something that needs action
  later.
- A notification is actionable: it deep-links to the exact object.
- Users can mute per type. Defaults are quiet: only things that need *this* user.
- Staff alerts (Telegram, push) mirror what would be a badge, never more.

---

## 13. Writing for the UI (UX copy)

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
  vocabulary in generic screens (see `DESIGN.md` §10g).
- Length: labels 1–3 words, hints ≤ 1 line, toasts ≤ 2 lines.

---

## 14. Consistency contract (what must be the same everywhere)

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

## 15. Accessibility (UX side)

Visual a11y rules are in `DESIGN.md` §10h. UX additions:
- Everything doable with a mouse is doable with a keyboard; focus order follows visual order; focus
  is moved into dialogs and returned on close.
- State is never conveyed by colour alone (badge text/icon accompanies it).
- Announce async results to assistive tech (`aria-live` on toasts, inline errors tied to fields).
- Don't rely on drag, hover, long-press or double-click as the only path.
- Respect reduced motion; no time-limited actions without a way to extend.

---

## 16. The Object Lifecycle Matrix (how we audit every app)

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
| 12 | **Empty/loading/error/offline** — each designed | per §7 |
| 13 | **Connections** — links to other objects/apps | clickable, previewed |
| 14 | **First run** — what a new tenant sees | checklist, template, sample |

Plus per app: **the 3–5 jobs-to-be-done** ("take an order and get paid", "check in for a shift")
timed in clicks from the app home. A job with > 7 interactions or any forced detour is a finding.

### Severity scale used in `UX_AUDIT.md`

| Level | Meaning | Examples |
|---|---|---|
| **S1 Blocker** | Prevents a core job, loses data, or misleads about state | lost draft, silent failure, wrong data shown |
| **S2 Major** | Core job possible but slow, confusing or error-prone | extra navigation, no undo for destructive action |
| **S3 Minor** | Friction or inconsistency, workaround obvious | label wording, missing default, odd position |
| **S4 Polish** | Nice-to-have | shortcuts, micro-copy, animation |

Effort: **XS** (< 1 h, copy/class), **S** (≤ ½ day), **M** (1–2 days), **L** (> 2 days / needs backend).

---

## 17. Review checklist (copy into PRs touching a screen)

- [ ] Which archetype (§3) is this? Does it follow it?
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

---
name: AGS One
description: Internal employee engagement and rewards platform — where recognition and HR workflows share a wall
colors:
  command-black: "#111827"
  brand-navy: "#2563c4"
  brand-navy-dark: "#1e3a8a"
  canvas: "#f7f8fc"
  surface: "#ffffff"
  border: "#e8eaf2"
  ink: "#111827"
  muted: "#6b7280"
  success: "#059669"
  warning: "#d97706"
  error: "#dc2626"
  amber-surface: "#fffbeb"
  emerald-surface: "#ecfdf5"
typography:
  display:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 600
    lineHeight: 1.25
    letterSpacing: "normal"
  body:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
    letterSpacing: "normal"
  label:
    fontFamily: "Geist, system-ui, -apple-system, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.2
    letterSpacing: "0.01em"
rounded:
  sm: "7px"
  md: "10px"
  lg: "12px"
  xl: "17px"
  2xl: "22px"
  3xl: "26px"
  full: "9999px"
spacing:
  "1": "4px"
  "2": "8px"
  "3": "12px"
  "4": "16px"
  "5": "20px"
  "6": "24px"
  "8": "32px"
components:
  button-primary:
    backgroundColor: "{colors.command-black}"
    textColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "#1f2937"
    textColor: "{colors.surface}"
    rounded: "{rounded.xl}"
    padding: "10px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.muted}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  button-ghost-hover:
    backgroundColor: "{colors.border}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  card:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.2xl}"
    padding: "20px"
  input:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
  nav-item-active:
    backgroundColor: "rgba(255,255,255,0.20)"
    textColor: "{colors.surface}"
    rounded: "{rounded.lg}"
    padding: "8px 12px"
---

# Design System: AGS One

## 1. Overview

**Creative North Star: "The Bulletin Board"**

The bulletin board in the break room is one of the oldest communication surfaces in the workplace. It holds a birthday list next to a compliance notice, a handwritten congratulations card next to a shift schedule. It is simultaneously official and human — and that tension is precisely what AGS One holds.

The interface must be trustworthy enough to present HR data, disciplinary records, and payroll-adjacent point balances; it must also be warm enough that employees open it to see who got a shoutout today. These requirements do not compete. The design resolves them through a single visual commitment: a dark command surface (sidebar, primary CTAs) set against a light, airy content canvas. The command surface says "this is real"; the content surface says "this is yours."

The system does not decorate. Every color has a job — navy for interactive states, emerald for success, amber for pending actions, rose for errors. Gamification elements (points, badges, levels) are earned visual moments, not wallpaper. The interface disappears into the task; delight lives in the details, never in the scaffolding.

**Key Characteristics:**
- Dark `#111827` command surface for sidebar and primary CTAs — clear authority without aggression
- Light zinc-tinted canvas (`#f7f8fc`) that feels clean and office-appropriate
- Navy accent for interactive states, focus rings, and data emphasis
- Semantic color vocabulary: emerald = positive, amber = pending/caution, rose = negative
- Gently curved corners (12–22px) throughout — human, not sharp, not corporate-round
- Flat surfaces at rest; shadow appears only as interaction feedback
- Single sans-serif family (Geist) at multiple weights — no personality conflict, maximum legibility

## 2. Colors: The Command Palette

Two authorities share the page — a dark command register and a light content register — with a semantic layer that speaks status without ambiguity.

### Primary
- **Command Black** (`#111827`): The sidebar background, all primary CTA buttons, and the active state indicator throughout. Its near-black value reads as authoritative without being aggressive. This is the single most recognizable surface in the product.
- **Brand Navy** (`oklch(54.6% 0.245 263)` ≈ `#2563c4`): Applied to links, focus rings, active tab indicators, points balances, and interactive text. Navy-600 for emphasis; navy-50 (`oklch(97.0% 0.013 266)`) for hover backgrounds and tinted badges.

### Neutral
- **Canvas** (`#f7f8fc`): The page background. Marginally blue-tinted — not warm, not aggressively cool. Avoids the cream/sand trap while maintaining legibility against white surfaces.
- **Surface White** (`#ffffff`): All cards, modals, inputs, and content containers. White creates the visual separation between content and canvas.
- **Border** (`oklch(91% 0.010 265)` ≈ `#e8eaf2`): Card borders and dividers. Navy-tinted — coherent with the brand, not generic gray.
- **Ink** (`#111827`): Primary body text. Same value as Command Black. One dark color, two roles.
- **Muted** (`oklch(52% 0.030 265)` ≈ `#6b7280`): Secondary text, timestamps, labels, and helper copy. Must clear 4.5:1 against white — use `text-gray-500`/`text-zinc-500` at minimum; never `*-400` on white.

### Semantic
- **Success Emerald** (`#059669`): Approved statuses, earned point indicators, positive deltas, "Active" badges.
- **Warning Amber** (`#d97706`): Pending actions, "Needs approval" states, cutoff countdowns in food ordering.
- **Error Rose** (`#dc2626`): Rejected statuses, destructive action buttons, error messages, deduction indicators.

**The One Voice Rule.** Brand navy is used for interactive affordances and data emphasis only — never as decoration. A navy background on a non-interactive surface is a design mistake.

**The Contrast Floor Rule.** No muted text (`*-400` or lighter) on white or near-white backgrounds anywhere in the product. Gray-500 is the floor. This is not negotiable.

## 3. Typography

**Display / Body Font:** Geist (with `system-ui, -apple-system, sans-serif` fallback)  
**Label / Mono Font:** Geist Mono (for IDs, point amounts displayed in tabular contexts, monospaced data)

**Character:** One geometric sans-serif at multiple weights. No serif, no display pairing. Product UIs don't need typographic drama — they need legibility at 13–14px across twelve hours of use. Geist earns its keep through optical consistency at small sizes and neutral character that doesn't fight with any content type.

### Hierarchy
- **Display** (700, 1.5rem / 24px, lh 1.2, ls -0.01em): Page-level headings only — dashboard "Overview", section titles like "Marketplace". Never inside cards.
- **Headline** (700, 1.125rem / 18px, lh 1.25, ls -0.005em): Card titles, modal headings, leaderboard player names in hero contexts.
- **Title** (600, 0.875rem / 14px, lh 1.25): Card section labels, sidebar labels, table column headers. The backbone of the dense admin surfaces.
- **Body** (400, 0.875rem / 14px, lh 1.5): Post content, descriptions, admin notes. Cap body columns at 65–75ch. Never go smaller than 14px on mobile.
- **Label** (500, 0.75rem / 12px, lh 1.2, ls 0.01em): Badges, status chips, timestamps, metadata rows. Uppercase tracking reserved for table headers only — never on body content.

**The Single Family Rule.** One font family everywhere. Do not introduce a display typeface for headings, a mono for data, and a third for labels — that is three families and always looks indecisive. Geist at 400/500/600/700 covers every surface.

## 4. Elevation

This system is flat by default. Surfaces at rest have no shadow. Shadow appears exclusively as a response to state — hover, active modal, or floating panel — making elevation legible as affordance rather than decoration.

**The Flat-By-Default Rule.** A card at rest has a border (`1px border-zinc-200` or `border-gray-100`) and no shadow. Shadow enters on hover (`shadow-sm`), on modal and drawer surfaces (`shadow-xl`), and on toasts/overlays (`shadow-lg`). Elevation signals "this has lifted toward me"; it should never be ambient.

### Shadow Vocabulary
- **Resting border** (`1px solid oklch(91% 0.010 265)`): All cards, inputs, and containers at rest. The border provides visual separation without implying depth.
- **Hover lift** (`0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)` / `shadow-sm`): Cards on hover. The translation (`-translate-y-0.5`) accompanies this shadow; the two appear together.
- **Modal / Drawer** (`0 20px 60px rgba(0,0,0,0.15), 0 4px 12px rgba(0,0,0,0.08)` / `shadow-xl`): Fixed overlays, modals, and drawers. Signals "I am above the page."
- **Toast / Floating UI** (`0 4px 24px rgba(0,0,0,0.12)` / `shadow-lg`): Notification toasts, floating action menus.

## 5. Components

All components are **confident and direct** — controls declare their purpose without hedging. No outlined primary buttons that look secondary, no ghost-only navigation that looks like plain text.

### Buttons
- **Shape:** Gently rounded (17px / `rounded-xl`) on primary; moderately rounded (12px / `rounded-lg`) on secondary.
- **Primary:** Command Black (`#111827`) fill, white text, `px-4 py-2.5`. On hover: `#1f2937` (one step lighter). On focus: `focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-gray-900`. Disabled: `opacity-50`. No border.
- **Secondary / Ghost:** White background with `border-zinc-200`, muted text (`text-zinc-600`). Hover: `bg-zinc-50` + `border-zinc-300`. Same radius and height as primary — the visual weight differs, not the size.
- **Destructive:** Rose-50 background, rose-600 text, rose-200 border. Hover: `bg-rose-100`. Reserved for irreversible actions only.
- **Semantic CTA (Emerald):** Used on food ordering, redemption confirm. Emerald-600 fill, white text. Same shape as primary.

### Chips / Badges
- **Status chips:** Full-rounded (`rounded-full`), `px-2.5 py-0.5`, 12px/500 text. Background is the semantic-50 tint, text is semantic-600/700. Example: `bg-amber-100 text-amber-700` for PENDING.
- **Flair chips (feed):** Same rounded-full shape with emoji + label. Each flair has its own accent color. Background is the flair's 50-100 tint. Selected flair: `scale-105 shadow-sm`.
- **Category filters (marketplace/admin):** Pill-shaped, `px-3.5 py-1.5`. Active: Command Black fill, white text. Inactive: white bg, `border-zinc-200`, muted text.

### Cards / Containers
- **Corner Style:** `rounded-xl` (17px) for standard cards; `rounded-2xl` (22px) for modals and feature cards.
- **Background:** Always Surface White (`#ffffff`). Never tinted neutrals inside cards.
- **Shadow Strategy:** None at rest (border only). `shadow-sm` + `-translate-y-0.5` on hover. See Elevation.
- **Border:** `1px solid` border-zinc-200 or border-gray-100. Never thicker.
- **Internal Padding:** `p-4` (16px) compact; `p-5` (20px) standard; `p-6` (24px) spacious.

### Inputs / Fields
- **Style:** White background, `border border-zinc-200`, `rounded-lg` (12px), `px-3 py-2`.
- **Focus:** `focus:ring-2 focus:ring-navy-500/30 focus:border-navy-400` — a soft navy glow that signals interactivity without screaming.
- **Error:** `border-red-400` + `text-red-600` helper text immediately below. No red background fill.
- **Disabled:** `bg-gray-50 cursor-not-allowed opacity-60`.
- **Read-only (locked by selection):** `bg-gray-50 cursor-not-allowed` with a `Lock` icon visible at the right edge.

### Navigation
- **Sidebar (employee):** Command Black (`#111827`) background. Active link: `bg-white/20`, white text, `border-l-2 border-white/60`. Inactive: `text-white/80`, hover `bg-white/10`. Icons are 16px, always alongside a text label — never icon-only.
- **Sidebar (admin):** White background with `border-r border-gray-100`. Active link: `bg-gray-100 text-gray-900`. Inactive: `text-gray-500` hover `bg-gray-50 text-gray-900`.
- **Tab bars:** Contained in a `bg-zinc-100 p-1 rounded-xl` pill group. Active tab: white bg, `shadow-sm`. Inactive: zinc-600 text, hover zinc-800. Mobile: horizontal scroll with `scrollbar-hide`.

### Signature Component: The Points Balance Display
The points balance appears in the marketplace header, profile stats, and admin KPI cards. Large tabular-num figure (`text-xl font-black` or larger), colored semantically — navy-600 for neutral balance, emerald-600 when confirming positive change, amber-600 for near-empty/pending. Never plain gray-900 on a KPI card; the value itself is information.

## 6. Do's and Don'ts

### Do:
- **Do** use `#111827` (Command Black) as the only primary CTA button background. Every primary action should look like it belongs to the same product.
- **Do** pair Command Black (sidebar) with Surface White (content area) — this high-contrast split is the core visual identity.
- **Do** reserve navy color for interactive affordances: links, focus rings, active states, and data emphasis. Not decoration.
- **Do** use semantic colors with both color AND an icon or text label — never color as the only indicator (accessibility requirement, not a suggestion).
- **Do** use `rounded-xl` (17px) for buttons and standard cards; `rounded-2xl` (22px) for modals and prominent feature cards.
- **Do** keep shadows off resting surfaces. A card at rest has a border; its hover state has a shadow. This distinction makes every hover feel like a response.
- **Do** use `text-zinc-500` as the floor for secondary text. Never `*-400` or lighter on white.
- **Do** use `motion-safe:` Tailwind prefix on every animation and transition so users with vestibular disorders get instant state changes.

### Don't:
- **Don't** create a design that looks like a startup SaaS (Notion/Linear/Vercel aesthetic) — no indigo-heavy palettes, no ultra-minimal "we are a dev tool" whitespace, no abstract geometric icons. AGS One is a BPO workplace tool, not a product-hunt launch.
- **Don't** create a design that looks like heavy enterprise software (SAP/Workday/Oracle) — no dark-gray data tables with 2px hairline borders, no accordion-heavy navigation, no "HR portal" density.
- **Don't** use `border-left` or `border-right` greater than 1px as a colored accent stripe on cards, alerts, or list items. Use a full border, a background tint, or a leading icon instead.
- **Don't** use gradient text (`background-clip: text` with a gradient). Use a solid color.
- **Don't** apply glassmorphism decoratively. Blur/backdrop-filter only when the semantic context genuinely requires it (an overlay on a photo).
- **Don't** use violet/purple gradients as defaults — this is the clearest AI-generated palette tell. The brand uses navy, not violet.
- **Don't** place the same-sized card grid (icon + heading + text, repeated) on every page. Cards are earned; they're not the default layout container.
- **Don't** add tiny uppercase tracked section eyebrows to every heading block. One named kicker used deliberately is voice; eyebrows everywhere is AI grammar.
- **Don't** use `text-*-400` on white backgrounds for any meaningful text. 4.5:1 contrast is the floor — this is a workplace tool used for eight-hour shifts.
- **Don't** put gray text on colored backgrounds. On an `amber-50` surface, use `amber-700` text — not `gray-600`.

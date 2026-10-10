# Vigil brand

Vigil is the product name. "Marketing Rule Watch" was the working title; don't use it in anything user-facing. Read this before touching any screen, slide, favicon, or the demo pitch.

**What the brand says:** Vigil keeps watch over everything a firm has published and puts anything risky in frame for a human to review. The logo is a viewfinder with a scan line: we look, we focus, a person decides.

**Tagline:** Keeps watch over everything you've published.
**One-liner:** Vigil scans what your firm has published online and flags anything that may conflict with your compliance policy, with the exact quote, for a human to review.

## Name
- Always **Vigil**, capital V, in prose and UI. The wordmark is lowercase `vigil`, and that only appears as the logo file, never typed out as text styled to look like the logo.
- Not "VIGIL", not "Vigil AI", not "Vigil.ai".

## Logo
Files live in `brand/logo/`. Use them as files; never redraw, recolor, stretch or re-letter them.

| File | Use |
|---|---|
| `vigil-lockup.svg` | Default. App header on light backgrounds, title slide, README |
| `vigil-lockup-reversed.svg` | Same, on dark (Night 950) backgrounds |
| `vigil-mark.svg` | App icon / avatar / square spots. Night tile, paper brackets, amber scan line |
| `vigil-mark-light.svg` | Square spots on dark backgrounds where a light tile reads better |
| `vigil-glyph.svg` / `-reversed.svg` | Bare brackets + scan line, no tile. Inline next to text, loading states |
| `vigil-wordmark.svg` / `-reversed.svg` | Wordmark alone when the mark is already on screen |
| `favicon.svg` | Browser tab only. Heavier strokes so it survives 16px |

Rules:
- The scan line is always Lamp 500 amber. The i-dots in the wordmark are always Lamp 500. Nothing else in the logo is amber.
- Minimum size: mark 20px, lockup 24px tall. Below 20px use `favicon.svg`.
- Clear space around the logo equals the height of the scan line × 3 on every side.
- Don't put the logo on photos, gradients, or amber backgrounds.

## Color
Tokens are in `brand/tokens.css` (CSS variables, plus a shadcn `:root` block) and `brand/tailwind.vigil.js` (Tailwind palette). Use the tokens, not raw hex, in app code.

| Name | Hex | Role |
|---|---|---|
| Night 950 | `#0B1120` | Primary text, primary buttons, dark backgrounds, logo tile |
| Night 600 | `#4A5570` | Secondary text on light backgrounds |
| Night 300 | `#8B95AE` | Secondary text on dark backgrounds |
| Paper 50 | `#FAF8F4` | Page background (warm off-white, never pure white for the page) |
| Paper 100 | `#F3EFE7` | Subtle fills, table stripes, muted surfaces |
| Paper 200 | `#E6E0D4` | Borders and dividers |
| White | `#FFFFFF` | Cards on top of Paper 50 |
| **Lamp 500** | `#F5A524` | The one accent. Scan line, focus rings, "look here" highlights |
| Lamp 700 | `#9A5B00` | Amber text on light backgrounds (Lamp 500 fails contrast on paper) |
| Lamp 100 | `#FFF1D6` | Highlight behind a flagged quote |

**Amber means "look here."** It marks the thing a human should review: the flagged span, the focus ring, the scan line. Don't use it for decoration, backgrounds, or primary buttons. Primary buttons are Night 950 with Paper 50 text.

Status colors (each has a 100 tint for backgrounds and a 600/700 for text on that tint):

| Meaning | Text / icon | Background tint |
|---|---|---|
| High severity | Ember 700 `#962C20` | Ember 100 `#FBE3DE` |
| Medium severity | Lamp 700 `#9A5B00` | Lamp 100 `#FFF1D6` |
| Low severity | Dusk 700 `#34558A` | Dusk 100 `#E3EAF5` |
| Approved / resolved | Sage 700 `#22674A` | Sage 100 `#DDF0E6` |
| Dismissed | Night 600 `#4A5570` | Paper 100 `#F3EFE7` |

Every pairing above passes WCAG AA (4.5:1 or better). Never signal severity by color alone; always show the label ("High", "Medium", "Low") too.

## Type
- **UI and slides:** Geist (Google Fonts). Weights 400, 500, 600. Headings 600 with slight negative tracking (`tracking-tight`).
- **Evidence:** Geist Mono for flagged quotes, URLs, capture timestamps and hashes. Monospace signals "this is the exact text we captured."
- Load: `<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap" rel="stylesheet">`
- Sentence case everywhere: buttons, headings, labels. No ALL CAPS except tiny eyebrow labels (11–12px, letter-spaced).

## Shape and layout
- Radius 10px (`--radius: 0.625rem`) for cards, inputs and buttons; 26/120 of the size for the logo tile only.
- Hairline borders (1px Paper 200) over shadows. At most one soft shadow, on popovers and drawers.
- Generous whitespace, max content width 1024px, left-aligned text.
- A flagged quote is shown as: Lamp 100 background, a 3px Lamp 500 left border, Geist Mono text. That is the signature component; reuse it everywhere a quote appears (inbox, detail, rewrite drawer, slides).

## Voice
The copy rules in `base44/CLAUDE.md` still apply and win over anything here:
- Say "potential issue for review", never "violation" or "non-compliant".
- Footer on every screen: "Not legal advice. All flags require human review."
- Calm, specific, plain. Short sentences, no hype, no exclamation marks, no emoji in the product.
- Vigil watches and points; a person decides. Write "Vigil found 6 potential issues", not "Vigil caught 6 violations".

## Applying it to the Base44 app (checklist for whoever does it)
1. `COPY.appName` in `base44/app/src/lib/copy.ts` → `"Vigil"`.
2. Replace the `:root` block in `base44/app/src/index.css` with block 2 of `brand/tokens.css`.
3. Merge `brand/tailwind.vigil.js` into `tailwind.config.js` `theme.extend.colors`, and set `fontFamily.sans`/`mono` to Geist / Geist Mono.
4. Add the Geist `<link>` to `index.html`, set `<title>Vigil</title>`, and point the favicon at `favicon.svg` (copy it into `app/public/`).
5. Header in `Chrome.jsx`: `vigil-lockup.svg` at 24px tall instead of the text name (copy into `app/public/`).
6. Swap hard-coded `slate-*`/`amber-*` classes for the tokens; map severity badges to the status table above.
7. Screenshot the inbox and a flag detail and compare them with `brand/preview.png`.

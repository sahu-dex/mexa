# MEXA MOTION — Blue & Light Blue theme

A colour-only restyle of the existing `mexa-motion-optimized.html` site.

Nothing about the page was rebuilt: every section, string, image, icon, link,
button, animation and script is the original. The theme is a single stylesheet
injected as the last block in `<head>`, so it wins the cascade without editing a
single class in the markup.

## Files

| File | What it is |
| --- | --- |
| `index.html` | **The deliverable.** The original site with the theme applied. |
| `card-theme.css` | The whole theme. Every colour decision lives here. |
| `original.html` | The untouched upload — never edited, kept so the change stays provable. |
| `build-bg.mjs` | Regenerates `index.html` from `original.html` + `card-theme.css`. |
| `verify-bg.mjs` | Proves nothing but colour changed. |
| `resolve.mjs` | Resolves the real cascade and checks every text colour. |
| `audit.mjs` | Contrast audit over the painted cards and the footer. |

## Build and check

```bash
npm install            # jsdom, used by the three checkers
node build-bg.mjs      # writes index.html
node verify-bg.mjs     # structure, behaviour, scope, geometry
node resolve.mjs       # real-cascade colour resolution
node audit.mjs         # WCAG contrast on cards + footer
```

`build-bg.mjs` also restores `hello@mexamotion.com`, which Cloudflare
obfuscates at the edge; the placeholder only decodes on Cloudflare's own
servers, so a downloaded copy would otherwise read `[email protected]`.

## What the theme changes

- **Page canvas** — pale blue gradient (`#f5f9ff → #e9f1ff → #dfeafe`) with a
  cyan glow top-left and a brand-blue glow bottom-right. Replaces the
  `#fafafa` body background.
- **Content cards** — royal-blue gradient (`#1b5ce8 → #0b3fa8`) with white
  text, on: the stats bar, the service card, review cards, contact tiles, the
  About floating badge, and the four standard team cards.
- **Icons inside those cards** — white (blue on blue would disappear).
- **Footer** — deep navy gradient (`#0b1930 → #081426`) with light text.
- **Two faint labels** on the canvas (`Trusted By Creators From`,
  `Swipe to see more`) darkened from 2.1:1 to 5.4:1.

## What deliberately stays as-is

- **Every button.** No button rule exists in `card-theme.css`; the header pill,
  hero CTAs, portfolio tabs, FAQ rows, newsletter button and social buttons
  keep their original colour, size and hover.
- **Navigation** — the header stays a white translucent pill.
- **FAQ cards** — they *are* buttons, so they stay light.
- **Hero badge, tool tiles, rating badge, portfolio tab strip**, the About
  image frame and the founder card stay light, because their contents are
  navy/blue by design and would vanish on blue.
- The review star row stays yellow.

## Verification

`verify-bg.mjs` enforces the brief mechanically:

- removing the one `<style>` block yields a document **byte-identical** to
  `original.html`;
- 461 elements, 24 ids, 17 images, 79 icons and all text are unchanged;
- every declaration in the theme is a colour property — no width, spacing,
  radius, font, transform or animation;
- every selector is scoped to the canvas, a card, or the footer;
- no rule targets a `button` or `a`;
- the page's own JavaScript still parses and still runs (portfolio renders
  8 videos + 5 shorts, tabs switch, FAQ opens, drawer handler present).

`resolve.mjs` reproduces CSS specificity, `!important` and source order, walks
inheritance up the tree, and checks each resolved colour against the background
that element actually sits on. It reports 146 resolved text nodes, including one
low-contrast label in the mobile drawer that is **identical to the untouched
original** and therefore not a regression.

## Known limits

- The demo runs against CDN Tailwind, Font Awesome, Google Fonts and Unsplash.
  Offline those do not load, so the page renders unstyled — open it in a normal
  browser with network access.
- The reference screenshot showed a *different* site. Only its colour language
  (royal-blue cards, white text, white pill buttons) was taken from it; all copy
  and layout here remain MEXA MOTION's own.

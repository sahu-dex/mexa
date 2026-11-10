# MEXA MOTION — Static HTML Demo

This folder is the complete, standalone version of the MEXA MOTION website.
It is **pure HTML, CSS and JavaScript**: there is no PHP, no Laravel, no database,
no API and no server-side rendering anywhere in it. Every page is a finished
document that a browser can display straight from disk.

## How to open it

Double-click **`index.html`** (or drag it into any browser). Nothing needs to be
installed, started or served — no `php artisan serve`, no Node, no web server.
`file://` works exactly like a web server, so the folder can also be uploaded to
any static host (GitHub Pages, Netlify, Cloudflare Pages, an S3 bucket…).

## Pages

| File | Page | Original route |
| --- | --- | --- |
| `index.html` | Home — hero, services, portfolio, reviews, about, CTA | `/` |
| `work.html` | Work — recent projects, demo reel, shorts | `/work` |
| `service.html` | Service — overview, service cards, packages | `/service` |
| `team.html` | Team — founder, roster, counters | `/team` |
| `review.html` | Review — rating summary, review grid, write-a-review form | `/reviews` |
| `book.html` | Book — ticket builder (project, quality, message, live preview) | `/booking` |

The header, the mobile drawer and the footer link to each other with plain
relative URLs (`index.html`, `work.html`, …), so navigation works offline.

## What still works

Everything that is *interface*:

- header state, desktop nav underline, mobile drawer (open / close / Esc)
- scroll reveal (AOS), counters, hover states, sticky header
- portfolio tabs (Videos / Shorts), FAQ toggles
- service package picker, live price previews, media and image modals
- review pagination ("See more"), star picker, character counter
- booking quality selector and order preview
- language toggle (EN ⇄ BN) using the built-in `data-i18n` dictionary

## What intentionally does not happen

The design is preserved 100%, the behaviour behind it is inert:

- **No network calls.** `fetch`, `XMLHttpRequest` and `navigator.sendBeacon`
  are disabled in the page runtime; nothing reaches an API.
- **No storage.** Local storage is replaced by an in-memory object, so no
  review, ticket, language choice or catalogue is ever written to the browser.
- **No form submission.** Forms keep their look and validation and still show
  their own confirmation popups/toasts, but nothing is sent or saved.
- **No login, registration or admin panel.** Those screens are not part of this
  folder at all.

All content (services, packages, projects, reviews, team, videos) ships as data
in `data/site-data.js` and is rendered into the pages from there.

## Folder layout

```
static-site/
├── index.html   ← home  (CSS + content + JS all inside this one file)
├── work.html    ← work
├── service.html ← service
├── team.html    ← team
├── review.html  ← review
├── book.html    ← booking
└── README.md
```

There is no `assets/` folder and no `data/` folder any more: every stylesheet,
the content bundle and all page scripts are embedded inside each HTML file, and
the logo / favicon are `data:` URIs. Each page is genuinely standalone — you
can copy one file out on its own and it still works.

Photography, video posters and social links still point at their original CDN
addresses — with an internet connection they load exactly as designed.

## Rebuilding these pages

The demo is generated from the Laravel templates so the markup can never drift
from the original design:

```bash
node scripts/static-demo/build.mjs   # regenerate the six pages
node scripts/static-demo/verify.mjs  # static / offline / design checks
node scripts/static-demo/test-interactions.mjs   # jsdom UI interaction tests
node scripts/static-demo/test-file-protocol.mjs  # double-click / file:// smoke test
```

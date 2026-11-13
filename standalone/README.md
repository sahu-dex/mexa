# Standalone home page (glass preview)

This folder holds a **static HTML copy of the Mexa Motion home page** in the reference
design system: Poppins, the blue glass card language, the floating pill header and the
right-slide mobile drawer.

It exists so the design can be reviewed without touching the live PHP site.

## Files

```
standalone/
  index.html                    # the page itself
  assets/
    css/home-reference-design.css
    fonts/poppins/              # Poppins 300–800 + OFL licence
    js/home-extra.js            # review avatar fallback for this preview
```

Shared site assets (images, the other CSS files, site-common.js, the work preview modal)
are read from the repository root with `../assets/...`; nothing is duplicated.

## How to view

Serve the repository root and open:

```
/standalone/index.html
```

For the local preview used during development, that is:

```
http://127.0.0.1:8099/standalone/index.html
```

Opening the file directly with `file://` also renders the page, but the links to
`service.php`, `work.php`, etc. and the newsletter need the PHP site to be running.

## Notes

- The live home page (`index.php` → `pages/index.php`) is **not changed** by this folder.
- All nav, hero, service, portfolio, process, review, team, about, contact and footer
  content comes from the current home page; section order and existing links are kept.
- Links to inner pages are prefixed with `../` so they work from this folder.
- The newsletter form is intercepted on this static copy and shows a local
  “Subscribed! (static preview)” toast instead of calling the backend.
- `<meta name="robots" content="noindex,nofollow">` is set to avoid a duplicate page
  being indexed.
- Remote Unsplash imagery used by the portfolio and reviews still needs network access;
  the local `assets/` images load without it.

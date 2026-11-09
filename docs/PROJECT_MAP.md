# MEXA MOTION source map

This document is a handoff map for the next developer or coding agent. The application already follows Laravel's standard root layout. Public page templates are Blade files and there are no standalone HTML page templates.

## Main folders

| Path | Responsibility |
| --- | --- |
| `app/Http/Controllers/` | Public page rendering, admin authentication/content actions, image uploads, video library, team profile submissions |
| `app/Http/Middleware/` | Admin and owner authorization (`EnsureAdmin`, `EnsureOwner`) |
| `app/Support/` | Shared site data access, video catalog synchronization, and embed URL resolution |
| `bootstrap/`, `config/` | Laravel bootstrap and application configuration |
| `database/migrations/` | MySQL schema for users, site data, media, video catalog, roles, and approvals |
| `database/seeders/` | Initial data setup; `data/site-snapshot.json` is the bundled starter content |
| `public/css/`, `public/js/` | Browser-ready stylesheets and scripts; loaded directly by Blade templates |
| `resources/views/pages/` | Home, Service, Work, Reviews, Team, Booking, and team-profile Blade pages |
| `resources/views/pages/partials/` | Shared page assets, video assets, and mobile booking markup |
| `resources/views/admin/` | Setup, login, and admin dashboard Blade screens |
| `routes/web.php` | Named public routes, admin routes, and JSON endpoints under `/api/...` |
| `storage/` | Runtime logs, sessions, compiled Blade views, and temporary/cache files; keep generated contents out of source commits |
| `scripts/` | Preview-only router and start script; kept outside `public/` and denied by `.htaccess` |
| `wrangler.jsonc`, `worker/src/index.js` | Cloudflare Workers + Containers deployment config and the Worker/Durable Object that proxies requests to the Laravel container |
| `Dockerfile`, `docker/` | PHP 8.4 + Apache image, vhost/php.ini, container entrypoint (env → `.env`, migrations, caches) and the optional R2 media mount |
| `.env.cloudflare.example` | Secret-only template for `wrangler secret bulk` during Cloudflare deployment |

## Important entry points

### Public website

- `SitePageController` renders `resources/views/pages/{home,service,work,reviews,team,booking}.blade.php`.
- `SiteData` reads the shared `settings`, `services`, `packages`, `team`, `portfolio`, `reviews`, and `bookings` sections from MySQL and merges missing sections with bundled defaults.
- `VideoCatalog` keeps video records and placements aligned with the shared site content. `VideoEmbed` resolves supported providers and safe direct media URLs.
- `SiteApiController` exposes the public content endpoints and the admin save/approval actions.

### Admin and media

- `/admin/setup` is only for creating the first owner. `/admin` is the authenticated dashboard; login and logout are handled by `AdminController`.
- `EnsureAdmin` protects signed-in admin routes. `EnsureOwner` protects owner-only editing, uploads, video-library, and moderator management actions.
- `AdminManagementController` handles review/team approvals and moderator management.
- `ImageUploadController` stores admin image/video files on the public storage disk, records their URLs and metadata in `media_assets`, and serves registered files through `/storage/media/{file}`.
- `VideoLibraryController` manages video records and page/service placements.
- `TeamProfileController` accepts profile proposals through the generated private profile link; proposals require approval before publication.

### Page and asset map

| Feature | Primary files |
| --- | --- |
| Home hero and sections | `resources/views/pages/home.blade.php`, `public/css/home-hero.css` |
| Shared public header and mobile menu styling | Page Blade header markup, `public/css/header-restoration.css`, `public/css/mobile-menu.css` |
| Global typography and shared theme | `public/css/site-typography.css`, other `public/css/site-*.css` stylesheets |
| Service and booking presentation | `resources/views/pages/service.blade.php`, `resources/views/pages/booking.blade.php`, `public/css/service-booking-theme.css` |
| Work/review video preview | `public/js/video-preview.js`, `public/css/video-preview.css`, `public/css/video-library.css` |
| Admin UI | `resources/views/admin/dashboard.blade.php`, `public/css/admin.css`, `public/css/admin-management.css`, `public/css/admin-refresh.css`, `public/js/admin.js` |

Page-level Blade files currently contain legacy inline page markup/scripts as well as external asset references. When editing, prefer a small scoped change; move shared code into a partial only when every affected page is updated together.

## Local data and configuration

- Database connection is configured in the ignored `.env`; the starter template is `.env.example`.
- `IMGBB_API_KEY` is legacy configuration; new admin uploads use the website's own storage and do not require the key. Never expose credentials in Blade, JavaScript, page JSON, logs, or commits.
- Initial MySQL setup and deployment guidance are in `README.md`.
- cPanel checks, no-Terminal setup, private-file `.htaccess` guards, storage markers and schema-import instructions are in `CPANEL_DEPLOYMENT.md`.
- Cloudflare/Tunnel preview guidance is in `CLOUDFLARE_PREVIEW.md`: `TRUSTED_PROXIES` is opt-in, `scripts/preview-router.php` derives the project root without a hardcoded path, and `scripts/start-preview.sh` binds to `0.0.0.0` for proxied previews.
- `database/seeders/data/site-snapshot.json` supplies default site content. The seeder adds missing sections; it is not a substitute for a backup of an existing database.
- Preserve the current database when working locally. Avoid destructive reset commands and avoid replacing the local `.env` or `APP_KEY`.

## Data ownership, backups, and schema changes

- **Canonical live store:** MySQL. `site_data.payload` is JSON *inside* the database, not a separate JSON file store. Admin edits to copy, settings, services, packages, team, portfolio, reviews and bookings are written there. `media_assets`, `video_library` and `video_placements` hold media URLs/metadata and page placements.
- **Bundled JSON role:** `database/seeders/data/site-snapshot.json` is a versioned starter/import snapshot and a fallback for missing sections only. Do not mirror live admin edits into it and do not create a second live JSON store. A true backup or export should be a timestamped database dump or JSON export written to an ignored, non-public location such as `storage/app/private/backups/`; store a copy off-server, verify it, and never commit it.
- **Uploaded binaries:** Admin uploads go to the configured `public` disk at `storage/app/public/media/`. The upload controller derives the filename extension from the validated MIME type, saves the file, builds `/storage/media/{uuid}.{ext}`, and records the URL, MIME type, byte size, provider and timestamps in `media_assets`. Only registered local files are served by `ImageUploadController::show()`. File bytes or `data:` URIs must not be placed in `site_data`, `video_library`, page overrides, Blade templates or JavaScript.
- `App\Support\MediaFiles` centralizes the MIME-to-extension allowlist, registered-filename validation, inline-media detection and safe media URL checks. `App\Support\SiteData` rejects unencodable JSON and atomically upserts one section without overwriting `created_at` or existing rows.
- Legacy inline base64 images in the page Blade templates are pre-existing static design assets, not uploaded media. They are deliberately left untouched here so the approved visual design stays byte-for-byte intact; a future design-only task can extract them to versioned static assets.
- **Before any future schema change:** put the site in maintenance mode, take a verified backup of the database *and* `storage/app/public/media/` outside Git, add only additive/nullable columns or new tables, backfill from existing rows, compare row counts/checksums and exercise admin/public pages, then deploy. Never run `migrate:fresh`, `truncate`, `migrate --seed` on a populated database, or replace a database file. Keep credentials in `.env`/secret store, not in commands, logs or commits.
- `.gitignore` excludes `.env` variants, credential files, uploaded media, database dumps and backup folders. Keep `database/seeders/data/site-snapshot.json` tracked; it is starter code content, not live data.


## cPanel deployment

- `CPANEL_DEPLOYMENT.md` is the authoritative setup guide. This repository adds a cPanel-safe root `.htaccess` (private-path deny, `/.well-known/` exemption, `public/` rewrite), per-directory private `.htaccess` files including `scripts/`, a `public/.htaccess` rule that always sends `/storage/media/...` through Laravel, runtime directory markers, a production-neutral `.env.example`, a temporary token-protected `public/cpanel-preflight.php`, and a non-destructive `database/schema/cpanel-mysql.sql` for phpMyAdmin.
- No server path, local URL or XAMPP default is hardcoded for production. `config/database.php` expects cPanel DB values from `.env`; `config/app.php` uses a non-routable console fallback only. `config/filesystems.php` keeps the `public` disk at `storage/app/public`; admin uploads explicitly use that disk.
- `public/storage` symlink and `php artisan storage:link` are optional: `/storage/media/{file}` is a Laravel route backed by `media_assets`. If a symlink exists, the rewrite rules still force media through Laravel and deny other direct storage paths.
- Terminal/Composer are optional: build `vendor/` locally with `composer install --no-dev --optimize-autoloader --prefer-dist`, upload it, use phpMyAdmin to import the schema-only SQL into a fresh empty DB, set `.env` in File Manager, and delete the preflight file after verification. Existing populated databases must not be imported, migrated, truncated or reseeded.
- `database/schema/cpanel-mysql.sql` contains only `CREATE TABLE IF NOT EXISTS` and `INSERT IGNORE` for migration bookkeeping; it has no `DROP`, `DELETE`, `TRUNCATE`, `UPDATE` or content rows and is not a backup/export of live data.

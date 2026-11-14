# Mexa Motion — PHP 8 & MySQL Website + Admin Panel

Complete plain PHP 8+ and MySQL/MariaDB (`PDO`) website and desktop Admin Panel for **Mexa Motion** Creative Post-Production Studio.

---

## 1. Directory Structure

```text
mexa/
├── admin/                  Desktop left-sidebar Admin Panel (setup, login, CRUD modules)
├── api/                    Public read-only JSON APIs, form handlers & CSRF/session-protected admin APIs
│   └── admin/              Authenticated admin write endpoints (services, work, team, reviews, messages, settings)
├── assets/
│   ├── about/              Studio collage photographs
│   ├── css/                Extracted page & component stylesheets + admin.css
│   ├── images/             Brand artwork, favicon, review banner & team portraits
│   └── js/                 Frontend controllers + admin.js
├── config/                 Protected environment loader (config.php) & PDO connection (db.php)
├── database/               MySQL schema (schema.sql), seed runner (seed.php), SQL dump (seed.sql) & JSON seed
├── includes/               Shared header.php, footer.php, admin_header.php, admin_footer.php & functions.php
├── pages/                  Six public page implementations (included by root entry points)
├── storage/                Protected rate-limit buckets & error logs
├── uploads/
│   ├── images/             Validated uploaded images (PHP execution disabled via .htaccess)
│   └── videos/             Validated uploaded videos (PHP execution disabled via .htaccess)
├── index.php               Homepage entry point
├── service.php             Services entry point
├── work.php                Portfolio entry point
├── review.php              Reviews entry point
├── team.php                Team entry point
├── book.php                Retired endpoint (HTTP 410)
├── .env.example            Configuration template with placeholders
├── .gitignore              Excludes .env, runtime uploads, and logs from Git
└── .htaccess               Apache security rules, directory index lock & 301 .html -> .php redirects
```

---

## 2. Requirements

- **PHP** `8.0+` (`8.1` / `8.2` / `8.3` recommended) with extensions:
  - `pdo_mysql`
  - `mbstring`
  - `fileinfo`
  - `gd`
- **Database**: MySQL `8.0+` or MariaDB `10.4+` (`utf8mb4_unicode_ci`)
- **Web Server**: Apache `2.4+` (`mod_rewrite`, `mod_headers`, `AllowOverride All`) or Nginx

---

## 3. Environment Variables You Must Fill In (`.env`)

Copy `.env.example` to `.env` in the project root:

```bash
cp .env.example .env
```

Update the following placeholders in `.env` before going live:

| Variable | Description | Example / Production Value |
| --- | --- | --- |
| `APP_ENV` | `production` hides PHP error output (`display_errors=0`) | `production` |
| `APP_NAME` | Application display name | `"Mexa Motion"` |
| `APP_URL` | Full public base URL (no trailing slash) | `"https://mexamotion.com"` |
| `APP_TIMEZONE` | PHP timezone identifier | `"Asia/Dhaka"` |
| `DB_HOST` | MySQL/MariaDB hostname | `127.0.0.1` or `localhost` |
| `DB_PORT` | MySQL/MariaDB port | `3306` |
| `DB_NAME` | Database name | `cpaneluser_mexa` |
| `DB_USER` | Database username | `cpaneluser_mexa_app` |
| `DB_PASS` | Strong database password | `CHANGE_ME_STRONG_DB_PASSWORD` |
| `DB_CHARSET` | Database character set | `utf8mb4` |
| `MAIL_FROM` | Sender address used in `From:` header | `"noreply@mexamotion.com"` |
| `MAIL_FROM_NAME` | Sender name used in outgoing notifications | `"Mexa Motion Website"` |
| `MAIL_TO` | Default inbox for contact/review alerts | `"owner@mexamotion.com"` |
| `ADMIN_SETUP_KEY` | Optional extra setup passphrase (if non-empty) | `""` |
| `MAX_IMAGE_BYTES` | Maximum image upload size in bytes (`5242880` = 5 MB) | `5242880` |
| `MAX_VIDEO_BYTES` | Maximum video upload size in bytes (`52428800` = 50 MB) | `52428800` |

---

## 4. Database Setup & Seeding

1. Create an empty UTF-8 (`utf8mb4`) MySQL/MariaDB database.
2. Import the schema and seed data using **either** the PHP CLI seeder or `mysql` / phpMyAdmin:

### Option A — PHP CLI Seeder (creates tables + seeds all initial content)

```bash
php database/seed.php
```

### Option B — SQL Import (phpMyAdmin or `mysql` CLI)

```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < database/schema.sql
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < database/seed.sql
```

### Removing the retired package system on an existing installation

Back up the database first. After deploying this version, run `database/remove-packages.sql`
**once** on the existing MySQL/MariaDB database. It permanently deletes package records and
package-specific fields, while preserving existing message records. This migration is not run
automatically. Fresh installations use the updated schema and do not need this migration.

### Updating the default team biographies on an existing site

Back up the database first, then import `database/update-default-team-bios.sql` in phpMyAdmin, or run:

```bash
mysql -u YOUR_DB_USER -p YOUR_DB_NAME < database/update-default-team-bios.sql
```

This optional update replaces known, unchanged default biographies and descriptions with concise versions; profiles edited in the admin panel are left untouched. New installations receive the updated biographies through either seed method. Avoid re-running the full PHP seeder on an existing site just for this update, since it can overwrite other team profile fields.

Team biographies and card descriptions may be shorter but cannot exceed 300 Unicode code points each, including spaces, punctuation, digits and Bengali combining marks. A line break counts as one. The admin editor enforces the limit and the server rejects over-limit submissions. For existing custom profiles that exceed the limit, the public site displays a bounded excerpt without modifying the stored text; an administrator should shorten those fields before saving the profile.

### Database Tables Created (`7` tables)

- `settings` — Global brand identity, hero headlines, showreel path, counters, studio collage paths, FAQs, social links, and notification email.
- `services` — Studio services (`file_path` & `thumbnail_path` media columns, icon, bullets, sort order, visibility).
- `work_items` — Portfolio and homepage media entries (`recent`, `demo`, `short`, `preview`) with `file_path`, `embed_url`, and `thumbnail_path`. `demo` powers the homepage **Videos** tab; `short` powers the **Shorts** tab.
- `team_members` — Founder and specialist profiles with portrait `file_path` and JSON skills.
- `reviews` — Client testimonials with avatar `file_path`, star rating, `is_featured`, and moderation `status` (`pending` / `approved` / `rejected`).
- `messages` — Contact inquiries, newsletter subscribers and preserved historical messages.
- `admins` — Administrator accounts (`password_hash` via `password_hash(..., PASSWORD_DEFAULT)`).

---

## 5. Creating the First Admin Account

No administrator password is stored anywhere in the source code or seed files.

1. Open `/admin/setup.php` in your browser (for example `https://yourdomain.com/admin/setup.php`).
2. Enter your **Admin Username**, **Admin Email**, and a **Password** (minimum 10 characters).
3. Submit the form — your account is hashed with `password_hash()` (`PASSWORD_DEFAULT`), your session ID is regenerated, and `/admin/setup.php` **permanently locks itself** (automatically redirecting to `/admin/login.php` whenever at least one admin row exists).

### Managing Homepage Videos & Shorts (Admin Panel)

Open **Admin → Videos & Shorts**. The same `work_items` table powers the public Work page and the homepage, so no duplicate content system is created.

1. Click **Add Video** for a landscape card in the homepage **Videos** tab, or **Add Short** for a vertical 9:16 card in the **Shorts** tab.
2. Add a **Title** (required), an optional category, duration, description, and sort order.
3. Choose **Appears In**:
   - `demo` → homepage Videos tab and Work page Videos section
   - `short` → homepage Shorts tab (9:16)
   - `recent` → Work page “Recently Worked On”
   - `preview` → homepage preview pool
4. Upload the **video** (MP4, WebM, or MOV, up to `MAX_VIDEO_BYTES`) **or** paste a YouTube/Vimeo/Facebook URL. Uploads use the existing validated `uploads/videos/` pipeline.
5. Upload a separate **thumbnail** (JPG, PNG, or WebP) or paste its URL. If a thumbnail is omitted for a YouTube link, the provider thumbnail is used automatically.
6. Set **Status** to `Published` so the card appears on the website immediately; keep it as `Draft` to hide it. **Edit** and delete actions are available per row, and deleting an item also removes its uploaded video and thumbnail files.
7. Use the **All / Videos / Shorts** filter tabs to manage each content type quickly. Changes are public on the next page load — no code edits or cache rebuild required.

On the homepage, clicking a card with a playable source opens the shared video player. Videos play in a 16:9 stage, Shorts in a 9:16 stage. Closing with the **X** button, `Esc`, or a click on the backdrop stops playback and returns focus to the card. Image-only items open as a still preview, while cards with no media source at all link to the Work page.

### Shared Video Player (Home, Service & Work)

Every video on the site — Home *Our Work*, Work page videos and Shorts, Service page videos, and the showreel — is played by one reusable component:

- `assets/js/video-player.js` builds a **single** player modal (`#mexa-video-player`) on first use and exposes `MexaVideoPlayer.open()`, `.openFrom(element)`, `.close()` and `.isOpen()`. It is initialised once per page, so a page can never end up with two modals, two close buttons or duplicated listeners.
- `assets/css/video-player.css` holds all player styling. The close control is one real `<button>` with an inline SVG icon — no `&times;` text and no `::before`/`::after` glyph, so the old double-cross could not return.
- Controls: play/pause, **−10s**, **+10s**, seekable progress bar, mute + volume slider, fullscreen, and keyboard shortcuts (`Space`/`K` play-pause, `←`/`→` ±10s, `↑`/`↓` volume, `M` mute, `F` fullscreen, `Esc` close).
- Only the video and the controls are shown: no title, description or extra text, and the aspect ratio is preserved on desktop and mobile.
- Cards opt in through data attributes the player already understands: `data-mm-video-url`, `data-mm-video-embed-url`, `data-mm-video-type`, `data-mm-video-poster`, `data-mm-video-title`, `data-mm-vertical="1"` (9:16), or the Home gallery pair `data-mm-media` + `data-mm-src` / `data-mm-embed` / `data-mm-kind`.
- Closing (X, `Esc` or backdrop) pauses the video, mutes it, releases the source and the scroll lock. Opening another clip stops the previous one first.

---

## 6. Deploying to cPanel / Shared Hosting

1. Upload all project files to `public_html/` (or a subdomain document root).
2. Ensure hidden files (`.htaccess`, `config/.htaccess`, `includes/.htaccess`, `pages/.htaccess`, `database/.htaccess`, `storage/.htaccess`, `uploads/.htaccess`) are uploaded.
3. In **cPanel -> MySQL Databases**, create a database and user, grant `ALL PRIVILEGES`, and import `database/schema.sql` followed by `database/seed.sql` in **phpMyAdmin**.
4. Create `public_html/.env` from `.env.example` with `APP_ENV=production` and `SESSION_COOKIE_SECURE=1`.
5. Verify directory permissions:
   - Directories (`uploads/images`, `uploads/videos`, `storage/ratelimits`, `storage/logs`): `755`
   - `.env` and `config/*.php`: `640` or `600`
6. Visit `https://yourdomain.com/admin/setup.php` immediately to register your owner admin account.

### Nginx Equivalent Block (if using Nginx instead of Apache)

```nginx
location ~ /\.(env|git|htaccess) { deny all; }
location ~ ^/(config|includes|database|storage)/ { deny all; }
location ~* ^/uploads/.*\.(php|php[0-9]*|phtml|phar|pl|py|cgi|sh|svg|html|htm)$ { deny all; }
rewrite ^/(index|service|work|review|team)\.html$ /$1.php permanent;
```

---

## 7. Public Read-Only JSON Endpoints

- `GET /api/services.php` — Active services.
- `GET /api/work.php` — Published portfolio items (optional `?kind=video|image`, `?category=...`, `?section=recent|demo|short`).
- `GET /api/reviews.php` — Approved reviews and aggregate rating stats (optional `?limit=20&offset=0`).
- `GET /api/settings.php` — Public site settings (excludes private `notification_email`).

---

## 8. Security Checklist & Verification Steps

1. **Protected Configuration & `.env`**:
   - Visit `/config/config.php`, `/includes/functions.php`, `/database/schema.sql`, and `/.env` in a browser — each must return **`403 Forbidden`**.
2. **Upload Hardening**:
   - Uploads are validated via `finfo` MIME inspection (`image/jpeg`, `image/png`, `image/webp` + `getimagesize()`, and `video/mp4`, `video/webm`, `video/quicktime`), size caps, and 32-byte random filenames inside `uploads/images/` and `uploads/videos/`.
   - `uploads/.htaccess` disables the PHP engine and blocks script/HTML/SVG execution.
3. **Authentication & Session Safety**:
   - Visit `/admin/index.php` while logged out — redirects to `/admin/login.php`.
   - Send a `POST` request to `/api/admin/services.php` without an admin session or valid CSRF token — returns **`401`** / **`419`**.
   - Login regenerates the session ID (`session_regenerate_id(true)`) and logout destroys session data + expires the cookie.
4. **SQL Injection, XSS, CSRF, Rate Limiting & Honeypot**:
   - All database queries use `PDO` prepared statements (`ATTR_EMULATE_PREPARES => false`).
   - Dynamic HTML attributes and text output pass through `htmlspecialchars(..., ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8')`.
   - Public forms (`review.php`, newsletter, contact) and admin login enforce CSRF tokens, hidden honeypot fields, and IP-hashed rate limiting (`storage/ratelimits/`).

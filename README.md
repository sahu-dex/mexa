# Mexa Motion — PHP 8 & MySQL Website + Admin Panel

Complete plain PHP 8+ and MySQL/MariaDB (`PDO`) website and desktop Admin Panel for **Mexa Motion** Creative Post-Production Studio.

---

## 1. Directory Structure

```text
mexa/
├── admin/                  Desktop left-sidebar Admin Panel (setup, login, CRUD modules)
├── api/                    Public read-only JSON APIs, form handlers & CSRF/session-protected admin APIs
│   └── admin/              Authenticated admin write endpoints (services, packages, work, team, reviews, messages, settings)
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
├── book.php                Booking entry point
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
| `MAIL_TO` | Default inbox for booking/contact/review alerts | `"owner@mexamotion.com"` |
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

### Database Tables Created (`8` tables)

- `settings` — Global brand identity, hero headlines, showreel path, counters, studio collage paths, FAQs, social links, and notification email.
- `services` — Studio services (`file_path` & `thumbnail_path` media columns, icon, bullets, sort order, visibility).
- `packages` — `normal`, `high`, and `premium` pricing tiers linked via foreign key to `services`.
- `work_items` — Portfolio entries (`recent`, `demo`, `short`, `preview`) with `file_path` and `thumbnail_path`.
- `team_members` — Founder and specialist profiles with portrait `file_path` and JSON skills.
- `reviews` — Client testimonials with avatar `file_path`, star rating, `is_featured`, and moderation `status` (`pending` / `approved` / `rejected`).
- `messages` — Booking tickets (`ticket_ref`, `service_id`, `package_id`, `quoted_price`), contact inquiries, and newsletter subscribers.
- `admins` — Administrator accounts (`password_hash` via `password_hash(..., PASSWORD_DEFAULT)`).

---

## 5. Creating the First Admin Account

No administrator password is stored anywhere in the source code or seed files.

1. Open `/admin/setup.php` in your browser (for example `https://yourdomain.com/admin/setup.php`).
2. Enter your **Admin Username**, **Admin Email**, and a **Password** (minimum 10 characters).
3. Submit the form — your account is hashed with `password_hash()` (`PASSWORD_DEFAULT`), your session ID is regenerated, and `/admin/setup.php` **permanently locks itself** (automatically redirecting to `/admin/login.php` whenever at least one admin row exists).

---

## 6. Deploying to cPanel / Shared Hosting (Teacher Final Check)

> **Teacher cPanel-এ দেখবেন — Railway শুধু preview.** Full step-by-step Bengali guide: [`CPANEL_DEPLOY_BN.md`](CPANEL_DEPLOY_BN.md)

1. Upload all project files to `public_html/` (or a subdomain document root). Hidden files (`.htaccess`, `config/.htaccess`, `includes/.htaccess`, `pages/.htaccess`, `database/.htaccess`, `storage/.htaccess`, `uploads/.htaccess`) must be included — enable **Show Hidden Files** in File Manager.
2. In **cPanel → MySQL® Databases**, create database `cpaneluser_mexa` + user `cpaneluser_mexa_app` → grant **ALL PRIVILEGES**.
3. In **phpMyAdmin**, select the DB → **Import** `database/schema.sql` then `database/seed.sql` (8 tables).
4. In File Manager, copy `.env.example` → `.env` in `public_html/` and fill `APP_URL`, `DB_HOST=localhost`, `DB_NAME`, `DB_USER`, `DB_PASS` (see `.env.example` for Railway vs cPanel styles).
5. Set permissions: `storage/`, `uploads/images/`, `uploads/videos/`, `storage/ratelimits/`, `storage/logs/` → `755`; `.env`, `config/*.php` → `640` / `600`.
6. cPanel → **Select PHP Version** → choose **PHP 8.1+** with `pdo_mysql`, `mbstring`, `fileinfo`, `gd`, `curl`.
7. Visit `https://yourdomain.com/admin/setup.php` to create the first admin (auto-locks after).
8. Verify: `https://yourdomain.com/api/health.php` → `{"db":"connected"}` and `admin/diagnostics.php` (after login) shows all green.

**Railway preview vs cPanel production:** Same codebase. `Dockerfile`/`railway.json` are ignored on cPanel. `config/db.php` auto-falls back: `DB_HOST` (cPanel) → `MYSQLHOST`/`DATABASE_URL` (Railway). See also: [`RAILWAY_DEPLOY.md`](RAILWAY_DEPLOY.md).

### Quick cPanel Troubleshooting

| Symptom | Fix |
|---|---|
| `Service temporarily unavailable` | `.env` missing or `DB_NAME/DB_USER` empty — check File Manager `public_html/.env` |
| `Database connection failed` | Wrong `DB_HOST/DB_PASS` or missing privileges — reset in MySQL® Databases |
| `500` | PHP < 8.0 or missing `mod_rewrite` — select PHP 8.1+ |
| CSS 404 | `assets/` not uploaded — re-upload with hidden files |
| `403` on `/.env` not shown | `.htaccess` not active — ask host for `AllowOverride All` |

### Nginx Equivalent Block (if using Nginx instead of Apache)

```nginx
location ~ /\.(env|git|htaccess) { deny all; }
location ~ ^/(config|includes|database|storage)/ { deny all; }
location ~* ^/uploads/.*\.(php|php[0-9]*|phtml|phar|pl|py|cgi|sh|svg|html|htm)$ { deny all; }
rewrite ^/(index|service|work|review|team|book)\.html$ /$1.php permanent;
```

---

## 7. Public Read-Only JSON Endpoints

- `GET /api/services.php` — Active services and nested pricing packages.
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
   - Public forms (`book.php`, `review.php`, newsletter, contact) and admin login enforce CSRF tokens, hidden honeypot fields, and IP-hashed rate limiting (`storage/ratelimits/`).

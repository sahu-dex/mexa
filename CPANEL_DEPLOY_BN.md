# cPanel Deploy Guide — Mexa Motion (Teacher Check Ready)

> Railway preview ঠিক আছে, কিন্তু Teacher final check করবে **cPanel**-এ। এই guide follow করলে cPanel-এ একবারে run করবে — কোনো `Service temporarily unavailable` আসবে না।

---

## 1) Live Server Ready Checklist (cPanel)

এই প্রজেক্টটি **plain PHP 8.0+ + MySQL** — Laravel/Composer লাগে না। cPanel Shared Hosting-এ direct `public_html`-এ upload করলেই চলবে।

| Item | Status |
|------|--------|
| `public_html/.env` | ✅ আপনি তৈরি করবেন (template দেওয়া আছে) |
| `database/schema.sql` + `seed.sql` | ✅ phpMyAdmin-এ import করতে হবে |
| `storage/logs`, `storage/ratelimits`, `uploads/images`, `uploads/videos` | ✅ auto-create, কিন্তু permission `755` দিতে হবে |
| `admin/setup.php` | ✅ first admin বানানোর page (auto-lock) |
| `.htaccess` | ✅ Apache security + rewrite rules |
| Railway files (`Dockerfile`, `railway.json` etc.) | ✅ cPanel-এ ignore হয়, কোনো ক্ষতি করে না |

---

## 2) Step-by-Step cPanel Deploy

### Step A — File Upload

1. cPanel → **File Manager** → `public_html` খুলুন
2. সব ফাইল upload করুন (ZIP করে upload → Extract করলে fastest)
   - **Important:** Hidden files (`.htaccess`) অবশ্যই upload করতে হবে। File Manager উপরে **Settings → Show Hidden Files** tick দিন
   - Check করুন: `.htaccess` (root), `config/.htaccess`, `includes/.htaccess`, `pages/.htaccess`, `database/.htaccess`, `storage/.htaccess`, `uploads/.htaccess` — ৭টা আছে
3. যদি subdomain হয় (যেমন `mexa.yourdomain.com`), তাহলে তার document root (যেমন `public_html/mexa`) এ upload করুন

### Step B — Database Create

1. cPanel → **MySQL® Databases**
   - নতুন Database বানান: `cpaneluser_mexa`
   - নতুন User বানান: `cpaneluser_mexa_app` (strong password generate করুন)
   - User-কে Database-এ **Add** → **ALL PRIVILEGES** tick
2. cPanel → **phpMyAdmin**
   - বাম পাশে `cpaneluser_mexa` select
   - **Import** → `database/schema.sql` upload → Go
   - আবার **Import** → `database/seed.sql` upload → Go
   - ৮টা table create হবে: `settings`, `services`, `packages`, `work_items`, `team_members`, `reviews`, `messages`, `admins`

> Alternative: Terminal থাকলে: `php database/seed.php` — কিন্তু phpMyAdmin-ই easiest।

### Step C — `.env` Create (সবচেয়ে গুরুত্বপূর্ণ)

1. cPanel File Manager-এ `public_html/.env.example` খুলুন → **Copy** করে `.env` নামে নতুন file বানান
2. `Edit` করে নিচের মত fill করুন:

```ini
APP_ENV=production
APP_NAME="Mexa Motion"
APP_URL="https://yourdomain.com"
APP_TIMEZONE="Asia/Dhaka"

DB_HOST=localhost
DB_PORT=3306
DB_NAME=cpaneluser_mexa
DB_USER=cpaneluser_mexa_app
DB_PASS=আপনার_strong_password_এখানে
DB_CHARSET=utf8mb4

MAIL_FROM="noreply@yourdomain.com"
MAIL_FROM_NAME="Mexa Motion Website"
MAIL_TO="owner@yourdomain.com"

ADMIN_SETUP_KEY=""

MAX_IMAGE_BYTES=5242880
MAX_VIDEO_BYTES=52428800
```

**Note:**
- `APP_URL` → teacher যে domain দেবে সেটা (trailing slash ছাড়া)
- `DB_HOST` → cPanel-এ সাধারণত `localhost` বা `127.0.0.1` (Hostinger/Namecheap সবাই localhost support করে)
- `MAIL_TO` → booking/contact form submit হলে এই email-এ notification যাবে (যদি mail server config থাকে, না থাকলেও site চলবে)

### Step D — Permissions

File Manager-এ right-click → **Permissions**:

| Path | Permission |
|------|------------|
| `storage/` + ভিতরের সব folder | `755` (rwxr-xr-x) |
| `uploads/images/`, `uploads/videos/` | `755` |
| `.env`, `config/config.php`, `config/db.php` | `640` বা `600` (যাতে public পড়তে না পারে — `.htaccess` already block করে, তবুও) |
| বাকি PHP files | `644` (default) |

cPanel Terminal থাকলে:
```bash
chmod 755 storage storage/logs storage/ratelimits uploads uploads/images uploads/videos
chmod 640 .env config/config.php config/db.php
```

### Step E — PHP Version Check

cPanel → **Select PHP Version** বা **MultiPHP Manager**
- PHP version: **8.0, 8.1, 8.2 বা 8.3** select করুন
- Extensions tick: `pdo_mysql`, `mbstring`, `fileinfo`, `gd`, `curl`, `zip`, `openssl`
- `display_errors` → Off (production), `upload_max_filesize` → 64M

### Step F — First Admin Create

Browser-এ যান:
```
https://yourdomain.com/admin/setup.php
```

Username (3-60 chars), Email, Password (min 10 chars) দিয়ে **Create Admin** করুন।
- Success হলে auto `admin/index.php` (Dashboard) এ যাবে
- `setup.php` permanently lock হয়ে যাবে (আবার visit করলে `login.php` এ redirect)

### Step G — Verify (Teacher Check এর আগে)

- Homepage: `https://yourdomain.com/` → hero, services, work, reviews সব load হচ্ছে?
- `https://yourdomain.com/service.php` → services + packages?
- `https://yourdomain.com/work.php`, `review.php`, `team.php`, `book.php` → সব page?
- `https://yourdomain.com/api/health.php` → `{"ok":true,"db":"connected"}` ?
- `https://yourdomain.com/admin/login.php` → login works?
- Security: `https://yourdomain.com/.env` → `403 Forbidden` ? (যদি 403 না আসে, .htaccess active না — hosting support কে বলুন `AllowOverride All` enable করতে)
- Upload test: Admin → Services/Work/Team এ image upload করে দেখুন

---

## 3) Subdomain / Subfolder Deploy

**Subdomain:** `mexa.yourdomain.com`
- Document Root: `public_html/mexa`
- `.env` এ: `APP_URL="https://mexa.yourdomain.com"`

**Subfolder:** `yourdomain.com/mexa/`
- File path: `public_html/mexa/`
- `.env` এ: `APP_URL="https://yourdomain.com/mexa"`
- `.htaccess` subfolder-এও কাজ করবে — কিন্তু যদি CSS 404 আসে, hosting কে বলুন `mod_rewrite` enable করতে

---

## 4) Troubleshooting (cPanel-এ common error)

| Error | কারণ | Fix |
|-------|------|-----|
| `Service temporarily unavailable` (plain text) | `.env` missing বা `DB_NAME/DB_USER` খালি | File Manager-এ `public_html/.env` আছে কিনা check, `DB_*` vars fill করুন |
| `Database connection failed` (HTML card) | DB password/host ভুল, বা user privileges নেই | cPanel → MySQL Databases → user password reset + ALL PRIVILEGES re-add |
| `500 Internal Server Error` | PHP version পুরনো (7.4) বা `.htaccess` syntax error | PHP 8.1+ select করুন, Error Logs check করুন (cPanel → Errors) |
| CSS/JS load হচ্ছে না (plain HTML) | `assets/` folder upload হয়নি বা permission 403 | File Manager-এ `assets/css/` আছে কিনা check, permission 755 |
| `403 Forbidden` on every page | `public_html` permission 750 বা `.htaccess` deny | Permission 755 করুন, root `.htaccess` আছে কিনা check |
| Upload fails: `Upload directory could not be created` | `uploads/` permission নেই | `chmod 755 uploads/uploads/images/uploads/videos` |
| `Session error` | `storage/` not writable | `chmod 755 storage/storage/logs/storage/ratelimits` |
| Email যায় না | cPanel mail not configured | Normal — site চলবে, শুধু notification email যাবে না। cPanel → Email Accounts → SMTP config থাকলে যাবে |

Logs কোথায়:
- cPanel → **Errors** (Apache error log)
- `storage/logs/php-error.log` (app error log — `APP_ENV=production` হলে এখানে log হয়)
- Browser → F12 → Network tab → failed request এর status দেখুন

---

## 5) Teacher Presentation Checklist

Teacher কে দেখানোর আগে:

- [ ] `public_html/.env` production values দিয়ে ready
- [ ] `admin/setup.php` দিয়ে admin account বানানো আছে (teacher কে credentials দিন)
- [ ] Homepage + 6 টা page (service, work, review, team, book) সব working
- [ ] Admin panel login → CRUD (services, packages, work, team, reviews, messages, settings) test করা
- [ ] Mobile responsive check (phone থেকে দেখুন)
- [ ] `api/health.php` → DB connected
- [ ] `.env` direct access → 403

ZIP দিতে হলে:
- `uploads/images/*` (except `.gitkeep`), `uploads/videos/*`, `storage/logs/*`, `storage/ratelimits/*` বাদ দিয়ে ZIP করুন
- `.env` ফাইল ZIP-এ দেবেন না (teacher নিজে `.env.example` থেকে বানাবে) — security reason

---

## 6) Railway vs cPanel — একই code দুই জায়গায় চলবে

- **Railway preview:** `Dockerfile` + `railway.json` auto use হয় (cPanel এ ignore)
- **cPanel production:** plain PHP + Apache + phpMyAdmin (Railway files কোনো effect করে না)
- **`.env` priority:** `DB_HOST` থাকলে cPanel mode, না থাকলে Railway `MYSQLHOST`/`DATABASE_URL` fallback — তাই একই `config/db.php` দুই জায়গায় কাজ করে
- **Teacher কে বলুন:** Railway ছিল শুধু preview এর জন্য, final production cPanel-এ — code 100% cPanel compatible

---

Need help? Check `README.md` Section 6 (cPanel Deploy) + `RAILWAY_DEPLOY.md` (Railway preview).

# MEXA MOTION — cPanel hosting setup guide

> এই ডকUMENT শুধু source code ও setup নির্দেশনা। Agent/developer cPanel-এ কোনো পরিবর্তন, upload বা deployment করেনি। `.env`-এর কোনো গোপন মান এখানে নেই।

## ১. প্রথমে cPanel-এ যাচাই করুন (browser থেকেই করা যায়)

| যাচাই | cPanel-এ কোথায় দেখবেন | কী থাকতে হবে |
|---|---|---|
| PHP version | `Software → Select PHP Version` বা `MultiPHP Manager` | PHP **8.2+** (Laravel 12 / `composer.lock`-এ `v12.70.2`) |
| PHP extensions | `Select PHP Version → Options/Extensions` | `ctype, curl, dom, fileinfo, filter, hash, iconv, json, libxml, mbstring, openssl, pcre, pdo, pdo_mysql, session, tokenizer, xml`। `zip/gd/intl/exif/bcmath` সুবিধাজনক, runtime-এ আবশ্যক নয় |
| MySQL | `Databases → MySQL® Database Wizard` | নতুন database + user, user-কে **ALL PRIVILEGES**, cPanel-এ দেখানো host/port/name/user/password নোট করুন |
| Composer / Terminal | cPanel Home-এ `Terminal` / `SSH Access`, বা Terminal-এ `composer --version` | থাকলে CLI path; **না থাকলে নিচের "no-Terminal" path ব্যবহার করুন** |
| SSL / HTTPS | `SSL/TLS Status` বা AutoSSL | সক্রিয় HTTPS certificate |
| Document root | `Domains → Manage → Document Root` | সাধ্যমত `public/`; না হলে project-root rewrite (নিচে দেখুন) |
| File Manager | `Files → File Manager → Settings → Show Hidden Files` | `.env`, `.htaccess`, `.gitignore` দেখতে হবে |

> cPanel সাধারণত DB host হিসেবে একটি নির্দিষ্ট মান দেখায়; সেটিই `.env`-এ বসান। কোনো local address, server path বা XAMPP-default অনুমান করবেন না। Production `APP_URL` হবে আপনার real HTTPS domain, local URL নয়।

## ২. স্থানীয় প্রস্তুতি (Terminal ছাড়াও করা যায়)

1. নিজের কম্পিউটারে PHP 8.2+ ও Composer দিয়ে, repo root-এ শুধু dependency build করুন:

   ```bash
   composer install --no-dev --optimize-autoloader --prefer-dist
   ```

   `composer update` করবেন না; `composer.lock` অনুসরণ করুন। `vendor/` Git-ignore করা, কিন্তু cPanel-এ runtime-এ **আবশ্যক** — তাই zip-এ `vendor/` সহ আপলোড করুন, Git-এ নয়।

2. Local machine-এর cache আপলোড করবেন না (এতে local absolute path থাকতে পারে):

   - `bootstrap/cache/*.php` মুছে দিন; `bootstrap/cache/.gitkeep` রাখুন।
   - `storage/framework/views/*`, `storage/framework/cache/data/*`, `storage/framework/sessions/*`, `storage/logs/*` পরিষ্কার করুন; প্রতিটি `.gitignore` marker রাখুন।
   - Laravel প্রথম request-এ `bootstrap/cache/` নতুন করে package manifest তৈরি করবে, তাই ঐ ডিরেক্টরি writable হতে হবে।

3. Production `.env` তৈরি করুন `.env.example` থেকে। সব `replace-with-...` placeholder বদলান; `.env` কখনো Git-এ তুলবেন না।
   - `APP_KEY`: নিজের machine-ে `php artisan key:generate --show` চালিয়ে পাওয়া মান বসান; অথবা নিচের temporary preflight script দিয়ে একবার জেনারেট করুন। মান কোথাও শেয়ার/লগ করবেন না।
   - Terminal/Composer না থাকলে cPanel-এ `composer install` বা `php artisan key:generate` চালানোর দরকার নেই।

4. প্রস্তুত zip-এ থাকবে: `app/`, `bootstrap/`, `config/`, `database/`, `public/`, `resources/`, `routes/`, `vendor/`, `composer.json`, `composer.lock`, `.htaccess`, `.env.example`, ডকUMENT ও marker files। `.env` zip-এ না রেখে cPanel File Manager-এ আলাদাভাবে তৈরি করা নিরাপদ।

## ৩. Upload ও document root — দুটি নিরাপদ অপশন

### অপশন A (সবচেয়ে নিরাপদ): app `public_html`-এর বাইরে

1. cPanel File Manager-এ home directory-তে একটি ফোল্ডার, যেমন `mexa_app/`, তৈরি করে পুরো project extract করুন।
2. `Domains → Manage → Document Root` থেকে domain-এর root `mexa_app/public` করুন (cPanel UI-তে আপেক্ষিক path দিন; কোনো hardcoded server path source-এ নেই)।
3. `.env`, `app/`, `config/`, `storage/`, `vendor/`, `database/` তখন public web root-এর বাইরে থাকে — সরাসরি URL দিয়ে পৌঁছানো যায় না।

### অপশন B (document root বদলানো না গেলে): project root-ই web root

1. পুরো project `public_html/`-এ (বা addon domain-এর root-এ) extract করুন; ভেতরের `public/` ফোল্ডারটি রাখুন।
2. Root `.htaccess` সব web request-কে `public/`-এ পাঠায় এবং `app/`, `bootstrap/`, `config/`, `database/`, `docs/`, `resources/`, `routes/`, `scripts/`, `storage/`, `vendor/`, `.env*`, `.git*`, `composer.*`, `artisan`, SQL/log/md/key/pem ইত্যাদি সরাসরি deny করে।
3. প্রতিটি private ডিরেক্টরিতে আলাদা `.htaccess` (`Require all denied`) আছে, তাই mod_rewrite বন্ধ হলেও private files serve হবে না।
4. `/.well-known/` কে rewrite/deny থেকে exempt রাখা হয়েছে, ফলে cPanel AutoSSL/SSL validation কাজ করে। যদি document root `public/` করা হয় এবং cPanel validation file `public_html/.well-known/`-এ থাকে, তখন সেটি `public/.well-known/`-এ কপি করুন বা DNS validation ব্যবহার করুন।
5. `.env`, `app/`, `storage/`, `vendor/` কখনো `public/` ফোল্ডারের **ভেতরে** রাখবেন না।

> Root `.htaccess`-এ `Options -Indexes` নেই; directory listing `IndexIgnore *` ও per-directory deny দিয়ে আটকানো হয়, যাতে `AllowOverride Options` সীমিত cPanel-এ 500 না হয়। `public/.htaccess`-এ `mod_rewrite` ও Laravel front controller আছে।

## ৪. Database setup — populated DB থাকলে কিছুই import করবেন না

### যদি আগের populated MySQL database থাকে

- শুধু `.env`-এ cPanel-এর DB host/port/name/user/password দিন।
- **কোনো SQL import, `migrate`, `migrate --seed`, `migrate:fresh`, `truncate` বা reseed করবেন না।**
- ডাটা, admin users, reviews, team proposals ও uploaded media আগের জায়গায় অক্ষত থাকবে।

### নতুন ফাঁকা database, Terminal/Composer থাকলে

```bash
php artisan migrate --force
```

`--seed` লাগবে না: `SiteData::defaults()` bundled `database/seeders/data/site-snapshot.json` থেকে starter content দেখায়; admin থেকে প্রথম save-ই `site_data` তৈরি করে।

### নতুন ফাঁকা database, Terminal/SSH নেই

1. `MySQL® Database Wizard` দিয়ে নতুন ফাঁকা database + user বানিয়ে privileges দিন।
2. `phpMyAdmin → নতুন database select → Import → database/schema/cpanel-mysql.sql → Go`।
3. SQL-টি **schema-only, non-destructive**: শুধু `CREATE TABLE IF NOT EXISTS` ও `INSERT IGNORE` আছে; কোনো `DROP/DELETE/TRUNCATE/UPDATE` বা content row নেই। তবুও populated DB-তে import করবেন না।
4. `migrations` table-এ ৫টি migration-এর নাম batch 1 হিসেবে দেওয়া আছে, তাই পরে Terminal পেলে `php artisan migrate --force` টেবিল আবার তৈরি করবে না।
5. প্রথম `/admin/setup`-এ owner account তৈরি করুন; setup একবার হয়ে গেলে বন্ধ হয়ে যায়। এরপর `/admin`।

## ৫. Storage permissions ও symbolic link

File Manager-এ hidden files দেখিয়ে নিচের relative ডিরেক্টরিগুলো আছে কি না যাচাই করুন; repo-তে এখন `.gitignore`/`.htaccess` marker আছে:

- `storage/`, `storage/app/public/media/`, `storage/app/private/`, `storage/app/private/backups/`
- `storage/framework/cache/data/`, `storage/framework/sessions/`, `storage/framework/views/`, `storage/framework/testing/`
- `storage/logs/`, `bootstrap/cache/`

Permission: files `644`, directories `755`; `storage/` ও `bootstrap/cache/` PHP user দ্বারা writable হতে হবে (host চাইলে `775`, তবে `777` শেষ উপায় হিসেবেও স্থায়ী রাখবেন না)। `public/storage` **symlink আবশ্যক নয়** — `/storage/media/{file}` custom Laravel route `media_assets`-এ registered ফাইল সার্ভ করে। `php artisan storage:link` চালানোর দরকার নেই। Symlink দিলেও `public/.htaccess` `/storage/media/...` কে সবসময় `index.php`-এ পাঠায় এবং অন্য `/storage/...` direct access deny করে; `storage/app/public/.htaccess`-ও direct access আটকে দেয়।

Prebuilt `vendor/` আপলোড করার পর `vendor/.htaccess` হিসেবে [`cpanel/vendor-deny.htaccess`](cpanel/vendor-deny.htaccess) কপি করলে private dependency files-ও সরাসরি অ্যাক্সেসযোগ্য হবে না (root `.htaccess`-এও `/vendor/` deny আছে)।

## ৬. Production `.env` (কোনো মান এখানে লেখা হয়নি)

| Key | Production মান |
|---|---|
| `APP_ENV` | `production` |
| `APP_DEBUG` | `false` |
| `APP_URL` | আপনার real HTTPS domain; subdirectory হলে সেটিও URL-এ যোগ করুন, trailing slash নয় |
| `APP_KEY` | locally generated `base64:...` মান |
| `DB_CONNECTION` | `mysql` |
| `DB_HOST`, `DB_PORT`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD` | cPanel MySQL® Databases-এ দেখানো মান |
| `DB_CHARSET` / `DB_COLLATION` | `utf8mb4` / `utf8mb4_unicode_ci` |
| `SESSION_SECURE_COOKIE` | `true` (HTTPS) |
| `SESSION_ENCRYPT`, `SESSION_HTTP_ONLY` | `true` |
| `CACHE_STORE` / `QUEUE_CONNECTION` | `file` / `sync` |
| `FILESYSTEM_DISK` | `local` defaults ঠিক আছে; uploads সবসময় explicitly `public` disk ব্যবহার করে |
| `IMGBB_API_KEY` | ফাঁকা রাখা যায়; legacy, local uploads-এ প্রয়োজন নেই |

`.env.example`-এ placeholder আছে; source code-এ কোনো server path, local URL, `root`/empty DB password বা XAMPP-নির্ভর production setting হার্ডকোড নেই।

## ৭. Temporary preflight (Terminal না থাকলেও)

1. আপলোডের **আগে** `public/cpanel-preflight.php`-এর `$token` একটি দীর্ঘ random মান দিয়ে বদলান।
2. Site-এ `https://your-real-domain/cpanel-preflight.php` খুলে token POST form-এ দিন (URL-এ token দেবেন না)।
3. Report-এ দেখুন: PHP 8.2+, required extensions, `pdo_mysql`, HTTPS, upload limits (`upload_max_filesize ≥ 210M`, `post_max_size ≥ 215M`, `memory_limit ≥ 256M`, `max_execution_time ≥ 300`), project files, writable dirs, `.env` settings (মান প্রিন্ট হয় না)।
4. `./service` লিংক খুলে `index.php` ছাড়া পেজ লোড হলে `mod_rewrite`/`AllowOverride` কাজ করছে; 403/404 হলে host-কে `mod_rewrite` ও `.htaccess` override চালু করতে বলুন।
5. চাইলে একবার `APP_KEY` জেনারেট করে `.env`-এ বসান; মান শেয়ার করবেন না।
6. **কাজ শেষে `public/cpanel-preflight.php` সার্ভার থেকে মুছে দিন।** এটি শুধু temporary diagnostic; কোনো `.env` মান, absolute path বা full PHP configuration dump প্রকাশ করে না।

Upload limit কম হলে `Software → MultiPHP INI Editor`-এ বাড়ান; Apache/PHP-FPM/reverse proxy/ModSecurity-এর body limit-ও 200 MB ভিডিওর জন্য যাচাই করুন।

## ৮. সেটআপের পর যাচাই

- `/`, `/service`, `/work`, `/reviews`, `/team`, `/book` — সব পেজ HTTPS-এ খোলে; CSS/JS লোড হয়।
- `/admin` login কাজ করে; Homepage copy save, media library upload, video library, review approve ও team-profile approve আগের মতোই চলে।
- Media library-তে ছবি/ভিডিও আপলোড → `storage/app/public/media/`-এ UUID file → `/storage/media/{uuid}.{ext}` browser-এ খোলে → `media_assets`-এ URL/MIME/size/provider row → admin "Use URL" বা video form সেই URL পেজে বসায়।
- `git status`/GitHub-এ `.env`, uploaded binaries, DB dump বা backup উঠছে না; `.gitignore` সেগুলো বাদ দেয়।

## ৯. Backup ও ভবিষ্যৎ schema change

- নিয়মিত MySQL dump + `storage/app/public/media/` backup নিন; ignored non-public path-এ রাখুন, off-server কপি রাখুন, GitHub-এ নয়।
- Schema পরিবর্তনের আগে verified backup, additive/nullable column বা নতুন table, existing row থেকে backfill, row count/checksum ও admin/public page যাচাই; বিস্তারিত [`PROJECT_MAP.md`](PROJECT_MAP.md)।
- Populated database-এ `migrate:fresh`, `truncate`, `migrate --seed` বা database file replace কখনো করবেন না।

## ১০. ডাটা কোথায় থাকে (সংক্ষেপে)

- **Live text/settings/content:** MySQL `site_data.payload` — ডাটাবেসের ভেতরের JSON কলাম, আলাদা JSON file store নয়।
- **Media URL/metadata:** MySQL `media_assets`; **video records/placements:** `video_library` + `video_placements`।
- **Actual image/video bytes:** শুধু persistent `storage/app/public/media/`; JSON/DB text/GitHub source-এ নয়।
- **`site-snapshot.json`:** starter/import snapshot ও missing-section fallback; primary data বা backup নয়। Backup/export হিসেবে ignored `storage/app/private/backups/` বা DB dump ব্যবহার করুন।
- **Admin permissions / review & team approval:** অপরিবর্তিত; এই guide শুধু hosting setup।

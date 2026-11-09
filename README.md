# Mexa Motion — Laravel website

ওয়েবসাইটের সব public page Laravel Blade view-এ `resources/views/pages/`-এর মধ্যে আছে। Shared head/video assets এবং mobile booking markup `resources/views/pages/partials/`-এ; reusable CSS/JavaScript `public/`-এ থাকে। Services, packages, team, work/video, reviews, bookings এবং site settings MySQL-এ থাকে। `/admin`-এ login করে visual page editor, content manager ও media library ব্যবহার করুন।

কোন ফাইল কোন অংশ পরিচালনা করে এবং পরবর্তী developer/agent-এর জন্য project rules জানতে [`AGENTS.md`](AGENTS.md) ও [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md) দেখুন। cPanel hosting setup-এর জন্য [`docs/CPANEL_DEPLOYMENT.md`](docs/CPANEL_DEPLOYMENT.md) দেখুন।

## Local XAMPP setup (development only)

> এই অংশ শুধু local development-এর জন্য। cPanel production-এ local URL, server path বা XAMPP default হার্ডকোড করবেন না; [`docs/CPANEL_DEPLOYMENT.md`](docs/CPANEL_DEPLOYMENT.md) ও `.env.example`-এর placeholder অনুসরণ করুন।

প্রয়োজন: PHP 8.2+, Composer, MySQL/MariaDB, Apache `mod_rewrite` এবং `AllowOverride All`।

1. প্রজেক্টটি `C:\xampp\htdocs\mexa-motion-blue`-এ রাখুন এবং XAMPP Control Panel থেকে Apache ও MySQL চালু করুন।
2. phpMyAdmin-এ `mexa_motion` নামে একটি `utf8mb4_unicode_ci` database তৈরি করুন।
3. `.env` ফাইলে `APP_URL=http://localhost/mexa-motion-blue` এবং আপনার MySQL username/password দিন। XAMPP-এর নতুন local install-এ সাধারণত username `root` এবং password ফাঁকা থাকে।
4. প্রজেক্ট ফোল্ডারে Composer dependency install করুন:

   ```powershell
   C:\xampp\php\php.exe C:\xampp\php\composer.phar install
   ```

5. Laravel key তৈরি করে শুধু নতুন ফাঁকা database-এ schema প্রয়োগ করুন:

   ```powershell
   C:\xampp\php\php.exe artisan key:generate
   C:\xampp\php\php.exe artisan migrate --force
   ```

   `migrate --seed` শুধুমাত্র একেবারে নতুন ফাঁকা database-র ক্ষেত্রে ঐচ্ছিক; populated database-এ কখনো চালাবেন না। `SiteData::defaults()` bundled `site-snapshot.json` থেকে starter content দেখায়, তাই seed ছাড়াও পেজ দেখা যায়।

6. ব্রাউজারে `http://localhost/mexa-motion-blue` খুলুন। প্রথমে `/admin/setup`-এ admin account তৈরি করুন; এরপর `http://localhost/mexa-motion-blue/admin` থেকে sign in করুন। Setup একবার account তৈরি হলে বন্ধ হয়ে যায়।

প্রজেক্টের root `.htaccess` request-গুলো `public/`-এ পাঠায়, তাই XAMPP subfolder থেকেও `/admin` route কাজ করে। Apache-তে `mod_rewrite` সক্রিয় এবং project directory-র জন্য `.htaccess` অনুমোদিত থাকতে হবে। কোনো আলাদা web root তৈরি করলে Apache `DocumentRoot` সরাসরি project-এর `public/` directory-তে দিন।

## Website media uploads

Admin dashboard-এর **Media library** থেকে JPG, PNG, WebP বা GIF image (8 MB পর্যন্ত), এবং MP4, WebM বা Ogg video (200 MB পর্যন্ত) সরাসরি ওয়েবসাইটে upload করা যায়। File `storage/app/public/media/`-এ রাখা হয়; file URL ও metadata `media_assets` table-এ save হয়। Uploaded files public media route দিয়ে পরিবেশন করা হয়, তাই আলাদা ImgBB account বা API key লাগে না। Production server-এ storage directory persistent রাখুন এবং নিয়মিত তার backup নিন। PHP ও web server-এর request upload limit 200 MB-এর বেশি হতে হবে, না হলে বড় video upload আটকে যাবে।

## Admin features

- Owner dashboard-এর **Home Page Management** থেকে hero copy/media, homepage section visibility/order, SEO, branding, footer, social এবং purchase/contact তথ্য নিয়ন্ত্রণ করা যায়।
- Services, per-service quality packages, founder/team members, work videos, portfolio items, reviews, bookings এবং public site settings-এর CRUD। Package currency USD, USDT বা BDT বেছে নিয়ে প্রতিটি currency-র আলাদা amount রাখা যায়; স্বয়ংক্রিয় conversion হয় না।
- Page editor দিয়ে Home, Service, Work, Reviews, Team ও Booking পেজে থাকা text, image, link ও tooltip বেছে নিয়ে update করা যায়; section box দেখানো/লুকানো এবং তার অবস্থানও নিয়ন্ত্রণ করা যায়।
- Review submissions admin approve না করা পর্যন্ত public হয় না। Team member-কে private profile-update link দিলে তার প্রস্তাবও approval না হওয়া পর্যন্ত public profile বদলায় না। Booking tickets admin status update করতে পারে।
- প্রথম setup account হলো **Owner**। Owner dashboard থেকে সীমিত **Moderator** account তৈরি/নিষ্ক্রিয় করতে পারে; Moderator শুধু pending review ও team profile proposal পর্যালোচনা করতে পারে।
- Admin password প্রথম login setup-এ hash করে save হয়; dashboard থেকে password পরিবর্তন করা যায়। Login rate-limited এবং session ID login-এ regenerate করা হয়।
- Video link resolver YouTube, Facebook, Google Drive, Vimeo, Dailymotion ও common direct video URL চেনে। সরাসরি embed না হলে secure external link দেখায়।

## Video library

Admin dashboard-এর **Video library** থেকে YouTube, Facebook, Google Drive, Vimeo, Dailymotion, Streamable, Catbox এবং MP4/WebM/HLS direct video URL যোগ বা পরিচালনা করুন। একটি entry Home showreel, Service overview/cards/demos অথবা Work-এর video sections-এ assign করা যায়। Link, title, description, thumbnail, category, featured status ও display order একই record থেকে সম্পাদনা করা যায়; public page-এ পরিবর্তন database থেকে প্রতিফলিত হয়।

Video player desktop ও mobile-এ responsive। Direct media native browser controls দিয়ে চলে; HLS-এর জন্য Safari-এর native playback ব্যবহার হয় এবং অন্য সমর্থিত browser-এ hls.js player যুক্ত হয়। Video host-এর embed permission, privacy setting এবং CORS policy playback প্রভাবিত করতে পারে। YouTube-এর thumbnail স্বয়ংক্রিয়ভাবে পাওয়া গেলে সেটি ব্যবহার হয়; অন্য source-এর thumbnail Admin থেকে দেওয়া যায়। অচেনা host-কে iframe-এ না ঢুকিয়ে নিরাপদ external link হিসেবে দেখানো হয়।

নতুন ফাঁকা database-এ schema প্রয়োগ করতে XAMPP MySQL চালু করে project root-এ চালান:

```powershell
C:\xampp\php\php.exe artisan migrate --force
```

Populated database-এ কখনো `migrate --seed`, `migrate:fresh` বা reseed করবেন না। cPanel-এ Terminal না থাকলে [`database/schema/cpanel-mysql.sql`](database/schema/cpanel-mysql.sql) phpMyAdmin দিয়ে import করুন ([`docs/CPANEL_DEPLOYMENT.md`](docs/CPANEL_DEPLOYMENT.md))।

## Deployment

- Production server-এ `APP_ENV=production`, `APP_DEBUG=false`, HTTPS এবং `SESSION_SECURE_COOKIE=true` ব্যবহার করুন। `APP_KEY` ও database credentials secret হিসেবে রাখুন।
- Web server-এর document root সাধ্যমত Laravel-এর `public/` directory; storage ও `.env` public web root-এর বাইরে রাখুন। cPanel-এ document root বদলানো না গেলে root `.htaccess` private files deny করে `public/`-এ rewrite করে; `/.well-known/` AutoSSL-র জন্য exempt।
- নতুন ফাঁকা database-এ `php artisan migrate --force` (Terminal থাকলে) অথবা phpMyAdmin-এ non-destructive [`database/schema/cpanel-mysql.sql`](database/schema/cpanel-mysql.sql) import (Terminal না থাকলে)। Populated database-এ import/migrate/seed/reseed করবেন না।
- `storage/` ও `bootstrap/cache/` writable রাখুন; PHP 8.2+, Laravel 12 extensions, 200 MB upload limits, `mod_rewrite`/`AllowOverride` ও HTTPS যাচাই করুন। `public/storage` symlink ঐচ্ছিক — custom `/storage/media/{file}` route যথেষ্ট।
- Production-এ `.env`-এ cPanel-প্রদত্ত DB host/name/user/password ও real HTTPS `APP_URL` দিন; `.env.example`-এ placeholder আছে, source-এ কোনো local/XAMPP setting হার্ডকোড নেই। বিস্তারিত [`docs/CPANEL_DEPLOYMENT.md`](docs/CPANEL_DEPLOYMENT.md)।
- MySQL backup নিয়মিত নিন এবং `site_data`, `media_assets`, video tables ও `storage/app/public/media/` অন্তর্ভুক্ত করুন।

## Data notes

Seeder bundled site snapshot-এ থাকা services, founder/team, portfolio, demo video এবং public review content database-এ আনে। আগের browser-local booking/review state শুধু সেই browser-এ ছিল, তাই অন্য browser-এর সেই পুরোনো state সার্ভারে ফেরানো যায় না; নতুন submission MySQL-এ সংরক্ষিত হয়।


## Data ownership, backup and safety

- **মূল ডাটা MySQL-এ:** সাইটের লেখা, settings, services, packages, team, portfolio, reviews ও bookings `site_data` table-এর `payload` JSON কলামে থাকে; media URL/metadata `media_assets`-এ এবং video records/placements `video_library` ও `video_placements`-এ থাকে। অ্যাডমিন প্যানেল থেকে save হলে সরাসরি এই database-এ লেখা হয়।
- `database/seeders/data/site-snapshot.json` শুধু নতুন ডাটাবেসের starter/import snapshot ও অনুপস্থিত section-এর fallback। এটি live data store বা backup নয়; অ্যাডমিনের সম্পাদনা এখানে নকল করবেন না। Backup/export হিসেবে timestamped database dump বা JSON export ignored, non-public path-এ (যেমন `storage/app/private/backups/`) রাখুন, যাচাই করে off-server কপি রাখুন এবং GitHub-এ commit করবেন না।
- আপলোড করা JPG/PNG/WebP/GIF ও MP4/WebM/Ogg ফাইল `public` disk-এর `storage/app/public/media/`-এ UUID নামে সংরক্ষিত হয়; extension validated MIME type থেকে নেওয়া হয়। `/storage/media/{file}` URL তৈরি করে `media_assets`-এ URL, MIME, byte size, provider ও timestamps লেখা হয়। Admin media library-র “Use URL” বা upload response-এর URL পেজের সংশ্লিষ্ট field-এ বসে; সেখান থেকে page override, hero media ও video catalog সেটি public পেজে দেখায়। ফাইলের বাইনারি/`data:` URI JSON, database text field বা source code-এ রাখা হয় না।
- Legacy Blade template-এ থাকা inline base64 design images static design asset, uploaded media নয়; অনুমোদিত ডিজাইন অক্ষত রাখতে সেগুলো এখানে অপরিবর্তিত রাখা হয়েছে।
- `.gitignore` এখন `.env` variants, credentials, `storage/app/public/media/`-এর uploaded files, database dump ও backup folder বাদ দেয়। `storage/app/public/media/.gitignore` folder-টি track করে কিন্তু uploaded binaries কখনো Git-এ আসবে না। `.env`, `APP_KEY`, DB password বা `IMGBB_API_KEY` কখনো log/commit করবেন না।
- কোনো database schema পরিবর্তনের আগে database ও uploaded media-র verified backup নিন, শুধু additive/nullable column বা নতুন table যোগ করুন, পুরনো row থেকে backfill করুন, row count/checksum ও admin/public page যাচাই করুন। Populated database-এ `migrate:fresh`, `truncate` বা `migrate --seed` চালাবেন না। বিস্তারিত plan [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md)-এ আছে।

## Cloudflare / reverse-proxy preview

শুধু প্রিভিউ দেখতে ও অ্যাডমিন থেকে আপডেট করতে Cloudflare/Tunnel-এর সামনে Laravel-এর PHP runtime চালাতে হবে; Cloudflare Pages/Workers নিজে PHP/Blade চালায় না। Proxy-aware HTTPS URL/cookie, dynamic preview router ও start script-এর নির্দেশনা [`docs/CLOUDFLARE_PREVIEW.md`](docs/CLOUDFLARE_PREVIEW.md)-এ আছে। `.env`-এ প্রকৃত HTTPS `APP_URL`, `TRUSTED_PROXIES` ও `SESSION_SECURE_COOKIE=true` দিন; localhost বা server path হার্ডকোড করবেন না। Live preview-এর জন্য repo root থেকে `bash scripts/start-preview.sh` চালান।

## cPanel hosting

cPanel-এ PHP 8.2+/extensions, MySQL, Composer/Terminal, document root, `.htaccess` rewrite, private file protection, permissions, symlink-বিকল্প media route ও `.env` যাচাই করার পূর্ণ ধাপ-ভিত্তিক নির্দেশনা [`docs/CPANEL_DEPLOYMENT.md`](docs/CPANEL_DEPLOYMENT.md)-এ আছে। Terminal/Composer না থাকলেও prebuilt `vendor/`, phpMyAdmin schema import, File Manager ও temporary [`public/cpanel-preflight.php`](public/cpanel-preflight.php) দিয়ে নিরাপদে সেটআপ করা যায়। Production-এ কোনো server path, local URL বা XAMPP-নির্ভর মান হার্ডকোড করা হয়নি; সব environment-নির্ভর মান `.env` থেকে নেওয়া হয়। cPanel-এ নিজে কোনো deployment বা পরিবর্তন করা হয়নি।

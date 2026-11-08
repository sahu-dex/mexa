# Mexa Motion — Laravel website

ওয়েবসাইটের সব public page Laravel Blade view-এ `resources/views/pages/`-এর মধ্যে আছে। Shared head/video assets এবং mobile booking markup `resources/views/pages/partials/`-এ; reusable CSS/JavaScript `public/`-এ থাকে। Services, packages, team, work/video, reviews, bookings এবং site settings MySQL-এ থাকে। `/admin`-এ login করে visual page editor, content manager ও media library ব্যবহার করুন।

কোন ফাইল কোন অংশ পরিচালনা করে এবং পরবর্তী developer/agent-এর জন্য project rules জানতে [`AGENTS.md`](AGENTS.md) ও [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md) দেখুন।

## XAMPP setup

প্রয়োজন: PHP 8.2+, Composer, MySQL/MariaDB, Apache `mod_rewrite` এবং `AllowOverride All`।

1. প্রজেক্টটি `C:\xampp\htdocs\mexa-motion-blue`-এ রাখুন এবং XAMPP Control Panel থেকে Apache ও MySQL চালু করুন।
2. phpMyAdmin-এ `mexa_motion` নামে একটি `utf8mb4_unicode_ci` database তৈরি করুন।
3. `.env` ফাইলে `APP_URL=http://localhost/mexa-motion-blue` এবং আপনার MySQL username/password দিন। XAMPP-এর নতুন local install-এ সাধারণত username `root` এবং password ফাঁকা থাকে।
4. প্রজেক্ট ফোল্ডারে Composer dependency install করুন:

   ```powershell
   C:\xampp\php\php.exe C:\xampp\php\composer.phar install
   ```

5. Laravel key তৈরি করে schema ও মূল website content import করুন:

   ```powershell
   C:\xampp\php\php.exe artisan key:generate
   C:\xampp\php\php.exe artisan migrate --seed
   ```

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

নতুন database schema প্রয়োগ করতে XAMPP MySQL চালু করে project root-এ চালান:

```powershell
C:\xampp\php\php.exe artisan migrate --seed
```

## Deployment

- Production server-এ `APP_ENV=production`, `APP_DEBUG=false`, HTTPS এবং `SESSION_SECURE_COOKIE=true` ব্যবহার করুন। `APP_KEY` ও database credentials secret হিসেবে রাখুন।
- Web server-এর document root হবে Laravel-এর `public/` directory; storage ও `.env` public web root-এর বাইরে রাখুন।
- Deploy করার আগে `php artisan migrate --force` চালিয়ে `storage/` ও `bootstrap/cache/` directory-তে write permission দিন। PHP-FPM/Apache এবং reverse proxy-তে বড় video upload গ্রহণের সীমাও যাচাই করুন।
- MySQL backup নিয়মিত নিন এবং `site_data` ও `media_assets` table অন্তর্ভুক্ত করুন।

## Data notes

Seeder bundled site snapshot-এ থাকা services, founder/team, portfolio, demo video এবং public review content database-এ আনে। আগের browser-local booking/review state শুধু সেই browser-এ ছিল, তাই অন্য browser-এর সেই পুরোনো state সার্ভারে ফেরানো যায় না; নতুন submission MySQL-এ সংরক্ষিত হয়।


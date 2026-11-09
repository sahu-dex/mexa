# MEXA MOTION — Cloudflare / reverse-proxy preview

> লক্ষ্য **শুধু প্রিভিউ দেখা ও অ্যাডমিন থেকে আপডেট করা**। এটি production/cPanel deployment guide নয়; বর্তমান ডিজাইন, কপি, route, permission বা approval flow বদলানো হয়নি। Cloudflare-এ কোনো deploy বা external change করা হয়নি।

## ১. সবচেয়ে গুরুত্বপূর্ণ কথা

MEXA MOTION একটি **Laravel 12 / PHP 8.2+** অ্যাপ। Cloudflare Pages বা Workers শুধু static/JS runtime দেয়; সেখানে সরাসরি PHP/Blade/MySQL চলে না। তাই:

- PHP runtime (Arena live preview, VPS, cPanel, Docker, বা Tunnel-এর পেছনের নিজের সার্ভার) আগে চালু থাকতে হবে।
- Cloudflare শুধু **proxy / CDN / Tunnel** হিসেবে সামনে থাকবে; browser → HTTPS → Cloudflare → PHP server।
- Arena-তে চলা port **8000**-এর live preview-ই এখন দেখার জন্য যথেষ্ট। Cloudflare ব্যবহার করলে Tunnel/CDN-এর origin হিসেবে সেই PHP server-কেই দিন, কোনো static export নয়।

## ২. সোর্সে কী বদলানো হয়েছে

| ফাইল | কাজ |
|---|---|
| `config/trustedproxy.php` | `TRUSTED_PROXIES` থেকে Cloudflare/Tunnel/proxy-র IP বা `*` নেয়। Empty থাকলে direct hosting-এ আগের মতোই কিছু trust করা হয় না। |
| `bootstrap/app.php` | `Forwarded` ও `X-Forwarded-*` headers পড়ার অনুমতি দেয়, যাতে HTTPS/preview host ধরে URL, redirect, form action ও secure cookie তৈরি হয়। |
| `.env.example` | `TRUSTED_PROXIES` placeholder ও নিরাপদ ব্যবহারের নোট যোগ হয়েছে। কোনো secret বা localhost default যোগ করা হয়নি। |
| `scripts/preview-router.php` | built-in PHP / PHP-WASM server-এর router; project root নিজের অবস্থান থেকে নেয়, কোনো server path হার্ডকোড নেই। |
| `scripts/start-preview.sh` | `0.0.0.0:$PORT` bind করে, native PHP বা `php-wasm-cli` চিনে নিয়ে preview চালায়; `PORT`, `HOST`, `PHP_WASM_CLI`, `PHP_VERSION` environment variable মানে। |
| `scripts/preview/` | PHP/Composer-বিহীন sandbox-এর জন্য PHP-WASM preview tooling: `bootstrap.sh` এক কমান্ডে npm deps + GitHub dist থেকে `vendor/` assemble + `.env` + migration + server চালু করে। বিস্তারিত [`scripts/preview/README.md`](../scripts/preview/README.md)-এ। |
| `.htaccess`, `scripts/.htaccess` | `scripts/` কে public web root থেকে deny করে; project root document root হলেও preview router/start script serve হয় না। |
| `docs/cloudflare-preview.env.example` | শুধু isolated preview-এর `.env` template; Git-এ `.env` আসবে না। |
| `README.md`, `AGENTS.md`, `docs/PROJECT_MAP.md` | এই guide-এর link ও preview rule। |

## ৩. বর্তমান প্রিভিউ চালু রাখা

Arena-র persistent live preview ইতিমধ্যে port 8000-এ চলছে। নতুন করে চালু করতে হলে repo root থেকে:

PHP/Composer নেই এমন sandbox-এ (এক কমান্ডে সব setup সহ):

```bash
bash scripts/preview/bootstrap.sh
```

Native PHP থাকলে:

```bash
bash scripts/start-preview.sh
```

Custom port/runtime দরকার হলে:

```bash
PORT=8000 PHP_WASM_CLI=/path/to/php-wasm-cli bash scripts/start-preview.sh
```

সার্ভার `0.0.0.0` এ bind করে; browser সবসময় Cloudflare/Arena-র **HTTPS preview hostname** ব্যবহার করবে, `localhost`/`127.0.0.1` নয়। Browser-facing JavaScript কোনো local service URL ব্যবহার করে না; public page-এর API call relative `/api/...` path-এ যায়।

## ৪. নতুন ফাঁকা cloud/preview environment

1. Dependency: `composer install --no-dev --optimize-autoloader --prefer-dist` (`composer update` নয়)।
2. `docs/cloudflare-preview.env.example` কে `.env` নামে কপি করুন:
   - `APP_URL` = প্রকৃত HTTPS preview domain (localhost নয়)।
   - `APP_KEY` = একবার `php artisan key:generate --show` থেকে নিন; মান log/commit করবেন না।
   - `TRUSTED_PROXIES=*` শুধু তখনই রাখুন যখন PHP server-এ শুধু trusted proxy/Tunnel দিয়েই পৌঁছানো যায়; সরাসরি exposure থাকলে নির্দিষ্ট proxy IP/CIDR দিন বা ফাঁকা রাখুন।
   - `SESSION_SECURE_COOKIE=true`, `SESSION_HTTP_ONLY=true` রাখুন।
3. **একেবারে নতুন ফাঁকা** SQLite/MySQL database-এ schema দিন: `php artisan migrate --force`। Populated DB-তে `migrate`, `migrate:fresh`, `truncate`, `migrate --seed` বা reseed চালাবেন না। Starter content `SiteData::defaults()` থেকেও পেজ দেখা যায়; seed ঐচ্ছিক এবং শুধু নতুন DB-তে।
4. `bash scripts/start-preview.sh` চালিয়ে `/up`, `/`, `/api/public/content`, `/admin/setup` যাচাই করুন।
5. প্রথমে `/admin/setup`-এ owner account তৈরি করুন, এরপর `/admin` থেকে content/media আপডেট করুন। Setup একবার হলেই বন্ধ হয়।

> **PHP-WASM-only sandbox note:** এই sandbox-এ native PHP নেই; WASM runtime-এ file-session `flock` সমস্যার কারণে শুধু ignored local `.env`-এ `SESSION_DRIVER=database`, `SESSION_TABLE=sessions`, `SESSION_ENCRYPT=false` ব্যবহার করা হয়েছে। Source `config/session.php` ও `.env.example` production-safe আছে। Native PHP preview-এ `SESSION_DRIVER=file`, `SESSION_ENCRYPT=true` ব্যবহার করুন।

## ৫. Cloudflare-side settings (প্রিভিউ)

- DNS/proxy বা Tunnel origin হিসেবে PHP server-টিই দিন; Pages/Workers build command হিসেবে Laravel দেবেন না।
- SSL/TLS: origin-এ valid certificate থাকলে **Full (strict)**; Tunnel ব্যবহার করলে Tunnel-এর নিজস্ব origin setup অনুসরণ করুন। Browser-এ **Always Use HTTPS** চালু রাখুন।
- `/admin*`, `/api/*`, `/up`, `/storage/media/*` — admin update ও dynamic JSON-এর জন্য Cloudflare cache bypass/low cache rule দিন; Rocket Loader/JS minification preview-এ বন্ধ রাখা নিরাপদ।
- `/.well-known/` certificate validation path ব্লক করবেন না; source-এর `.htaccess` guard এটি exempt রাখে।
- Proxy header (`X-Forwarded-Proto/Host/Port/For` বা RFC `Forwarded`) সরাবেন না; Laravel সেগুলো দিয়েই সঠিক HTTPS URL বানায়।

## ৬. যাচাই ও সীমাবদ্ধতা

- সঠিক হলে `/admin/login`-এ form action ও CSS URL `https://<preview-host>/...` হবে, `http://localhost/...` নয়; session cookie-তে `Secure; HttpOnly; SameSite=Lax` থাকবে।
- Admin save, media upload ও public page একই database/route ব্যবহার করে; uploaded binary `storage/app/public/media/`-এ, URL/metadata `media_assets`-এ, লেখা/settings `site_data`-এ থাকে। JSON snapshot starter/fallback মাত্র।
- Preview hostname বদলালে নতুন upload-এ `url()` সঠিক HTTPS host ব্যবহার করবে; আগে save করা absolute media URL নতুন host-এ update বা আবার upload করতে হতে পারে। Source-এ কোনো preview hostname হার্ডকোড নেই।
- `.env`, `APP_KEY`, DB credential, SQLite file, uploaded media, session/cache ও backup কখনো Git-এ তুলবেন না; `.gitignore` সেগুলো ignore করে।
- Cloudflare নিজে PHP extension, MySQL, Apache `mod_rewrite`, AutoSSL বা persistent storage দেয় না; সেগুলো origin PHP server-এর দায়িত্ব। cPanel production setup আলাদা: [`CPANEL_DEPLOYMENT.md`](CPANEL_DEPLOYMENT.md)।
- এই কাজে কোনো commit/push, cPanel deployment, populated database write, design/route/permission/approval পরিবর্তন বা destructive migration করা হয়নি।

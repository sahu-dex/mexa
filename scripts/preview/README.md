# Sandbox preview (PHP-WASM)

এই ফোল্ডারের tooling দিয়ে PHP/Composer নেই এমন sandbox-এও এই Laravel অ্যাপটি চালানো যায় — PHP চলে WebAssembly runtime-এ ([`@php-wasm/node`](https://www.npmjs.com/package/@php-wasm/node)), HTTP request-গুলো একটি ছোট Node bridge (`server.cjs`) Laravel-এর `public/index.php`-তে পাঠায়। এটি **শুধু preview-র জন্য**; production/cPanel setup-এর জন্য [`docs/CPANEL_DEPLOYMENT.md`](../../docs/CPANEL_DEPLOYMENT.md) দেখুন।

## চালানো

```bash
bash scripts/preview/bootstrap.sh
```

এটি এক কমান্ডে সব করে preview চালু করে: npm dependency install → `vendor/` assemble → `.env` তৈরি → migration → server চালু (`0.0.0.0:8000`)। আলাদা করে শুধু server চালাতে চাইলে: `node scripts/preview/server.cjs`।

Prerequisite: Node 18+, Python 3, আর `vendor/` download-এর সময় GitHub API rate limit-এর জন্য `gh` (authenticated) থাকলে ভালো — `GH_TOKEN` env-এ token দেওয়াও যায়।

## ভেতরে কী হয়

| ফাইল | কাজ |
|---|---|
| `bootstrap.sh` | এক কমান্ডে পুরো setup + server চালু করে |
| `install-vendor.py` | `composer.lock`-এ থাকা ৭৪টি package-এর dist zipball `api.github.com` থেকে নামিয়ে `vendor/` বানায় আর `vendor/composer/installed.json` লেখে (packagist unreachable sandbox-এর জন্য) |
| `regen-autoload.py` | `vendor/autoload.php` + psr-4/files/classmap ফাইল তৈরি করে — একটি minimal composer-compatible autoloader |
| `run-artisan.cjs` | artisan command চালায় (যেমন `node run-artisan.cjs migrate '{"--force":true}')`) |
| `server.cjs` | HTTP bridge: static file সরাসরি serve করে, বাকি সব Laravel front controller-এ পাঠায় |

Composer/native PHP available থাকলে সেটিই ব্যবহার করুন — এই tooling শুধু সেগুলো নেই এমন environment-এর জন্য।

## গুরুত্বপূর্ণ সীমাবদ্ধতা ও শেখা কথা (known gotchas)

- **PHP 8.4 ব্যবহার হয়েছে ইচ্ছাকৃতভাবে** — locked `laravel/framework` v12.70-এর base config `Pdo\Mysql` class (PHP 8.4+) reference করে; PHP 8.2/8.3-এ `pdo_mysql` loaded থাকলে config load-এর সময়ই fatal error আসে।
- **`cookieStore: false` আবশ্যক** — `PHPRequestHandler`-এর built-in cookie jar নাহলে client-এর `Cookie` header PHP-তে পৌঁছায় না, ফলে প্রতিটি request নতুন session বানায় (CSRF 419)।
- **Session driver `database`** — php-wasm-এ `flock(LOCK_SH)` fail করে বলে Laravel-এর file-session read সবসময় খালি আসে; `SESSION_DRIVER=database` + `sessions` table (bootstrap তৈরি করে দেয়) দিয়ে এড়ানো হয়। Production-এ native PHP থাকায় file session ঠিকই চলে।
- Static file + PHP request-এর routing, `$_POST`/`$_FILES`/multipart upload, cookie, CSRF, HTTPS URL generation (trusted proxy হয়ে forwarded header-এর মাধ্যমে) — সব verify করা আছে।
- `.env`, `database/database.sqlite`, uploaded media, session/cache কখনো Git-এ তুলবেন না — `.gitignore` সেগুলো already ignore করে।
- Cloudflare নিয়ে বিস্তারিত [`docs/CLOUDFLARE_PREVIEW.md`](../../docs/CLOUDFLARE_PREVIEW.md)-এ; এই স্যান্ডবক্স preview-ই সেই guide-এ বর্ণিত “PHP server behind a proxy” মডেলের একটি implementation।

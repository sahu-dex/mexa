# MEXA MOTION — Cloudflare deployment guide

> এই ডকUMENT শুধু configuration ও deploy নির্দেশনা। এখানে কোনো secret, database credential বা live deployment নেই। `.env`-এর মান কখনো Git/log/chat-এ দেবেন না।

## ১. সবচেয়ে গুরুত্বপূর্ণ কথা (মূল সমস্যার কারণ)

`Could not detect a directory containing static files (e.g. html, css and js) for the project` error-টি আসে কারণ Wrangler/Cloudflare এই প্রজেক্টে **static asset directory** খুঁজছিল, অথচ প্রজেক্টটি একটি **Laravel 12 / PHP 8.4 + MySQL** অ্যাপ্লিকেশন:

| প্রজেক্ট আসলে কী | প্রমাণ |
|---|---|
| PHP 8.2+ / Laravel 12 (`v12.70.2` locked) | `composer.json`, `composer.lock` |
| Server-side rendering (Blade) | `resources/views/pages/*.blade.php`, `public/index.php` |
| Dynamic API + admin + MySQL | `routes/web.php`, `app/Http/Controllers/*`, `database/migrations/*` |
| কোনো JS bundler / build output নেই | `package.json`-এ কোনো build script ছিল না, `public/build` নেই |
| `public/` শুধু CSS/JS/entrypoint শেল | `public/css`, `public/js`, `public/index.php` |

`public/` ফোল্ডারটিতে HTML নেই — এটি PHP front controller-এর directory, static site-এর output নয়। তাই এখানে **Cloudflare Pages বা Workers Static Assets ব্যবহার করা যাবে না**: ওখানে PHP/Blade/MySQL চলে না, আর প্রজেক্টের কোনো "static export" ও নেই।

**সঠিক ও স্থায়ী সমাধান:** Cloudflare Workers + **Containers**। `npx wrangler deploy` আপনার repository-র `Dockerfile` থেকে PHP 8.4 + Apache image বানায়, সেটি Cloudflare-এর registry-তে push করে, এবং `worker/src/index.js` → Durable Object → container হয়ে সব request Laravel-এ পৌঁছায়। Application code, design, UI, route, API, admin flow — সব অপরিবর্তিত থাকে।

```
Browser → https://<worker>.<subdomain>.workers.dev (বা custom domain)
        → Cloudflare Worker (worker/src/index.js)
        → Durable Object "MexaContainer"
        → Container: Apache + PHP 8.4, DocumentRoot=/var/www/html/public
        → Laravel 12 (Blade, routes/web.php, /api/*, /admin)
        → Remote MySQL/MariaDB  +  (optional) R2 bucket for media
```

## ২. নতুন যোগ হওয়া/পরিবর্তিত ফাইল

| ফাইল | কাজ |
|---|---|
| `wrangler.jsonc` | Cloudflare-এর একমাত্র source of truth। Worker entry, container image, Durable Object, `exports`, non-secret `vars`, observability, এবং non-production build-এর জন্য `previews` block। |
| `Dockerfile` | PHP 8.4 + Apache image: `pdo_mysql`, `gd`, `zip`, `opcache`, `exif`, `pcntl`, `bcmath`; `composer install --no-dev`; DocumentRoot `public/`; port 8080। |
| `docker/apache-vhost.conf` | vhost (port 8080, `public/`, dotfile deny, 250 MB request limit)। |
| `docker/php.ini` | 512 MB memory, 200 MB upload, OPcache (timestamp check বন্ধ)। |
| `docker/entrypoint.sh` | প্রতিবার container start-এ: env → `.env`, writable dirs, `migrate --force`, `config:cache`/`view:cache`, তারপর Apache। |
| `docker/storage-init.sh` | R2 bucket থাকলে `storage/app/public/media`-কে R2-তে FUSE-mount করে — upload করা media container restart-এ হারায় না। |
| `worker/src/index.js` | Worker + `MexaContainer` Durable Object: `durable_object` scheduling policy, image/instance/env, readiness wait, inactivity timeout, request proxy। |
| `package.json` | `wrangler` dev dependency ও `deploy`/`dev`/`tail` script। |
| `.env.cloudflare.example` | শুধু secret-এর template (`wrangler secret bulk` দিয়ে আপলোড)। |
| `.dockerignore` | `vendor/`, `node_modules/`, `.dev.vars` ইত্যাদি image build context থেকে বাদ। |
| `database/migrations/2026_11_09_000001_create_sessions_table.php` | `SESSION_DRIVER=database`-এর জন্য `sessions` table (container disk ephemeral বলে দরকার)। |
| `.gitignore` | `.dev.vars`, `.wrangler/`, আর `.env.cloudflare.example`-কে track করার exception। |

`public/index.php`, `routes/web.php`, `bootstrap/app.php`, Blade files, `config/*`, `public/css/*`, `public/js/*` — **কিছুই বদলানো হয়নি**।

## ৩. Build output কোথায় তৈরি হয়

| ধাপ | Output |
|---|---|
| PHP dependency | image build-এর সময় `vendor/` (repo-তে commit হয় না, `.gitignore`-এ আছে) |
| Worker bundle | Wrangler নিজেই বানায় — এই repo-তে আলাদা build step নেই, `wrangler.jsonc`-এর `main` সরাসরি `worker/src/index.js` |
| Container image | `Dockerfile` → Cloudflare registry (`registry.cloudflare.com/<account>/…`) |
| Public asset | `public/css`, `public/js` সরাসরি container-এর Apache থেকে serve হয় (আগের মতোই) |

অর্থাৎ কনফিগার করার মতো কোনো "Build output directory" নেই — Cloudflare dashboard-এ Static Assets-এর output directory চাওয়াই এখানে প্রযোজ্য নয়; Deploy command শুধু `npx wrangler deploy`।

## ৪. একবারের Cloudflare setup (dashboard)

1. **Workers Paid plan** চালু করুন — Containers এই plan-এ available ($5/month base; memory/CPU/disk usage-based)।
2. **Durable Objects / Containers** আলাদা করে create করার দরকার নেই; `wrangler deploy` নিজেই তৈরি করে।
3. **MySQL/MariaDB** ঠিক করুন যেটি Cloudflare থেকে reachable (PlanetScale, Aiven, DigitalOcean Managed MySQL, আপনার cPanel-এর remote MySQL ইত্যাদি)। Database + user আগে তৈরি করে রাখুন; table `entrypoint.sh` নিজেই `migrate --force` দিয়ে বানাবে (শুধু নেই এমন migration apply হয়, কোনো data মুছে যায় না)।
4. **R2 bucket (recommended)** — `media` bucket বানিয়ে Object Read & Write token নিন, যাতে admin upload করা image/video container restart-এ টিকে থাকে।
5. Cloudflare dashboard-এ পুরোনো ভুল **Pages** প্রজেক্টটি থাকলে সেটি delete/ignore করুন; deploy হবে Worker-এ (`Worker name` = `mexa-motion`, চাইলে বদলানো যাবে)।

## ৫. Deploy করার ধাপ

### ৫.১ CLI থেকে (প্রথমবার)

```bash
cd /path/to/mexa

# 1) Tooling
npm install

# 2) Secrets: template কপি করে মান বসান (এই ফাইল commit হবে না)
cp .env.cloudflare.example .dev.vars
#    APP_KEY: লোকাল PHP থাকলে  ->  php artisan key:generate --show
#             না থাকলে base64 এনকোড করা ৩২ random byte, যেমন:
#             printf 'base64:%s' "$(head -c 32 /dev/urandom | base64)" | tr -d '\n'

# 3) Secrets আপলোড (APP_KEY + DB_* + চাইলে R2_*)
npx wrangler secret bulk .dev.vars
npx wrangler secret list          # শুধু নাম দেখাবে, মান নয়

# 4) Deploy (Docker চালু থাকতে হবে)
npx wrangler deploy
```

প্রথম deploy ৫–১৫ মিনিট লাগতে পারে (image build + push + container provisioning)। শেষে `https://mexa-motion.<your-subdomain>.workers.dev` পাওয়া যাবে।

### ৫.২ Cloudflare dashboard (Git connect) দিয়ে

`Workers & Pages → Create → Import a repository` → এই repo বেছে নিন:

| Setting | মান |
|---|---|
| Build command | *(ফাঁকা রাখুন — কোনো frontend build নেই)* |
| Deploy command | `npx wrangler deploy` |
| Root directory | `/` |
| Non-production deploy command | `npx wrangler preview` (Cloudflare-এর নতুন default) |

এরপর dashboard-এর **Settings → Variables and Secrets** থেকে `APP_KEY`, `DB_*`, `R2_*` secret হিসেবে দিন (`wrangler.jsonc`-এর non-secret vars এমনিতেই apply হবে)।

> **Docker requirement:** `wrangler.jsonc`-এ image `Dockerfile` path হিসেবে দেওয়া, তাই `npx wrangler deploy` চালানোর মেশিনে (বা Workers Builds environment-এ) Docker-কম্প্যাটিবল engine থাকতে হবে। Docker ছাড়া deploy করতে চাইলে image আগে বানিয়ে Cloudflare registry-তে push করুন, তারপর `wrangler.jsonc`-এ `images.app.dockerfile`-এর বদলে digest-pinned reference দিন:
>
> ```jsonc
> "images": {
>   "app": { "image": "registry.cloudflare.com/<ACCOUNT_ID>/mexa-motion@sha256:<DIGEST>" }
> }
> ```
>
> `scheduling_policy: durable_object`-এ প্রতিটি image entry-তে `dockerfile` অথবা digest-pinned `image` — দুটোর ঠিক একটি দিতে হয় (`dockerfile` দিলে Wrangler নিজেই image build/push করে)।

### ৫.৩ Worker Previews (non-production branch / pull request)

Cloudflare এখন Worker-এর non-production branch-এর জন্য **`npx wrangler preview`** চালায় (আগের `wrangler versions upload`-এর জায়গায়)। Previews **কোনো top-level সেটিং inherit করে না** — `vars`, container app আর Durable Object binding আলাদাভাবে `previews` block-এ দিতে হয়। এটা করা না থাকলে build এই error-এ থামে:

```
✘ Your Wrangler configuration needs a `previews` block to run this command.
```

তাই `wrangler.jsonc`-এ একটি `previews` block যোগ করা আছে:

| `previews`-এ যা আছে | কেন |
|---|---|
| `containers` → `image: "./Dockerfile"`, `instance_type`, `max_instances` | প্রতিটি Preview-র জন্য Cloudflare আলাদা container app বানায়। Preview-এ `scheduling_policy: durable_object` **সাপোর্ট করে না** (ওটা শুধু top-level `containers`-এ), তাই Preview classic image/instance policy ব্যবহার করে। |
| `durable_objects.bindings` → `MEXA_APP` | Worker কোড `env.MEXA_APP` পড়ে; binding না থাকলে Preview-এ **1101 error** হয়। |
| `vars` | Preview-safe মান (যেমন `APP_NAME`-এ "(Preview)", `LOG_LEVEL=debug`, inactivity 60s)। |

`MEXA_INACTIVITY_TIMEOUT_MS` কম রাখা হয়েছে যাতে Preview container দ্রুত sleep করে (খরচ কম)। Durable Object namespace আর container app প্রতিটি Preview-এর জন্য আলাদা provision হয়, তাই **Preview কখনো production container/data স্পর্শ করে না**।

`worker/src/index.js` দুটো policy-তেই চলে: `ctx.container.images.app` থাকলে (production, `durable_object`) image/instance/env সহ `start()`, না থাকলে (Preview, classic) plain `start()` — image সেক্ষেত্রে `previews.containers` থেকে আসে।

Preview secrets আলাদা করে দিতে হয় (production secret inherit হয় না):

```bash
npx wrangler preview secret put APP_KEY   --name <branch-name>
npx wrangler preview base-config secret put APP_KEY   # সব নতুন Preview-এ একবারে
```

> **সতর্কতা:** Preview container-ও আসল MySQL-এ `migrate --force` চালায় এবং **একই database** ব্যবহার করে (যদি `DB_*` secret একই থাকে)। নিরাপদ থাকতে চাইলে Preview-এ আলাদা database/ইউজার দিন, অথবা CI-তে শুধু production branch-এ `npx wrangler deploy` চালান।

## ৬. প্রথম deploy-এর পর

1. `https://<worker-url>/up` → Laravel health check (200)।
2. `https://<worker-url>/` → honeypage।
3. `https://<worker-url>/admin/setup` → প্রথম Owner account তৈরি করুন (একবারই কাজ করে)।
4. `/admin`-এ login করে content, media, videos, reviews, team, bookings আগের মতোই ব্যবহার করুন।
5. `/admin` থেকে একটি image upload করে container restart-এর পর সেটি এখনো দেখা যায় কি না যাচাই করুন (R2 configured হলে দেখা যাবে)।

## ৭. Environment variables

**Non-secret** (`wrangler.jsonc` → `vars`): `APP_ENV`, `APP_DEBUG`, `APP_TIMEZONE`, `LOG_CHANNEL=stderr`, `DB_CONNECTION=mysql`, `DB_PORT`, `SESSION_DRIVER=database`, `SESSION_ENCRYPT`, `SESSION_SECURE_COOKIE`, `TRUSTED_PROXIES=*`, `MEXA_*` (container tuning) ইত্যাদি।

**Secret** (`wrangler secret put` / `secret bulk`): `APP_KEY` (আবশ্যক), `APP_URL` (ঐচ্ছিক), `DB_HOST`, `DB_DATABASE`, `DB_USERNAME`, `DB_PASSWORD`, `MYSQL_ATTR_SSL_CA` (ঐচ্ছিক), `R2_*` (ঐচ্ছিক), `IMGBB_API_KEY` (legacy, ঐচ্ছিক)।

- `APP_URL` ফাঁকা রাখলে Laravel request থেকেই host/scheme নেয় (Worker `X-Forwarded-Host/Proto` পাঠায়, `TRUSTED_PROXIES=*`) — তাই `workers.dev` URL আর custom domain দুটোই কাজ করে।
- Cookie গুলো `Secure; HttpOnly; SameSite=Lax` থাকে, কারণ `SESSION_SECURE_COOKIE=true`।
- Custom domain যোগ করলে `Workers & Pages → mexa-motion → Settings → Domains & Routes → Add custom domain`।

## ৮. সমস্যা ও সমাধান

| Error / লক্ষণ | কারণ | সমাধান |
|---|---|---|
| `Could not detect a directory containing static files…` | Pages/Static Assets খোঁজা হচ্ছিল, প্রজেক্ট PHP | এই setup অনুসরণ করুন: `wrangler.jsonc` + `Dockerfile` + `npx wrangler deploy` (Pages নয়) |
| `The Docker CLI is needed to build the configured image…` | Docker engine চলছে না | Docker Desktop/Colima চালু করুন, অথবা `WRANGLER_DOCKER_BIN`/`DOCKER_HOST` সেট করুন; অথবা আগেই বানানো registry image ব্যবহার করুন |
| `APP_KEY is not set` (container log) | secret আপলোড হয়নি | `npx wrangler secret put APP_KEY` |
| `migrations failed` | DB unreachable/wrong credential | `DB_*` secret, remote access, firewall/IP allowlist যাচাই করুন |
| 503 + "MEXA MOTION is starting…" | container cold start (প্রথম request) | কয়েক সেকেন্ড পরে reload; `wrangler tail` বা dashboard logs দেখুন |
| Login-এর পরেই আবার login চাইছে (419) | session DB-তে যাচ্ছে না | `SESSION_DRIVER=database`, `sessions` table আছে কি না দেখুন (`migrate --force` container start-এ চলে) |
| Redirect/https:// ভুল host-এ যাচ্ছে | forwarded header/proxy trust | `TRUSTED_PROXIES=*` রাখুন (Worker/Durable Object-ই একমাত্র path) |
| Admin upload করা media restart-এর পর নেই | container disk ephemeral | R2 secrets দিন (bucket + token), তারপর redeploy |
| upload 100 MB-তে আটকে যাচ্ছে | Cloudflare request body limit (Free/Pro 100 MB, Business 200 MB) | বড় video-র জন্য Business plan বা ছোট ফাইল; app-এর নিজের limit 200 MB |
| `Your Wrangler configuration needs a 'previews' block` | non-production branch-এ `npx wrangler preview` চলছে, কিন্তু `previews` block নেই | `wrangler.jsonc`-এর `previews` block রাখুন (§৫.৩); Preview-এ `vars`/container binding inherit হয় না |
| Preview-এ `1101` error | `env.MEXA_APP` binding `previews`-এ নেই | `previews.durable_objects.bindings` + `previews.containers` দুটোই দিন |
| `Worker exceeded CPU time limit` | proxy code-এ বেশি CPU | `limits.cpu_ms` (এখন 60s) যথেষ্ট; সাধারণত হয় না |

## ৯. যা এখনো মেনে চলা জরুরি

- `migrate:fresh`, `truncate`, reseed বা populated DB-তে `migrate --seed` — কখনো নয়। `entrypoint.sh` শুধু `migrate --force` চালায়।
- `.env`, `.dev.vars`, `APP_KEY`, DB credential, uploaded media, `database/database.sqlite` — Git-এ নয় (`\.gitignore` আগেই block করে, `.dev.vars`/`.wrangler/` নতুন করে যোগ হয়েছে)।
- cPanel/XAMPP setup আগের মতোই [`CPANEL_DEPLOYMENT.md`](CPANEL_DEPLOYMENT.md)-এ আছে; এই directory-র `Dockerfile`, `docker/`, `worker/`, `wrangler.jsonc` সেখানে ব্যবহৃত হয় না।
- Reverse-proxy preview মডেল (PHP server + Tunnel/CDN) আগের মতোই [`CLOUDFLARE_PREVIEW.md`](CLOUDFLARE_PREVIEW.md)-এ আছে।

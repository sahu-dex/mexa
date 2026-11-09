# MEXA MOTION — Cloudflare deployment guide

> এই ডকুমেন্ট শুধু configuration ও deploy নির্দেশনা। এখানে কোনো secret, database credential বা live deployment নেই। `.env`-এর মান কখনো Git/log/chat-এ দেবেন না।

## ১. আর্কিটেকচার ও কীভাবে এটি ১০০% কাজ করে (Workers Free ও Paid উভয় প্ল্যানেই)

আগে Cloudflare Containers (`containers` / `/containers/me`) ব্যবহারের কারণে **Workers Free** প্ল্যানে বা Containers scope ছাড়া CI build বারবার ব্যর্থ হচ্ছিল:

```
✘ A request to the Cloudflare API (/accounts/.../containers/me) failed.
```

এখন প্রজেক্টটি **১০০% নেটিভ Cloudflare Workers + SQLite Durable Object (`MexaContainer`)** হিসেবে চলে — কোনো **Workers Paid plan**, **Docker build**, বা বাইরের **MySQL** ছাড়াই সরাসরি Cloudflare-এ deploy ও run হয়:

```
Browser → https://mexa.<subdomain>.workers.dev (বা custom domain)
        → Cloudflare Worker (worker/src/index.js)
            ├─ /css/* ও /js/* → সরাসরি Worker edge থেকে serve (public/css/*, public/js/*)
            ├─ /up            → 200 OK health check
            └─ সব dynamic route (/, /service, /work, /reviews, /team, /book, /admin, /api/*, /storage/media/*)
                 → SQLite Durable Object "MexaContainer" (worker/src/app.js + worker/src/views.js)
                 → অপরিবর্তিত Blade templates (resources/views/**/*.blade.php)
                 → স্থায়ী SQLite storage (ctx.storage.sql: users, site_data, media_assets, video_library, sessions, approvals)
```

একই সাথে Laravel/PHP ফাইলগুলো (`app/`, `routes/web.php`, `resources/views/`, `public/`, `Dockerfile`) **সম্পূর্ণ অপরিবর্তিত** রাখা হয়েছে, যাতে cPanel, XAMPP, Docker ও Railway আগের মতোই কাজ করে। আর ভবিষ্যতে কখনো বাইরের PHP সার্ভারের সামনে প্রক্সি করতে চাইলে শুধু `ORIGIN_URL` ভ্যারিয়েবল/সিক্রেট সেট করলেই Worker স্বয়ংক্রিয়ভাবে সেই সার্ভারের সামনে প্রক্সি হিসেবে কাজ করবে।

## ২. মূল ফাইলসমূহ

| ফাইল | কাজ |
|---|---|
| `wrangler.jsonc` | Cloudflare-এর একমাত্র source of truth (`"name": "mexa"`, `"preview_urls": true`, `rules`, SQLite Durable Object `MexaContainer`, `MEXA_APP`, এবং `previews` block — কোনো Paid-only `containers` বা `limits` নেই)। |
| `worker/src/index.js` | Worker entrypoint ও `MexaContainer` Durable Object wrapper (edge asset, `/up`, native SQLite app, এবং ঐচ্ছিক `ORIGIN_URL` / container fallback)। |
| `worker/src/app.js` | পূর্ণাঙ্গ অ্যাপ্লিকেশন ও অ্যাডমিন ব্যাকএন্ড: সব পাবলিক ও অ্যাডমিন রুট, session/CSRF/rate-limit, media upload ও `Range` streaming, video library, team profile link, review ও booking API। |
| `worker/src/views.js` | `resources/views/**/*.blade.php` টেমপ্লেটগুলো সরাসরি রেন্ডার করার ইঞ্জিন। |
| `worker/src/support.js` | `SiteData` (default snapshot `database/seeders/data/site-snapshot.json`), `VideoEmbed`, `MediaFiles`, layout/bridge script এবং পাসওয়ার্ড হ্যাশিং। |
| `worker/src/assets.js` | `public/css/*.css` ও `public/js/*.js` ফাইলগুলো ETag ও cache header সহ সরাসরি edge থেকে serve করে। |
| `Dockerfile` ও `docker/*` | Docker / Railway / কন্টেইনার হোস্টিংয়ের জন্য অপরিবর্তিত PHP 8.4 + Apache ইমেজ। |

## ৩. Cloudflare Dashboard (Git connect / Workers Builds) সেটআপ

`Workers & Pages → mexa → Settings → Build`:

| Setting | মান |
|---|---|
| Worker name | `mexa` (`wrangler.jsonc`-এর `"name"` এর সাথে হুবহু মিলানো আছে) |
| Build command | *(ফাঁকা রাখুন)* |
| Deploy command (Production branch) | `npx wrangler deploy` |
| Non-production branch deploy command | `npx wrangler preview` *(অথবা `npx wrangler versions upload`)* |
| Root directory | `/` |

কোনো আলাদা database বা secret না দিলেও সাইট সাথে সাথে চালু হয়ে যাবে (ডিফল্ট কনটেন্ট ও ডাটা SQLite Durable Object-এ স্বয়ংক্রিয়ভাবে সিড হয়)।

## ৪. লোকাল ও CLI কমান্ড

```bash
# ডিপেন্ডেন্সি ইনস্টল
npm ci

# লোকাল Cloudflare Worker রানটাইমে চালানো
npx wrangler dev

# বান্ডেল ও কনফিগারেশন যাচাই (কোনো Docker লাগে না)
npx wrangler deploy --dry-run

# সরাসরি Cloudflare-এ প্রোডাকশন ডিপ্লয়
npx wrangler deploy
```

## ৫. প্রথমবার ডিপ্লয় হওয়ার পর

1. `https://mexa.<your-subdomain>.workers.dev/up` → `OK` (200)।
2. `https://mexa.<your-subdomain>.workers.dev/` → সম্পূর্ণ হোমপেজ ও সব পাবলিক পেজ (`/service`, `/work`, `/reviews`, `/team`, `/book`)।
3. `https://mexa.<your-subdomain>.workers.dev/admin/setup` → প্রথমবার Owner অ্যাডমিন অ্যাকাউন্ট তৈরি করুন।
4. `/admin`-এ লগইন করে কনটেন্ট, সার্ভিস, প্রাইসিং, মিডিয়া আপলোড, ভিডিও লাইব্রেরি, টিম মেম্বার, রিভিউ অ্যাপ্রুভাল এবং বুকিং পরিচালনা করুন — সব ডাটা Cloudflare-এর SQLite Durable Object-এ স্থায়ীভাবে সংরক্ষিত থাকবে।

## ৬. ঐচ্ছিক সেটিংস

- **`ORIGIN_URL` (ঐচ্ছিক):** আপনি যদি কখনো cPanel/Railway/VPS-এ চলা আলাদা PHP সার্ভারকে ব্যাকএন্ড হিসেবে ব্যবহার করতে চান, তবে `Workers & Pages → mexa → Settings → Variables and Secrets`-এ `ORIGIN_URL` (যেমন `https://origin.example.com`) যোগ করলেই Worker সব রিকোয়েস্ট সেখানে ফরোয়ার্ড করবে। ফাঁকা রাখলে Worker নিজেই সম্পূর্ণ অ্যাপ্লিকেশন চালাবে।
- **Custom Domain:** `Workers & Pages → mexa → Settings → Domains & Routes → Add → Custom domain`।

## ৭. সাধারণ সমস্যার সমাধান

| লক্ষণ / বার্তা | কারণ ও সমাধান |
|---|---|
| পুরোনো বিল্ডে `/accounts/.../containers/me` বা `code: 100328` এসেছিল | আগের কনফিগারেশনে Paid-only `containers` ব্যবহৃত হচ্ছিল। বর্তমান `wrangler.jsonc` থেকে সেটি সরিয়ে নেটিভ SQLite Durable Object ব্যবহার করা হয়েছে, তাই Free ও Paid উভয় প্ল্যানেই বিল্ড সফল হয়। |
| পুরোনো বিল্ডে `The current version of your Worker does not have Preview URLs enabled` | `wrangler.jsonc`-এ `"preview_urls": true` যোগ করা হয়েছে। মেইন ব্রাঞ্চে একবার `npx wrangler deploy` চললেই প্রিভিউ ইউআরএল সক্রিয় থাকে। |
| Non-production PR বিল্ডে `100406` (unprovisioned export) দেখালে | প্রথমবার `main` ব্রাঞ্চে একবার `npx wrangler deploy` চালান (অথবা PR মার্জ করুন) যাতে `MexaContainer` Durable Object ক্লাসটি প্রোভিশন হয়ে যায়, অথবা Non-production কমান্ড হিসেবে `npx wrangler preview` ব্যবহার করুন। |

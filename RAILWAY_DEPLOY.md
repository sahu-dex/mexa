# Railway Deploy Guide — Mexa Motion

> Screenshot-e `Service temporarily unavailable` ashar karon: **Database env vars set kora nei**. Nicher step follow korle preview thik hoye jabe.

## 1) Keno error hocche?
`config/db.php` e `DB_NAME / DB_USER` na pele production-e `500 Service temporarily unavailable` return kore. Railway-te MySQL alada service — apnake hoy **MySQL plugin add** korte hobe, noyto **Variables e DB credentials** dite hobe.

---

## 2) Fix — 2 min e (Recommended: Railway MySQL plugin)

### Step A — Add MySQL service
1. Railway Dashboard → apnar project khulun (mexa-production)
2. **+ New → Database → Add MySQL** (or `MySQL` plugin)
3. MySQL service create hole Railway auto 5 ta variable inject kore:
   - `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD`
   - Kokhono `DATABASE_URL` / `MYSQL_URL` o inject kore (private network).

> **Ei repo-r notun `config/db.php` already `MYSQLHOST/MYSQLDATABASE/MYSQLUSER/MYSQLPASSWORD` ebong `DATABASE_URL` support kore.** So plugin add korlei DB connect hoye jabe — alada kore `DB_HOST` set na korleo cholbe.

### Step B — Variables link korun (jodi auto na hoy)
MySQL plugin er `Variables` tab theke `Reference` check korun. Jodi `mexa` service-e MySQL vars na ase:
- Railway → `mexa` service → **Variables** → **+ New Variable → Add Reference**
- `MYSQLHOST`, `MYSQLPORT`, `MYSQLDATABASE`, `MYSQLUSER`, `MYSQLPASSWORD` sob gulo MySQL service theke reference korun.

**Alternative manual (jodi external MySQL use koren):**
Railway → `mexa` service → **Variables** → add korun:
```
DB_HOST=your-mysql-host
DB_PORT=3306
DB_NAME=your_db_name
DB_USER=your_db_user
DB_PASS=your_db_password
DB_CHARSET=utf8mb4
APP_ENV=production
APP_URL=https://mexa-production.up.railway.app
```

### Step C — Redeploy
Variables save korle Railway auto redeploy kore. Na korle **Deployments → Redeploy** din.

Verify:
- `https://mexa-production.up.railway.app/api/health.php` → `{"ok":true,"db":"connected"}` ashle DB thik ache.
- Homepage → ar `Service temporarily unavailable` asbe na.

---

## 3) Database tables + seed data (first time only)

DB empty thakle tables auto create hoy na. 2 vabe korte paren:

### Option 1 — One-time env flag (easy)
Railway → `mexa` service → Variables:
```
RUN_MIGRATIONS=1
```
Redeploy din — `docker-entrypoint.sh` auto `php database/seed.php` run korbe. Success hole abar `RUN_MIGRATIONS=0` kore din (jate protibar seed na hoy).

### Option 2 — Railway MySQL shell
Railway → MySQL service → **Data** tab → **Query** e giye:
- `database/schema.sql` er content copy-paste + Run
- `database/seed.sql` er content copy-paste + Run

### Option 3 — Local phpMyAdmin / mysql CLI
```bash
mysql -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE < database/schema.sql
mysql -h $MYSQLHOST -P $MYSQLPORT -u $MYSQLUSER -p$MYSQLPASSWORD $MYSQLDATABASE < database/seed.sql
```

---

## 4) First Admin account
Deploy success er por:
```
https://mexa-production.up.railway.app/admin/setup.php
```
Ekhane username / email / password (min 10 chars) diye owner admin banan. Page ta auto lock hoye jabe.

---

## 5) Common pitfalls (Railway preview dekhte na parle)

| Symptom | Karone | Fix |
|---|---|---|
| `Service temporarily unavailable` plain text | DB vars missing | Step 2 follow, `api/health.php` check |
| `Database connection failed` | MySQL service down / wrong host | Railway → MySQL → Metrics check, Variables host thik korun. Private network hole `mysql.railway.internal` use korben |
| Healthcheck fails / deploy stuck | Dockerfile PORT mismatch | Ei repo-r `Dockerfile` + `docker-entrypoint.sh` already `$PORT` handle kore — Railway → Settings → Healthcheck Path = `/api/health.php` set korun |
| Images/videos upload fails | Writable dir missing | Dockerfile already `chmod 755 storage/uploads` kore — redeploy din |
| `APP_URL` wrong | env not set | Railway Variables e `APP_URL=https://mexa-production.up.railway.app` set korun |
| Branch `arena/...` te push korsi but preview purono | Railway main branch track kore | GitHub → Railway → Settings → **Source Branch** check. Jodi `main` hoy, tahole fix `main` e merge/push korte hobe |

---

## 6) Dockerfile ki kore?
- Base `php:8.2-apache` + `pdo_mysql, gd, mbstring, fileinfo`
- `mod_rewrite` + `mod_headers` enable (`.htaccess` er jonno)
- `$PORT` env support (Railway dynamic port)
- `storage/logs`, `storage/ratelimits`, `uploads/*` writable
- Healthcheck: `GET /api/health.php` (DB charao 200 dey, tai Railway deploy pass kore)

File gulo:
- `Dockerfile`, `docker-entrypoint.sh`, `railway.json`, `railway.toml`, `nixpacks.toml`, `.dockerignore`

---

## 7) Rollback / Logs
Railway → `mexa` service → **Deployments → View Logs** e `[Mexa Motion DB]` search korle exact DB error dekhte paben.

Production-e `APP_ENV=development` dile detailed error browser e dekhabe — debug sesh hole `production` e ferot anben.

---

## Quick TL;DR (Bangla)
1. Railway project e **MySQL Add** korun
2. MySQL vars `mexa` service e reference korun (auto na hole)
3. Redeploy → `api/health.php` e `db: connected` check
4. `RUN_MIGRATIONS=1` diye ekbar seed korun → `admin/setup.php` e admin banan — done!

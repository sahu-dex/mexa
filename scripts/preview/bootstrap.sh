#!/usr/bin/env bash
# One-shot bootstrap for the PHP-WASM sandbox preview of this Laravel app.
# See README.md in this folder for details and prerequisites.
set -euo pipefail

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO="$(cd "$HERE/../.." && pwd)"

cd "$HERE"

# --- 1. npm deps (php-wasm runtime) -----------------------------------------
if [ ! -d node_modules ]; then
  echo "==> Installing npm dependencies (php-wasm)..."
  npm install --no-audit --no-fund
fi

# --- 2. vendor/ from GitHub dists (composer/packagist unavailable) ----------
if [ ! -f "$REPO/vendor/autoload.php" ]; then
  echo "==> Assembling vendor/ from composer.lock via GitHub zipballs..."
  # 74 API calls exceed the unauthenticated 60/hour limit — use gh's token when present.
  if [ -z "${GH_TOKEN:-}" ] && command -v gh >/dev/null 2>&1; then
    export GH_TOKEN="$(gh auth token)"
  fi
  python3 install-vendor.py
fi
echo "==> (Re)generating autoloader..."
python3 regen-autoload.py

# --- 3. .env (preview template) ---------------------------------------------
if [ ! -f "$REPO/.env" ]; then
  echo "==> Creating .env from the preview template..."
  cp "$REPO/docs/cloudflare-preview.env.example" "$REPO/.env"
  KEY="base64:$(head -c 32 /dev/urandom | base64 | tr -d '\n')"
  set_env() { sed -i.bak "s|^$1=.*|$1=$2|" "$REPO/.env" && rm -f "$REPO/.env.bak"; }
  set_env APP_KEY "$KEY"
  # flock(LOCK_SH) fails inside php-wasm, so Laravel's file session reads come
  # back empty — database sessions work around it (table created below).
  set_env SESSION_DRIVER database
  set_env SESSION_ENCRYPT false
fi

# --- 4. database --------------------------------------------------------------
touch "$REPO/database/database.sqlite"
if [ ! -f "$REPO/database/database.sqlite" ] || [ "$(wc -c < "$REPO/database/database.sqlite")" -eq 0 ] \
   || ! python3 -c "
import sqlite3, sys
conn = sqlite3.connect('$REPO/database/database.sqlite')
ok = conn.execute(\"SELECT count(*) FROM sqlite_master WHERE type='table' AND name='users'\").fetchone()[0] > 0
conn.close()
sys.exit(0 if ok else 1)"; then
  echo "==> Running migrations..."
  node run-artisan.cjs migrate '{"--force":true,"--no-ansi":true}'
fi

echo "==> Ensuring sessions table exists (preview-only; production uses file sessions)..."
python3 - "$REPO/database/database.sqlite" <<'PY'
import sqlite3, sys
conn = sqlite3.connect(sys.argv[1])
conn.execute('''CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    user_id INTEGER,
    ip_address VARCHAR(45),
    user_agent TEXT,
    payload TEXT NOT NULL,
    last_activity INTEGER NOT NULL)''')
conn.execute('CREATE INDEX IF NOT EXISTS sessions_last_activity_index ON sessions (last_activity)')
conn.commit()
conn.close()
PY

mkdir -p "$REPO/storage/framework/cache/data" "$REPO/storage/framework/sessions" \
         "$REPO/storage/framework/views" "$REPO/storage/logs" \
         "$REPO/storage/app/public/media" "$REPO/bootstrap/cache"

# --- 5. serve -----------------------------------------------------------------
echo "==> Starting preview server on 0.0.0.0:${PORT:-8000} ..."
exec env PORT="${PORT:-8000}" node server.cjs

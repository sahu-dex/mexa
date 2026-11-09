#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOST="${HOST:-0.0.0.0}"
PORT="${PORT:-8000}"

if [[ ! -f "$ROOT/vendor/autoload.php" ]]; then
    echo "Missing vendor/autoload.php. Run: composer install --no-dev --optimize-autoloader" >&2
    exit 1
fi

if [[ ! -f "$ROOT/.env" ]]; then
    echo "Missing .env. Copy docs/cloudflare-preview.env.example to .env, then set APP_URL and APP_KEY." >&2
    exit 1
fi

if [[ ! -f "$ROOT/public/index.php" ]]; then
    echo "Missing public/index.php. Check the repository checkout." >&2
    exit 1
fi

if command -v php >/dev/null 2>&1; then
    PHP_BIN="php"
    PHP_ENV=()
elif [[ -n "${PHP_WASM_CLI:-}" && -x "$PHP_WASM_CLI" ]]; then
    PHP_BIN="$PHP_WASM_CLI"
    PHP_ENV=("PHP=${PHP_VERSION:-8.3}")
elif [[ -x "$ROOT/node_modules/.bin/php-wasm-cli" ]]; then
    PHP_BIN="$ROOT/node_modules/.bin/php-wasm-cli"
    PHP_ENV=("PHP=${PHP_VERSION:-8.3}")
elif command -v php-wasm-cli >/dev/null 2>&1; then
    PHP_BIN="$(command -v php-wasm-cli)"
    PHP_ENV=("PHP=${PHP_VERSION:-8.3}")
else
    echo "No PHP runtime found. Install PHP 8.2+ or set PHP_WASM_CLI to php-wasm-cli." >&2
    exit 1
fi

echo "MEXA MOTION preview listening on ${HOST}:${PORT}. Use the HTTPS preview host, not localhost."

exec env "${PHP_ENV[@]}" "$PHP_BIN" \
    -d memory_limit=512M \
    -d upload_max_filesize=200M \
    -d post_max_size=220M \
    -d max_execution_time=300 \
    -S "${HOST}:${PORT}" \
    -t "$ROOT/public" \
    "$ROOT/scripts/preview-router.php"

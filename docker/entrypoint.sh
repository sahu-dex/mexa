#!/bin/sh
# MEXA MOTION container entrypoint.
#
# The container disk is ephemeral, so every start:
#   1. writes a Laravel .env from the environment (Worker vars + secrets),
#   2. creates the writable storage directories,
#   3. applies pending migrations to the remote MySQL database,
#   4. warms the Laravel caches,
#   5. hands over to Apache (public/ document root, port 8080).
#
# Secrets are never stored in the image or the repository; they arrive as
# environment variables from `wrangler secret put` (see .env.cloudflare.example).

set -eu

APP_ROOT="${APP_ROOT:-/var/www/html}"
cd "$APP_ROOT"

log() {
    printf '[mexa-container] %s\n' "$*" >&2
}

# --- 1. .env ----------------------------------------------------------------
if [ -f .env ]; then
    # The repository .env (if someone mounted one) must never win over secrets.
    mv -f .env .env.disabled
    log "renamed existing .env to .env.disabled"
fi

if [ -z "${APP_KEY:-}" ]; then
    log "FATAL: APP_KEY is not set. Run: npx wrangler secret put APP_KEY"
    exit 1
fi

umask 027
{
    printf 'APP_NAME=%s\n' "${APP_NAME:-Mexa Motion}"
    printf 'APP_ENV=%s\n' "${APP_ENV:-production}"
    printf 'APP_KEY=%s\n' "$APP_KEY"
    printf 'APP_DEBUG=%s\n' "${APP_DEBUG:-false}"
    printf 'APP_TIMEZONE=%s\n' "${APP_TIMEZONE:-Asia/Dhaka}"
    printf 'APP_LOCALE=%s\n' "${APP_LOCALE:-en}"
    printf 'APP_FALLBACK_LOCALE=%s\n' "${APP_FALLBACK_LOCALE:-en}"
    # APP_URL is optional: when it is empty Laravel derives URLs from the
    # request (X-Forwarded-Proto/Host sent by the Worker), so custom domains
    # and workers.dev previews both work without a hardcoded hostname.
    if [ -n "${APP_URL:-}" ]; then printf 'APP_URL=%s\n' "$APP_URL"; fi

    printf 'LOG_CHANNEL=%s\n' "${LOG_CHANNEL:-stderr}"
    printf 'LOG_LEVEL=%s\n' "${LOG_LEVEL:-error}"

    printf 'DB_CONNECTION=%s\n' "${DB_CONNECTION:-mysql}"
    printf 'DB_HOST=%s\n' "${DB_HOST:-}"
    printf 'DB_PORT=%s\n' "${DB_PORT:-3306}"
    printf 'DB_DATABASE=%s\n' "${DB_DATABASE:-}"
    printf 'DB_USERNAME=%s\n' "${DB_USERNAME:-}"
    printf 'DB_PASSWORD=%s\n' "${DB_PASSWORD:-}"
    printf 'DB_CHARSET=%s\n' "${DB_CHARSET:-utf8mb4}"
    printf 'DB_COLLATION=%s\n' "${DB_COLLATION:-utf8mb4_unicode_ci}"
    if [ -n "${MYSQL_ATTR_SSL_CA:-}" ]; then printf 'MYSQL_ATTR_SSL_CA=%s\n' "$MYSQL_ATTR_SSL_CA"; fi

    if [ "${DB_CONNECTION:-mysql}" = "sqlite" ]; then
        printf 'DB_DATABASE=%s\n' "${DB_DATABASE:-$APP_ROOT/database/database.sqlite}"
    fi

    printf 'SESSION_DRIVER=%s\n' "${SESSION_DRIVER:-database}"
    printf 'SESSION_TABLE=%s\n' "${SESSION_TABLE:-sessions}"
    printf 'SESSION_LIFETIME=%s\n' "${SESSION_LIFETIME:-120}"
    printf 'SESSION_ENCRYPT=%s\n' "${SESSION_ENCRYPT:-true}"
    printf 'SESSION_SECURE_COOKIE=%s\n' "${SESSION_SECURE_COOKIE:-true}"
    printf 'SESSION_HTTP_ONLY=%s\n' "${SESSION_HTTP_ONLY:-true}"
    printf 'SESSION_SAME_SITE=%s\n' "${SESSION_SAME_SITE:-lax}"

    printf 'CACHE_STORE=%s\n' "${CACHE_STORE:-file}"
    printf 'QUEUE_CONNECTION=%s\n' "${QUEUE_CONNECTION:-sync}"
    printf 'FILESYSTEM_DISK=%s\n' "${FILESYSTEM_DISK:-local}"

    printf 'TRUSTED_PROXIES=%s\n' "${TRUSTED_PROXIES:-*}"
} > .env
chown www-data:www-data .env
chmod 640 .env

# --- 2. writable runtime directories ---------------------------------------
mkdir -p \
    bootstrap/cache \
    storage/framework/cache/data \
    storage/framework/sessions \
    storage/framework/views \
    storage/logs \
    storage/app/public/media \
    storage/app/private
rm -f bootstrap/cache/*.php
# Composer runs with --no-scripts in the image, so build Laravel's package
# manifest (config/app.php providers/aliases) once per container start.
php artisan package:discover --ansi >/dev/null 2>&1 || true
chown -R www-data:www-data storage bootstrap/cache

if [ "${DB_CONNECTION:-mysql}" = "sqlite" ]; then
    [ -f "${DB_DATABASE:-$APP_ROOT/database/database.sqlite}" ] || touch "${DB_DATABASE:-$APP_ROOT/database/database.sqlite}"
    chown www-data:www-data "${DB_DATABASE:-$APP_ROOT/database/database.sqlite}" || true
fi

# --- 3. database schema -----------------------------------------------------
# `migrate --force` only applies migrations that are not recorded yet. It never
# drops tables, truncates data or reseeds a populated database.
if [ -n "${DB_HOST:-}" ] || [ "${DB_CONNECTION:-mysql}" = "sqlite" ]; then
    attempts=0
    until php artisan migrate --force --no-interaction; do
        attempts=$((attempts + 1))
        if [ "$attempts" -ge 3 ]; then
            log "FATAL: migrations failed. Check DB_HOST/DB_DATABASE/DB_USERNAME and that the database allows remote connections."
            exit 1
        fi
        log "migration attempt $attempts failed, retrying in 5s"
        sleep 5
    done
else
    log "DB_HOST is not set, skipping migrations. Set DB_* secrets before going live."
fi

# --- 4. persistent media (optional) -----------------------------------------
# Mounts the R2 bucket on storage/app/public/media when R2_* secrets exist.
if [ -x /usr/local/bin/mexa-storage-init ]; then
    /usr/local/bin/mexa-storage-init || log "media storage setup skipped"
fi

# --- 5. caches --------------------------------------------------------------
# `route:cache` is skipped on purpose: routes/web.php registers closure routes
# (for example the legacy .html redirects), which cannot be serialized.
php artisan storage:link >/dev/null 2>&1 || true
php artisan config:cache --no-interaction || log "config cache skipped"
php artisan view:cache --no-interaction || log "view cache skipped"
chown -R www-data:www-data storage bootstrap/cache

log "starting Apache on ${MEXA_CONTAINER_PORT:-8080}"

# --- 6. web server ----------------------------------------------------------
exec "$@"

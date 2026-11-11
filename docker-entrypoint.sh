#!/bin/bash
set -e

# Railway provides $PORT (e.g. 8080). Apache by default listens 80.
# We rewrite configs to listen on $PORT so healthchecks pass.

PORT_TO_USE="${PORT:-80}"
echo "[mexa] Starting on PORT=${PORT_TO_USE} APP_ENV=${APP_ENV:-production}"

# Ensure storage & uploads writable (Railway ephemeral filesystem)
mkdir -p /var/www/html/storage/logs /var/www/html/storage/ratelimits /var/www/html/uploads/images /var/www/html/uploads/videos
chown -R www-data:www-data /var/www/html/storage /var/www/html/uploads 2>/dev/null || true
chmod -R 755 /var/www/html/storage /var/www/html/uploads 2>/dev/null || true
touch /var/www/html/storage/logs/php-error.log 2>/dev/null || true
chown www-data:www-data /var/www/html/storage/logs/php-error.log 2>/dev/null || true

# If PORT is not 80, update Apache ports.conf and vhost
if [ "$PORT_TO_USE" != "80" ]; then
  echo "[mexa] Rewriting Apache to listen on ${PORT_TO_USE}..."
  sed -i "s/Listen 80/Listen ${PORT_TO_USE}/g" /etc/apache2/ports.conf || true
  sed -i "s/<VirtualHost \*:80>/<VirtualHost *:${PORT_TO_USE}>/g" /etc/apache2/sites-available/000-default.conf || true
  # Also ensure ServerName doesn't block
  if ! grep -q "ServerName" /etc/apache2/sites-available/000-default.conf; then
    echo "ServerName localhost" >> /etc/apache2/apache2.conf
  fi
fi

# Print DB env presence (without secrets) for debugging
echo "[mexa] ENV check:"
echo "  DB_HOST=${DB_HOST:-empty} MYSQLHOST=${MYSQLHOST:-empty}"
echo "  DB_NAME=${DB_NAME:-empty} MYSQLDATABASE=${MYSQLDATABASE:-empty}"
echo "  DB_USER=${DB_USER:-empty} MYSQLUSER=${MYSQLUSER:-empty}"
echo "  DB_PORT=${DB_PORT:-empty} MYSQLPORT=${MYSQLPORT:-empty}"
if [ -n "${DATABASE_URL:-}" ]; then
  echo "  DATABASE_URL is set (length ${#DATABASE_URL})"
fi
if [ -n "${MYSQL_URL:-}" ]; then
  echo "  MYSQL_URL is set"
fi

# If no DB env at all, warn but still start (health endpoint will show)
if [ -z "${DB_HOST:-}" ] && [ -z "${MYSQLHOST:-}" ] && [ -z "${DATABASE_URL:-}" ] && [ -z "${MYSQL_URL:-}" ]; then
  echo "[mexa][WARN] No DB env vars found! Set DB_HOST/DB_NAME/DB_USER/DB_PASS or attach Railway MySQL plugin."
  echo "[mexa][WARN] App will return 'Service temporarily unavailable' until DB is configured."
fi

# Optional: auto-run migrations if RUN_MIGRATIONS=1 and DB is reachable
if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  echo "[mexa] RUN_MIGRATIONS=1 — attempting php database/seed.php..."
  php /var/www/html/database/seed.php || echo "[mexa][WARN] seed.php failed (DB not ready yet?)"
fi

# Start Apache in foreground
exec apache2-foreground

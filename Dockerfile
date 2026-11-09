# MEXA MOTION — Laravel 12 / PHP 8.4 image for Cloudflare Containers.
#
# `npx wrangler deploy` builds this Dockerfile (linux/amd64), pushes it to the
# Cloudflare registry and runs it behind the Worker in worker/src/index.js.
#
# Nothing secret is baked into the image: APP_KEY, APP_URL, DB_* and R2 keys are
# injected at container start from Worker secrets (`wrangler secret put`).

# syntax=docker/dockerfile:1

FROM php:8.4-apache-bookworm

ENV APACHE_DOCUMENT_ROOT=/var/www/html/public \
    APACHE_RUN_USER=www-data \
    APACHE_RUN_GROUP=www-data \
    COMPOSER_ALLOW_SUPERUSER=1 \
    COMPOSER_NO_INTERACTION=1 \
    COMPOSER_NO_AUDIT=1

# --- PHP extensions required by composer.lock + Laravel 12 -------------------
# mbstring, ctype, curl, hash, iconv, json, openssl, session and tokenizer are
# already compiled into the official php:8.4-apache image.
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends \
        libzip-dev \
        libpng-dev \
        libjpeg62-turbo-dev \
        libfreetype6-dev; \
    docker-php-ext-configure gd --with-freetype --with-jpeg; \
    docker-php-ext-install -j"$(nproc)" \
        pdo_mysql \
        exif \
        pcntl \
        bcmath \
        gd \
        opcache \
        zip; \
    a2enmod rewrite headers expires; \
    rm -rf /var/lib/apt/lists/*

# --- FUSE client for the optional R2 media mount ----------------------------
# Only used when R2_* secrets are configured (docker/storage-init.sh).
ARG TIGRISFS_VERSION=1.2.4
RUN set -eux; \
    apt-get update; \
    apt-get install -y --no-install-recommends ca-certificates curl fuse3; \
    curl -fsSL -o /tmp/tigrisfs.tar.gz \
        "https://github.com/tigrisdata/tigrisfs/releases/download/v${TIGRISFS_VERSION}/tigrisfs_${TIGRISFS_VERSION}_linux_amd64.tar.gz"; \
    tar -xzf /tmp/tigrisfs.tar.gz -C /usr/local/bin/ tigrisfs; \
    chmod +x /usr/local/bin/tigrisfs; \
    ln -sf /usr/local/bin/tigrisfs /usr/local/bin/mount.fuse.tigrisfs; \
    rm -f /tmp/tigrisfs.tar.gz; \
    rm -rf /var/lib/apt/lists/*

# --- Apache: listen on the container port and serve public/ ------------------
COPY docker/apache-vhost.conf /etc/apache2/sites-available/000-default.conf
COPY docker/php.ini /usr/local/etc/php/conf.d/zz-mexa.ini
COPY docker/entrypoint.sh /usr/local/bin/mexa-entrypoint
COPY docker/storage-init.sh /usr/local/bin/mexa-storage-init
RUN set -eux; \
    sed -ri 's/^Listen 80$/Listen 8080/' /etc/apache2/ports.conf; \
    printf '\nServerName localhost\n' >> /etc/apache2/apache2.conf; \
    printf 'user_allow_other\n' >> /etc/fuse.conf; \
    a2dissite 000-default >/dev/null 2>&1 || true; \
    a2ensite 000-default >/dev/null; \
    chmod +x /usr/local/bin/mexa-entrypoint /usr/local/bin/mexa-storage-init

# --- Composer dependencies ---------------------------------------------------
# vendor/ is git-ignored, so it is built here. `--no-scripts` is required: at
# this point artisan is not copied yet, and Laravel's package manifest is built
# at container start (docker/entrypoint.sh).
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

WORKDIR /var/www/html

COPY composer.json composer.lock ./
RUN composer install \
        --no-dev \
        --no-interaction \
        --no-scripts \
        --prefer-dist \
        --optimize-autoloader \
        --no-progress

# --- Application source ------------------------------------------------------
COPY . .

# The entrypoint writes runtime .env / .env.disabled files; they must never be
# served or packaged with stale values.
RUN rm -f .env .env.disabled .env.local .dev.vars

# Runtime state lives on the ephemeral container disk (see docker/entrypoint.sh).
RUN set -eux; \
    mkdir -p \
        bootstrap/cache \
        storage/framework/cache/data \
        storage/framework/sessions \
        storage/framework/views \
        storage/logs \
        storage/app/public/media \
        storage/app/private; \
    rm -f bootstrap/cache/*.php; \
    chown -R www-data:www-data storage bootstrap/cache; \
    chmod -R ug+rwX storage bootstrap/cache

EXPOSE 8080

ENTRYPOINT ["/usr/local/bin/mexa-entrypoint"]
CMD ["apache2-foreground"]

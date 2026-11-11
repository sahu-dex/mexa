# Mexa Motion — PHP 8.2 + Apache for Railway
FROM php:8.2-apache

ENV DEBIAN_FRONTEND=noninteractive
ENV APACHE_DOCUMENT_ROOT=/var/www/html
ENV APP_ENV=production

# Install system deps + PHP extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    libpng-dev \
    libjpeg-dev \
    libwebp-dev \
    libfreetype6-dev \
    libonig-dev \
    libzip-dev \
    libicu-dev \
    unzip \
    curl \
    ca-certificates \
 && docker-php-ext-configure gd --with-freetype --with-jpeg --with-webp \
 && docker-php-ext-install -j$(nproc) gd pdo pdo_mysql mysqli mbstring fileinfo \
 && a2enmod rewrite headers \
 && apt-get clean && rm -rf /var/lib/apt/lists/*

# Set Apache DocumentRoot to project root (where index.php lives)
# Allow .htaccess overrides
RUN sed -ri -e 's!/var/www/html!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/sites-available/000-default.conf \
 && sed -ri -e 's!/var/www/!${APACHE_DOCUMENT_ROOT}!g' /etc/apache2/apache2.conf \
 && printf '<Directory ${APACHE_DOCUMENT_ROOT}>\n  AllowOverride All\n  Require all granted\n</Directory>\n' > /etc/apache2/conf-available/mexa.conf \
 && a2enconf mexa

# Copy app
WORKDIR /var/www/html
COPY . /var/www/html

# Create writable dirs for Railway (ephemeral FS still needs write perms)
RUN mkdir -p /var/www/html/storage/logs /var/www/html/storage/ratelimits /var/www/html/uploads/images /var/www/html/uploads/videos \
 && chown -R www-data:www-data /var/www/html/storage /var/www/html/uploads \
 && chmod -R 755 /var/www/html/storage /var/www/html/uploads \
 && chmod 644 /var/www/html/.htaccess 2>/dev/null || true

# PHP production tweaks
RUN printf 'upload_max_filesize=55M\npost_max_size=60M\nmemory_limit=256M\nmax_execution_time=60\ndisplay_errors=Off\nlog_errors=On\nerror_log=/var/www/html/storage/logs/php-error.log\nsession.cookie_secure=0\nsession.cookie_httponly=1\n' > /usr/local/etc/php/conf.d/mexa.ini

# Entrypoint handles $PORT (Railway injects PORT env)
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

EXPOSE 80

CMD ["/usr/local/bin/docker-entrypoint.sh"]

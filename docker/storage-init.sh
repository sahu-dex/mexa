#!/bin/sh
# MEXA MOTION — persistent media storage for the container image.
#
# The container disk is ephemeral: every start begins from the image, so files
# the admin uploads to storage/app/public/media would disappear on the next
# container restart. When R2_* variables are present, the Laravel "public" disk
# (storage/app/public/media) is instead served from a Cloudflare R2 bucket:
#
#   storage/app/public/media  ->  /mnt/r2/media
#   /mnt/r2                   ->  R2 bucket mounted with tigrisfs (FUSE)
#
# Nothing in the Laravel source changes: Storage::disk('public') and the
# /storage/media/{file} route keep working because the path is the same.
# Without R2_* variables the script exits quietly and media stays on the
# container disk (fine for testing, lost on restart).

set -eu

MEDIA_LINK=/var/www/html/storage/app/public/media
MEDIA_BACKUP=/var/www/html/storage/app/media-ephemeral
MOUNT_DIR=/mnt/r2
LOG_TAG="[mexa-storage]"

log() {
    printf '%s %s\n' "$LOG_TAG" "$*" >&2
}

if [ -z "${R2_BUCKET:-}" ] || [ -z "${R2_ACCOUNT_ID:-}" ] \
    || [ -z "${R2_ACCESS_KEY_ID:-}" ] || [ -z "${R2_SECRET_ACCESS_KEY:-}" ]; then
    log "R2 is not configured; uploaded media will stay on the container disk."
    exit 0
fi

if [ ! -x /usr/local/bin/tigrisfs ]; then
    log "tigrisfs is missing from the image; keeping media on the container disk."
    exit 0
fi

mkdir -p "$MOUNT_DIR"
mkdir -p "$MEDIA_BACKUP"

# Preserve anything already written to the ephemeral media directory.
if [ -d "$MEDIA_LINK" ] && [ ! -L "$MEDIA_LINK" ]; then
    cp -a "$MEDIA_LINK/." "$MEDIA_BACKUP/" 2>/dev/null || true
    rmdir "$MEDIA_LINK" 2>/dev/null || true
fi

log "mounting R2 bucket ${R2_BUCKET} on ${MOUNT_DIR}"

AWS_ACCESS_KEY_ID="$R2_ACCESS_KEY_ID" \
AWS_SECRET_ACCESS_KEY="$R2_SECRET_ACCESS_KEY" \
/usr/local/bin/tigrisfs \
    --endpoint "https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com" \
    --region auto \
    -f \
    -o allow_other \
    -o dir_mode=0775 \
    -o file_mode=0664 \
    "$R2_BUCKET" "$MOUNT_DIR" &

fuse_pid=$!
attempt=0
# Wait for the mount instead of reading an empty directory.
while ! mountpoint -q "$MOUNT_DIR"; do
    if ! kill -0 "$fuse_pid" 2>/dev/null; then
        log "tigrisfs exited before mounting; keeping media on the container disk."
        exit 0
    fi
    attempt=$((attempt + 1))
    if [ "$attempt" -ge 60 ]; then
        log "timed out mounting R2; keeping media on the container disk."
        exit 0
    fi
    sleep 1
done

mkdir -p "${MOUNT_DIR}/media"

# Repoint the application's public media directory at the bucket.
if [ -d "$MEDIA_LINK" ] && [ ! -L "$MEDIA_LINK" ]; then
    rmdir "$MEDIA_LINK" 2>/dev/null || rm -rf "$MEDIA_LINK"
fi
ln -sfn "${MOUNT_DIR}/media" "$MEDIA_LINK"

# Restore files that were uploaded before the mount was ready.
if [ -d "$MEDIA_BACKUP" ]; then
    cp -an "$MEDIA_BACKUP/." "${MOUNT_DIR}/media/" 2>/dev/null || true
fi

chown -R www-data:www-data "$MOUNT_DIR" 2>/dev/null || true
log "R2 media storage ready at ${MOUNT_DIR}/media"

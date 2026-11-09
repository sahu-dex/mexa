<?php

namespace App\Support;

final class MediaFiles
{
    /** @var array<string, string> */
    private const MIME_EXTENSIONS = [
        'image/jpeg' => 'jpg',
        'image/png' => 'png',
        'image/webp' => 'webp',
        'image/gif' => 'gif',
        'video/mp4' => 'mp4',
        'video/webm' => 'webm',
        'video/ogg' => 'ogg',
        'application/ogg' => 'ogg',
    ];

    /** @var list<string> */
    private const PUBLIC_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'mp4', 'webm', 'ogg'];

    public static function extensionForMime(string $mime): ?string
    {
        return self::MIME_EXTENSIONS[strtolower(trim($mime))] ?? null;
    }

    /**
     * Reject inline file payloads anywhere in a structured admin request.
     */
    public static function containsInlineMedia(mixed $value): bool
    {
        if (is_array($value)) {
            foreach ($value as $child) {
                if (self::containsInlineMedia($child)) {
                    return true;
                }
            }

            return false;
        }

        if (!is_string($value)) {
            return false;
        }

        $text = trim($value);

        // Match media data URIs (including embedded ones) and raw long base64 blobs,
        // without rejecting ordinary copy that happens to begin with "Data:".
        return preg_match('/data:(?:image|video)\//i', $text) === 1
            || preg_match('/data:[a-z0-9.+-]+\/[a-z0-9.+-]+;base\d{2},/i', $text) === 1
            || preg_match('/^[A-Za-z0-9+\/]{1000,}={0,2}$/', $text) === 1;
    }

    /**
     * Media fields may use a public HTTP(S) URL or a site-relative asset path.
     */
    public static function isSafeMediaUrl(string $value): bool
    {
        $value = trim($value);
        if ($value === '') {
            return true;
        }

        if (self::containsInlineMedia($value) || preg_match('/[\x00-\x1F\x7F]/', $value) === 1 || str_contains($value, '\\')) {
            return false;
        }

        if (str_starts_with($value, '/')) {
            return !str_starts_with($value, '//');
        }

        if (preg_match('/^[A-Za-z][A-Za-z0-9+.-]*:/', $value) === 1) {
            $scheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));

            return in_array($scheme, ['http', 'https'], true) && filter_var($value, FILTER_VALIDATE_URL) !== false;
        }

        return true;
    }

    /**
     * Only UUID-named files with an allowed media extension may be served or deleted.
     */
    public static function isSafeFilename(string $filename): bool
    {
        return preg_match('/^[a-f0-9-]{36}\.(?:'.implode('|', self::PUBLIC_EXTENSIONS).')$/i', $filename) === 1;
    }
}

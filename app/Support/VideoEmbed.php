<?php

namespace App\Support;

class VideoEmbed
{
    public static function decorateItem(array $item, string $urlKey = 'url'): array
    {
        if (($item['kind'] ?? '') === 'image' || empty($item[$urlKey])) {
            return $item;
        }

        $embed = self::resolve((string) $item[$urlKey]);
        $item['embed_provider'] = $embed['provider'];
        $item['embed_type'] = $embed['type'];
        $item['embed_url'] = $embed['embed_url'];
        if (empty($item['thumbnail_url']) && !empty($embed['thumbnail_url'])) {
            $item['thumbnail_url'] = $embed['thumbnail_url'];
        }

        return $item;
    }

    public static function decorateServices(array $services): array
    {
        foreach ($services as &$service) {
            if (!empty($service['main_video_url'])) {
                $embed = self::resolve((string) $service['main_video_url']);
                $service['main_video_embed_type'] = $embed['type'];
                $service['main_video_embed_url'] = $embed['embed_url'];
                $service['main_video_provider'] = $embed['provider'];
            }
            foreach ($service['demo_videos'] ?? [] as &$video) {
                $video = self::decorateItem($video, 'video_url');
            }
            unset($video);
        }
        unset($service);

        return $services;
    }

    public static function resolve(string $input): array
    {
        $url = trim($input);
        $parts = parse_url($url);
        if (!$parts || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true) || empty($parts['host'])) {
            return ['provider' => 'unsupported', 'type' => 'link', 'url' => '', 'embed_url' => ''];
        }

        $host = strtolower(preg_replace('/^www\./', '', $parts['host']));
        $path = $parts['path'] ?? '';
        $query = [];
        parse_str($parts['query'] ?? '', $query);

        if (in_array($host, ['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtube-nocookie.com'], true) || $host === 'youtu.be') {
            $id = $host === 'youtu.be' ? trim($path, '/') : ($query['v'] ?? (preg_match('~/(?:embed|shorts|live)/([^/?]+)~', $path, $m) ? $m[1] : ''));
            if ($id && preg_match('/^[A-Za-z0-9_-]{6,20}$/', $id)) {
                return ['provider' => 'youtube', 'type' => 'iframe', 'url' => $url, 'embed_url' => 'https://www.youtube-nocookie.com/embed/'.$id, 'thumbnail_url' => 'https://i.ytimg.com/vi/'.$id.'/hqdefault.jpg'];
            }
        }

        if (in_array($host, ['drive.google.com', 'docs.google.com'], true)) {
            $id = $query['id'] ?? (preg_match('~/file/d/([A-Za-z0-9_-]+)~', $path, $m) ? $m[1] : '');
            if ($id && preg_match('/^[A-Za-z0-9_-]{10,}$/', $id)) {
                return ['provider' => 'google-drive', 'type' => 'iframe', 'url' => $url, 'embed_url' => 'https://drive.google.com/file/d/'.$id.'/preview'];
            }
        }

        if ($host === 'facebook.com' || str_ends_with($host, '.facebook.com') || $host === 'fb.watch') {
            return ['provider' => 'facebook', 'type' => 'iframe', 'url' => $url, 'embed_url' => 'https://www.facebook.com/plugins/video.php?href='.rawurlencode($url).'&show_text=0&width=1280'];
        }

        if ($host === 'vimeo.com' || str_ends_with($host, '.vimeo.com')) {
            if (preg_match('~/(?:video/)?(\d+)~', $path, $m)) {
                return ['provider' => 'vimeo', 'type' => 'iframe', 'url' => $url, 'embed_url' => 'https://player.vimeo.com/video/'.$m[1]];
            }
        }

        if ($host === 'dailymotion.com' || $host === 'dai.ly') {
            $id = $host === 'dai.ly' ? trim($path, '/') : (preg_match('~/video/([A-Za-z0-9]+)~', $path, $m) ? $m[1] : '');
            if ($id && preg_match('/^[A-Za-z0-9]+$/', $id)) {
                return ['provider' => 'dailymotion', 'type' => 'iframe', 'url' => $url, 'embed_url' => 'https://www.dailymotion.com/embed/video/'.$id];
            }
        }

        if ($host === 'streamable.com' && preg_match('~^/([A-Za-z0-9]+)~', $path, $m)) {
            return ['provider' => 'streamable', 'type' => 'iframe', 'url' => $url, 'embed_url' => 'https://streamable.com/e/'.$m[1]];
        }

        $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
        if (in_array($extension, ['mp4', 'webm', 'ogv', 'ogg', 'm4v', 'mov', 'm3u8'], true)) {
            return ['provider' => $host === 'catbox.moe' || str_ends_with($host, '.catbox.moe') ? 'catbox' : $host, 'type' => 'video', 'url' => $url, 'embed_url' => $url, 'stream_type' => $extension === 'm3u8' ? 'hls' : 'file'];
        }

        // Keep unknown hosts as a plain link; never turn an untrusted URL into iframe HTML.
        return ['provider' => $host, 'type' => 'link', 'url' => $url, 'embed_url' => '', 'thumbnail_url' => ''];
    }
}

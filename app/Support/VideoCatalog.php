<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

final class VideoCatalog
{
    private const WORK_SECTIONS = ['items', 'recent', 'demos', 'shorts', 'videos'];

    public static function importLegacy(): int
    {
        if (!Schema::hasTable('video_library') || !Schema::hasTable('video_placements')) {
            return 0;
        }

        $entries = [];
        $portfolio = SiteData::get('portfolio');
        foreach (self::WORK_SECTIONS as $section) {
            $urlKey = $section === 'videos' ? 'video_url' : 'url';
            foreach ($portfolio[$section] ?? [] as $item) {
                if (!is_array($item) || ($item['kind'] ?? 'video') === 'image' || empty($item[$urlKey])) {
                    continue;
                }
                $entries[] = [
                    'page' => 'work', 'section' => $section, 'item_key' => (string) ($item['id'] ?? ''),
                    'service_id' => null, 'item' => $item, 'url' => (string) $item[$urlKey],
                    'url_key' => $urlKey,
                ];
            }
        }

        $settings = SiteData::get('settings');
        $content = $settings['content'] ?? [];
        if (!empty($content['overview_video_url'])) {
            $entries[] = ['page' => 'service', 'section' => 'overview', 'item_key' => '', 'service_id' => null,
                'item' => ['title' => 'Services overview', 'thumbnail_url' => $content['overview_poster_url'] ?? ''],
                'url' => (string) $content['overview_video_url'], 'url_key' => 'url'];
        }

        foreach (SiteData::get('services') as $service) {
            if (!is_array($service)) {
                continue;
            }
            $serviceId = (string) ($service['id'] ?? '');
            if ($serviceId !== '' && !empty($service['main_video_url'])) {
                $entries[] = ['page' => 'service', 'section' => 'service-card', 'item_key' => $serviceId, 'service_id' => $serviceId,
                    'item' => ['title' => (string) ($service['name'] ?? 'Service video'), 'description' => (string) ($service['subtitle'] ?? $service['description'] ?? ''), 'thumbnail_url' => $service['video_thumbnail'] ?? '', 'category' => $service['name'] ?? ''],
                    'url' => (string) $service['main_video_url'], 'url_key' => 'url'];
            }
            foreach ($service['demo_videos'] ?? [] as $demo) {
                if (!is_array($demo) || empty($demo['video_url'])) {
                    continue;
                }
                $itemKey = (string) ($demo['id'] ?? '');
                $entries[] = ['page' => 'service', 'section' => 'service-demo', 'item_key' => $itemKey, 'service_id' => $serviceId ?: null,
                    'item' => array_replace($demo, ['category' => $service['name'] ?? '']),
                    'url' => (string) $demo['video_url'], 'url_key' => 'video_url'];
            }
        }

        return DB::transaction(function () use ($entries): int {
            $created = 0;
            foreach ($entries as $entry) {
                $url = trim($entry['url']);
                $resolved = VideoEmbed::resolve($url);
                if (!in_array($resolved['type'], ['iframe', 'video'], true)) {
                    continue;
                }
                $hash = hash('sha256', $url);
                $record = DB::table('video_library')->where('url_hash', $hash)->first();
                if (!$record) {
                    $item = $entry['item'];
                    $id = DB::table('video_library')->insertGetId([
                        'url_hash' => $hash,
                        'title' => mb_substr(trim((string) ($item['title'] ?? $item['name'] ?? $resolved['provider'].' video')) ?: ucfirst($resolved['provider']).' video', 0, 180),
                        'description' => mb_substr(trim((string) ($item['description'] ?? '')), 0, 5000) ?: null,
                        'url' => $url,
                        'provider' => $resolved['provider'],
                        'embed_type' => $resolved['type'],
                        'embed_url' => $resolved['embed_url'] ?: null,
                        'thumbnail_url' => self::validThumbnail((string) ($item['thumbnail_url'] ?? $item['video_thumbnail'] ?? $resolved['thumbnail_url'] ?? '')),
                        'category' => mb_substr((string) ($item['category'] ?? ''), 0, 120) ?: null,
                        'is_featured' => (bool) ($item['is_featured'] ?? false),
                        'is_enabled' => !in_array($item['status'] ?? 'done', ['draft', 'disabled', 'inactive'], true),
                        'display_order' => max(0, (int) ($item['sort_order'] ?? 0)),
                        'created_at' => now(), 'updated_at' => now(),
                    ]);
                    $record = DB::table('video_library')->find($id);
                    $created++;
                }
                self::attachPlacement((int) $record->id, $entry['page'], $entry['section'], (string) $entry['item_key'], $entry['service_id']);
            }

            return $created;
        });
    }

    public static function records(bool $enabledOnly = false): array
    {
        if (!Schema::hasTable('video_library')) {
            return [];
        }

        $query = DB::table('video_library')->orderBy('display_order')->orderBy('id');
        if ($enabledOnly) {
            $query->where('is_enabled', true);
        }
        $rows = $query->get();
        if ($rows->isEmpty()) {
            return [];
        }
        $placements = DB::table('video_placements')->whereIn('video_id', $rows->pluck('id'))->orderBy('page')->orderBy('section')->orderBy('id')->get()->groupBy('video_id');

        return $rows->map(function ($row) use ($placements): array {
            $resolved = VideoEmbed::resolve((string) $row->url);
            return [
                'id' => (int) $row->id,
                'title' => (string) $row->title,
                'description' => (string) ($row->description ?? ''),
                'url' => (string) $row->url,
                'video_url' => (string) $row->url,
                'provider' => $resolved['provider'],
                'source_type' => $resolved['provider'],
                'embed_type' => $resolved['type'],
                'embed_url' => $resolved['embed_url'],
                'thumbnail_url' => (string) ($row->thumbnail_url ?: ($resolved['thumbnail_url'] ?? '')),
                'category' => (string) ($row->category ?? ''),
                'is_featured' => (bool) $row->is_featured,
                'is_enabled' => (bool) $row->is_enabled,
                'status' => $row->is_enabled ? 'active' : 'disabled',
                'display_order' => (int) $row->display_order,
                'created_at' => $row->created_at,
                'updated_at' => $row->updated_at,
                'placements' => ($placements->get($row->id) ?? collect())->map(fn ($placement): array => [
                    'page' => (string) $placement->page,
                    'section' => (string) $placement->section,
                    'item_key' => (string) $placement->item_key,
                    'service_id' => $placement->service_id === null ? null : (string) $placement->service_id,
                ])->all(),
            ];
        })->all();
    }

    public static function hydrate(array $data): array
    {
        $rows = self::allRowsWithPlacements();
        if (!$rows) {
            return $data;
        }

        $work = $data['portfolio'] ?? [];
        foreach (self::WORK_SECTIONS as $section) {
            $urlKey = $section === 'videos' ? 'video_url' : 'url';
            $items = [];
            $matched = [];
            foreach ($work[$section] ?? [] as $item) {
                if (!is_array($item) || ($item['kind'] ?? 'video') === 'image') {
                    $items[] = $item;
                    continue;
                }
                $record = self::findLegacyRecord($rows, 'work', $section, (string) ($item['id'] ?? ''), (string) ($item[$urlKey] ?? $item['url'] ?? ''));
                if ($record && !$record['is_enabled']) {
                    $matched[$record['id']] = true;
                    continue;
                }
                if ($record) {
                    $matched[$record['id']] = true;
                    $item = array_replace($item, self::legacyFields($record, $urlKey));
                }
                $items[] = $item;
            }
            foreach ($rows as $record) {
                if (!$record['is_enabled'] || isset($matched[$record['id']])) {
                    continue;
                }
                foreach ($record['placements'] as $placement) {
                    if ($placement['page'] !== 'work' || $placement['section'] !== $section) {
                        continue;
                    }
                    $items[] = self::legacyFields($record, $urlKey);
                    $matched[$record['id']] = true;
                    break;
                }
            }
            $work[$section] = $items;
        }
        $data['portfolio'] = $work;

        $services = $data['services'] ?? [];
        foreach ($services as &$service) {
            if (!is_array($service)) {
                continue;
            }
            $serviceId = (string) ($service['id'] ?? '');
            foreach ($rows as $record) {
                foreach ($record['placements'] as $placement) {
                    if ($placement['page'] !== 'service' || (string) ($placement['service_id'] ?? '') !== $serviceId) {
                        continue;
                    }
                    if ($placement['section'] === 'service-card') {
                        if (!$record['is_enabled']) {
                            $service['main_video_url'] = '';
                            $service['video_thumbnail'] = '';
                            $service['media'] = array_replace($service['media'] ?? [], ['type' => !empty($service['image_url']) ? 'image' : 'none', 'videoUrl' => '', 'thumbnail' => '']);
                            continue;
                        }
                        $service['main_video_url'] = $record['url'];
                        $service['video_thumbnail'] = $record['thumbnail_url'];
                        $service['media'] = array_replace($service['media'] ?? [], [
                            'type' => 'video', 'videoUrl' => $record['url'], 'thumbnail' => $record['thumbnail_url'],
                            'embedType' => $record['embed_type'], 'embedUrl' => $record['embed_url'], 'provider' => $record['provider'],
                        ]);
                    }
                    if ($placement['section'] === 'service-demo') {
                        $demos = $service['demo_videos'] ?? [];
                        $found = false;
                        foreach ($demos as $index => $demo) {
                            if ((string) ($demo['id'] ?? '') === (string) $placement['item_key'] || ($demo['video_url'] ?? '') === $record['url']) {
                                $found = true;
                                if (!$record['is_enabled']) {
                                    unset($demos[$index]);
                                } else {
                                    $demos[$index] = array_replace($demo, self::legacyFields($record, 'video_url'));
                                }
                            }
                        }
                        if (!$found && $record['is_enabled']) {
                            $demos[] = self::legacyFields($record, 'video_url');
                        }
                        $service['demo_videos'] = array_values($demos);
                    }
                }
            }
            if (empty($service['main_video_url']) && !empty($service['image_url'])) {
                $service['media'] = array_replace($service['media'] ?? [], ['type' => 'image', 'imageUrl' => $service['image_url']]);
            }
        }
        unset($service);
        $data['services'] = $services;

        $settings = $data['settings'] ?? [];
        $content = $settings['content'] ?? [];
        foreach ($rows as $record) {
            foreach ($record['placements'] as $placement) {
                if ($placement['page'] !== 'service' || $placement['section'] !== 'overview') {
                    continue;
                }
                if ($record['is_enabled']) {
                    $content['overview_video_url'] = $record['url'];
                    $content['overview_video_embed_type'] = $record['embed_type'];
                    $content['overview_video_embed_url'] = $record['embed_url'];
                    $content['overview_video_provider'] = $record['provider'];
                    $content['overview_poster_url'] = $record['thumbnail_url'] ?: ($content['overview_poster_url'] ?? '');
                } else {
                    $content['overview_video_url'] = '';
                    $content['overview_video_embed_type'] = '';
                    $content['overview_video_embed_url'] = '';
                    $content['overview_video_provider'] = '';
                }
            }
        }
        $settings['content'] = $content;
        $data['settings'] = $settings;

        return $data;
    }

    public static function attachPlacement(int $videoId, string $page, string $section, string $itemKey = '', ?string $serviceId = null): void
    {
        if ($serviceId !== null && $itemKey === '') {
            $itemKey = $serviceId;
        }
        DB::table('video_placements')->updateOrInsert(
            ['video_id' => $videoId, 'page' => $page, 'section' => $section, 'item_key' => mb_substr($itemKey, 0, 60)],
            ['service_id' => $serviceId, 'updated_at' => now(), 'created_at' => now()],
        );
    }

    public static function validThumbnail(string $url): ?string
    {
        $url = trim($url);
        return $url !== '' && filter_var($url, FILTER_VALIDATE_URL) && in_array(strtolower((string) parse_url($url, PHP_URL_SCHEME)), ['http', 'https'], true)
            ? mb_substr($url, 0, 2048)
            : null;
    }

    private static function allRowsWithPlacements(): array
    {
        if (!Schema::hasTable('video_library')) {
            return [];
        }
        $rows = DB::table('video_library')->orderBy('display_order')->orderBy('id')->get();
        if ($rows->isEmpty()) {
            return [];
        }
        $placements = DB::table('video_placements')->whereIn('video_id', $rows->pluck('id'))->get()->groupBy('video_id');
        return $rows->map(fn ($row): array => array_replace((array) $row, [
            'id' => (int) $row->id,
            'url' => (string) $row->url,
            'is_enabled' => (bool) $row->is_enabled,
            'is_featured' => (bool) $row->is_featured,
            'display_order' => (int) $row->display_order,
            'placements' => ($placements->get($row->id) ?? collect())->map(fn ($placement): array => [
                'page' => (string) $placement->page,
                'section' => (string) $placement->section,
                'item_key' => (string) $placement->item_key,
                'service_id' => $placement->service_id === null ? null : (string) $placement->service_id,
            ])->all(),
        ]))->all();
    }

    private static function findLegacyRecord(array $records, string $page, string $section, string $itemKey, string $url): ?array
    {
        $hash = $url !== '' ? hash('sha256', $url) : '';
        foreach ($records as $record) {
            foreach ($record['placements'] as $placement) {
                if ($placement['page'] === $page && $placement['section'] === $section && $itemKey !== '' && $placement['item_key'] === $itemKey) {
                    return $record;
                }
            }
        }
        if ($hash !== '') {
            foreach ($records as $record) {
                if (($record['url_hash'] ?? '') === $hash) {
                    return $record;
                }
            }
        }
        return null;
    }

    private static function legacyFields(array $record, string $urlKey = 'url'): array
    {
        $fields = [
            'title' => (string) $record['title'],
            'description' => (string) ($record['description'] ?? ''),
            'thumbnail_url' => (string) ($record['thumbnail_url'] ?? ''),
            'kind' => 'video', 'platform' => (string) $record['provider'],
            'category' => (string) ($record['category'] ?? ''),
            'is_featured' => (bool) ($record['is_featured'] ?? false),
            'status' => 'done', 'sort_order' => (int) ($record['display_order'] ?? 0),
            'embed_provider' => (string) $record['provider'],
            'embed_type' => (string) $record['embed_type'],
            'embed_url' => (string) ($record['embed_url'] ?? ''),
        ];
        $fields[$urlKey] = (string) $record['url'];
        $fields['url'] = (string) $record['url'];
        return $fields;
    }
}

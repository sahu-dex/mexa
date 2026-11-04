<?php

namespace App\Support;

use Illuminate\Support\Facades\DB;

class SiteData
{
    public const SECTIONS = ['settings', 'services', 'packages', 'team', 'portfolio', 'reviews', 'bookings'];

    public static function all(): array
    {
        $rows = DB::table('site_data')->get(['section', 'payload']);
        $data = [];
        foreach ($rows as $row) {
            $data[$row->section] = json_decode($row->payload, true) ?? [];
        }

        return array_replace(self::defaults(), $data);
    }

    public static function get(string $section): array
    {
        $row = DB::table('site_data')->where('section', $section)->value('payload');
        if ($row === null) {
            return self::defaults()[$section] ?? [];
        }

        return json_decode($row, true) ?? [];
    }

    public static function publishedPackages(): array
    {
        $packages = array_values(array_filter(self::get('packages'), static fn ($package): bool => is_array($package)
            && !in_array($package['is_enabled'] ?? $package['active'] ?? true, [false, 0, '0'], true)
            && !in_array(strtolower((string) ($package['status'] ?? 'published')), ['draft', 'unpublished', 'disabled'], true)));

        $packages = array_map(static function (array $package): array {
            $currency = strtoupper((string) ($package['currency'] ?? 'USD'));
            $prices = $package['prices'] ?? [];
            if (is_array($prices) && array_key_exists($currency, $prices) && is_numeric($prices[$currency])) {
                $package['price'] = (float) $prices[$currency];
            }
            $package['currency'] = in_array($currency, ['USD', 'USDT', 'BDT'], true) ? $currency : 'USD';

            return $package;
        }, $packages);

        return self::sortRecords($packages, 'display_order');
    }

    public static function publishedPortfolio(array $portfolio): array
    {
        foreach (['items', 'recent', 'demos', 'shorts', 'videos'] as $key) {
            if (!isset($portfolio[$key]) || !is_array($portfolio[$key])) {
                continue;
            }
            $portfolio[$key] = array_values(array_filter($portfolio[$key], static fn ($item): bool => is_array($item)
                && !in_array($item['is_enabled'] ?? $item['is_published'] ?? true, [false, 0, '0'], true)
                && !in_array(strtolower((string) ($item['status'] ?? 'published')), ['draft', 'unpublished', 'disabled', 'rejected'], true)));
            $portfolio[$key] = self::sortRecords($portfolio[$key], 'display_order', 'sort_order');
        }

        return $portfolio;
    }

    public static function sortRecords(array $rows, string ...$fields): array
    {
        $indexed = [];
        foreach (array_values($rows) as $index => $row) {
            $order = $index;
            foreach ($fields as $field) {
                if (isset($row[$field]) && is_numeric($row[$field])) {
                    $order = (float) $row[$field];
                    break;
                }
            }
            $indexed[] = ['index' => $index, 'order' => $order, 'row' => $row];
        }
        usort($indexed, static fn ($left, $right): int => ($left['order'] <=> $right['order']) ?: ($left['index'] <=> $right['index']));

        return array_values(array_map(static fn ($item) => $item['row'], $indexed));
    }

    public static function put(string $section, array $payload): void
    {
        $existing = DB::table('site_data')->where('section', $section)->first(['id']);
        $values = ['payload' => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE), 'updated_at' => now()];
        if ($existing) {
            DB::table('site_data')->where('id', $existing->id)->update($values);
        } else {
            DB::table('site_data')->insert($values + ['section' => $section, 'created_at' => now()]);
        }
    }

    public static function defaults(): array
    {
        static $defaults;
        if ($defaults !== null) {
            return $defaults;
        }

        $snapshotPath = database_path('seeders/data/site-snapshot.json');
        $snapshot = is_file($snapshotPath) ? json_decode(file_get_contents($snapshotPath), true) : [];
        $content = $snapshot['/api/public/content'] ?? [];
        $contact = $snapshot['/api/public/contact'] ?? [];
        $team = $snapshot['/api/public/team'] ?? ['heading' => 'Our Team', 'intro' => '', 'members' => []];
        $services = $snapshot['/api/public/services']['services'] ?? [];
        $packageTemplates = $snapshot['/api/public/packages']['packages'] ?? [];
        $packages = [];
        $templateByQuality = [];
        foreach ($packageTemplates as $template) {
            $templateByQuality[$template['quality_level'] ?? ''] = $template;
        }
        foreach ($services as $service) {
            $base = (float) ($service['price_from'] ?? 40);
            $features = array_slice($service['features'] ?? preg_split('/\R/', (string) ($service['bullet_points'] ?? ''), -1, PREG_SPLIT_NO_EMPTY), 0, 4);
            foreach ([['premium', 3.98, 'Premium Quality', '1–2 business days', 'Unlimited revisions', 'Best Value', false], ['high', 1.98, 'High Quality', '2–3 business days', '3 revisions', 'Most Popular', true], ['normal', 0.87, 'Normal Quality', '3–4 business days', '1 revision', '', false]] as [$quality, $multiplier, $name, $delivery, $revisions, $badge, $highlight]) {
                $template = $templateByQuality[$quality] ?? [];
                $packages[] = [
                    'id' => ($service['id'] ?? count($packages)).':'.$quality,
                    'serviceId' => (int) ($service['id'] ?? 0),
                    'quality' => $quality,
                    'name' => $template['name'] ?? $name,
                    'price' => max(1, (int) round($base * $multiplier)),
                    'currency' => $template['currency'] ?? 'USD',
                    'description' => $template['description'] ?? '',
                    'features' => array_values($template['features'] ?? $features),
                    'delivery' => $template['delivery_time'] ?? $delivery,
                    'revisions' => $template['revision_limit'] ?? $revisions,
                    'badge' => $template['badge'] ?? $badge,
                    'highlight' => (bool) ($template['is_highlight'] ?? $highlight),
                    'seedName' => $name,
                ];
            }
        }

        $work = $snapshot['/api/public/work'] ?? ['items' => [], 'demos' => [], 'shorts' => [], 'recent' => [], 'categories' => [], 'channels' => []];
        $work['videos'] = $snapshot['/api/public/videos']['videos'] ?? [];
        $reviews = $snapshot['/api/public/reviews']['items'] ?? [];
        foreach ($reviews as &$review) {
            $review['status'] = 'approved';
        }
        unset($review);

        $defaults = [
            'settings' => ['content' => $content, 'contact' => $contact, 'page_content' => [], 'review_stats' => $snapshot['/api/public/reviews']['stats'] ?? []],
            'services' => $services,
            'packages' => $packages,
            'team' => $team,
            'portfolio' => $work,
            'reviews' => $reviews,
            'bookings' => [],
        ];

        return $defaults;
    }
}

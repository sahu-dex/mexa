<?php

namespace App\Http\Controllers;

use App\Support\MediaFiles;
use App\Support\SiteData;
use App\Support\VideoCatalog;
use App\Support\VideoEmbed;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use JsonException;

class SiteApiController extends Controller
{
    public function content(): JsonResponse
    {
        $data = VideoCatalog::hydrate(SiteData::all());
        $content = $data['settings']['content'] ?? [];
        $content['purchase'] = $data['settings']['purchase'] ?? [];

        return response()->json(['content' => $content]);
    }

    public function services(): JsonResponse
    {
        $data = VideoCatalog::hydrate(SiteData::all());
        $services = SiteData::sortRecords(array_values(array_filter(VideoEmbed::decorateServices($data['services']), fn ($row) => !in_array($row['active'] ?? true, [false, 0, '0'], true))), 'display_order', 'sort_order');

        return response()->json(['services' => VideoEmbed::decorateServices($services)]);
    }

    public function packages(): JsonResponse
    {
        return response()->json(['packages' => SiteData::publishedPackages()]);
    }

    public function team(): JsonResponse
    {
        $team = SiteData::get('team');
        $team['members'] = SiteData::sortRecords(array_values(array_filter($team['members'] ?? [], fn ($row) => !in_array($row['is_active'] ?? true, [false, 0, '0'], true))), 'sort_order');

        return response()->json($team);
    }

    public function contact(): JsonResponse
    {
        $settings = SiteData::get('settings');

        return response()->json(array_replace($settings['contact'] ?? [], [
            'purchase' => $settings['purchase'] ?? [],
            'social' => $settings['social'] ?? [],
        ]));
    }

    public function work(): JsonResponse
    {
        $work = SiteData::publishedPortfolio(VideoCatalog::hydrate(SiteData::all())['portfolio']);
        foreach (['items', 'demos', 'shorts', 'recent', 'videos'] as $key) {
            $work[$key] = array_map(fn ($item) => VideoEmbed::decorateItem($item), $work[$key] ?? []);
        }

        return response()->json($work);
    }

    public function videos(): JsonResponse
    {
        return response()->json(['videos' => VideoCatalog::records(true)]);
    }

    public function videoResolve(Request $request): JsonResponse
    {
        $validated = $request->validate(['url' => ['required', 'url:http,https', 'max:2048']]);
        $result = VideoEmbed::resolve($validated['url']);
        if (!in_array($result['type'], ['iframe', 'video'], true)) {
            return response()->json(['message' => 'This video host does not provide a supported embed. Use a YouTube, Facebook, Google Drive, Vimeo, Dailymotion, Streamable, MP4, WebM, or HLS link.'], 422);
        }

        return response()->json($result);
    }

    public function reviews(Request $request): JsonResponse
    {
        $settings = SiteData::get('settings')['content'] ?? [];
        $all = array_values(array_filter(SiteData::get('reviews'), fn ($row) => ($row['status'] ?? 'pending') === 'approved'));
        if (count(array_filter($all, fn ($row) => array_key_exists('display_order', $row))) > 0) {
            $all = SiteData::sortRecords($all, 'display_order');
        } else {
            usort($all, fn ($a, $b) => strcmp((string) ($b['created_at'] ?? ''), (string) ($a['created_at'] ?? '')));
        }
        $limit = min(50, max(1, (int) $request->query('limit', 20)));
        $offset = max(0, (int) $request->query('offset', 0));
        $ratings = array_map(fn ($r) => (int) ($r['rating'] ?? 5), $all);
        $seedReviews = SiteData::defaults()['reviews'] ?? [];
        $storedReviewStats = SiteData::get('settings')['review_stats'] ?? [];
        $reviewStats = count($all) === count($seedReviews) && count(array_filter($all, fn ($r) => str_starts_with((string) ($r['created_at'] ?? ''), '2026-10-'))) === count($seedReviews)
            ? $storedReviewStats
            : ['count' => count($all), 'average' => count($all) ? round(array_sum($ratings) / count($all), 1) : 0, 'five' => count(array_filter($ratings, fn ($rating) => $rating === 5))];

        return response()->json([
            'items' => array_slice($all, $offset, $limit),
            'stats' => $reviewStats,
            'settings' => [
                'review_heading' => $settings['review_heading'] ?? 'Client Reviews',
                'review_hero_image' => $settings['review_hero_image'] ?? '',
                'review_hero_desc' => $settings['review_hero_desc'] ?? '',
            ],
            'offset' => $offset,
            'limit' => $limit,
        ]);
    }

    public function submitReview(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'role' => ['nullable', 'string', 'max:160'],
            'rating' => ['required', 'integer', 'between:1,5'],
            'body' => ['required', 'string', 'min:10', 'max:900'],
            'photo_url' => ['nullable', 'url:http,https', 'max:2048'],
        ]);

        $rows = SiteData::get('reviews');
        $review = [
            'id' => (string) Str::uuid(),
            'name' => trim($validated['name']),
            'role' => trim($validated['role'] ?? ''),
            'photo_url' => $validated['photo_url'] ?? '',
            'rating' => (int) $validated['rating'],
            'body' => trim($validated['body']),
            'status' => 'pending',
            'created_at' => now()->toIso8601String(),
        ];

        DB::transaction(function () use (&$rows, $review): void {
            DB::table('site_data')->where('section', 'reviews')->lockForUpdate()->first();
            $rows = SiteData::get('reviews');
            array_unshift($rows, $review);
            SiteData::put('reviews', $rows);
        });

        return response()->json(['ok' => true, 'status' => 'pending', 'id' => $review['id']], 201);
    }

    public function storePublicData(Request $request): JsonResponse
    {
        $request->validate(['key' => ['required', 'in:mm_bookings_v1'], 'value' => ['required', 'array', 'max:500']]);
        $incoming = $request->input('value');
        $rows = SiteData::get('bookings');
        $knownIds = array_fill_keys(array_map(fn ($row) => (string) ($row['id'] ?? ''), $rows), true);
        $added = 0;

        foreach ($incoming as $ticket) {
            if (!is_array($ticket) || empty($ticket['id']) || isset($knownIds[(string) $ticket['id']])) {
                continue;
            }

            $rows[] = [
                'id' => mb_substr((string) $ticket['id'], 0, 100),
                'ref' => mb_substr((string) ($ticket['ref'] ?? ''), 0, 80),
                'serviceId' => mb_substr((string) ($ticket['serviceId'] ?? ''), 0, 80),
                'serviceName' => mb_substr((string) ($ticket['serviceName'] ?? ''), 0, 180),
                'quality' => mb_substr((string) ($ticket['quality'] ?? ''), 0, 40),
                'packageName' => mb_substr((string) ($ticket['packageName'] ?? ''), 0, 180),
                'price' => max(0, (float) ($ticket['price'] ?? 0)),
                'currency' => mb_substr((string) ($ticket['currency'] ?? 'USD'), 0, 8),
                'message' => mb_substr((string) ($ticket['message'] ?? ''), 0, 5000),
                'status' => 'pending',
                'createdAt' => $ticket['createdAt'] ?? now()->toIso8601String(),
                'updatedAt' => now()->toIso8601String(),
            ];
            $knownIds[(string) $ticket['id']] = true;
            $added++;
        }

        if ($added > 0) {
            SiteData::put('bookings', $rows);
        }

        return response()->json(['ok' => true, 'saved' => $added]);
    }

    public function adminState(): JsonResponse
    {
        $user = request()->attributes->get('admin_user');
        if ($user?->role === 'moderator') {
            return response()->json(['sections' => ['reviews' => SiteData::get('reviews')], 'images' => []]);
        }

        return response()->json(['sections' => SiteData::all(), 'images' => DB::table('media_assets')->latest('id')->limit(100)->get()]);
    }

    public function updateSection(Request $request, string $section): JsonResponse
    {
        abort_unless(in_array($section, SiteData::SECTIONS, true), 404);
        $payload = $request->input('payload');
        if (!is_array($payload)) {
            return response()->json(['message' => 'The section content must be a JSON object or array.'], 422);
        }

        if (MediaFiles::containsInlineMedia($payload)) {
            return response()->json(['message' => 'Upload images and videos as files; do not paste file data or data: URLs into content fields.'], 422);
        }

        try {
            $encoded = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return response()->json(['message' => 'This section contains characters that cannot be saved as JSON.'], 422);
        }

        if (strlen($encoded) > 2_000_000) {
            return response()->json(['message' => 'This section is larger than the 2 MB limit.'], 413);
        }

        if ($section === 'packages') {
            foreach ($payload as $package) {
                if (!is_array($package)) {
                    return response()->json(['message' => 'Each package must be a structured record.'], 422);
                }
                $currency = strtoupper((string) ($package['currency'] ?? 'USD'));
                if (!in_array($currency, ['USD', 'USDT', 'BDT'], true)) {
                    return response()->json(['message' => 'Package currency must be USD, USDT, or BDT.'], 422);
                }
                if (isset($package['price']) && (!is_numeric($package['price']) || (float) $package['price'] < 0)) {
                    return response()->json(['message' => 'Package prices must be zero or greater.'], 422);
                }
                if (isset($package['prices'])) {
                    if (!is_array($package['prices'])) {
                        return response()->json(['message' => 'Currency prices must be an object with separate amounts.'], 422);
                    }
                    if (!array_key_exists($currency, $package['prices']) || !is_numeric($package['prices'][$currency])) {
                        return response()->json(['message' => 'Enter a price for the selected currency. No exchange rate is applied automatically.'], 422);
                    }
                    foreach ($package['prices'] as $unit => $amount) {
                        if (!in_array(strtoupper((string) $unit), ['USD', 'USDT', 'BDT'], true) || ($amount !== null && $amount !== '' && (!is_numeric($amount) || (float) $amount < 0))) {
                            return response()->json(['message' => 'Enter a separate valid amount for each selected currency.'], 422);
                        }
                    }
                }
            }
        }

        if ($section === 'settings') {
            $media = $payload['home_media'] ?? [];
            if (!is_array($media)) {
                return response()->json(['message' => 'Hero media settings must be a structured object.'], 422);
            }
            foreach (['image', 'video'] as $key) {
                $value = trim((string) ($media[$key] ?? ''));
                if ($value !== '' && (!filter_var($value, FILTER_VALIDATE_URL) || !in_array(strtolower((string) parse_url($value, PHP_URL_SCHEME)), ['http', 'https'], true))) {
                    return response()->json(['message' => 'Hero media must use a public HTTP or HTTPS URL.'], 422);
                }
            }
            if (!empty($media['video']) && !preg_match('/\.(mp4|webm|ogg)(?:[?#].*)?$/i', (string) $media['video'])) {
                return response()->json(['message' => 'The hero background video must be a direct MP4, WebM, or Ogg URL.'], 422);
            }
            foreach (['logo_url', 'favicon_url'] as $key) {
                $value = trim((string) ($payload[$key] ?? ''));
                if ($value !== '' && (!filter_var($value, FILTER_VALIDATE_URL) || !in_array(strtolower((string) parse_url($value, PHP_URL_SCHEME)), ['http', 'https'], true))) {
                    return response()->json(['message' => 'Logo and favicon must use a public HTTP or HTTPS URL.'], 422);
                }
            }
            $purchase = $payload['purchase'] ?? [];
            if (!is_array($purchase)) {
                return response()->json(['message' => 'Purchase information must be a structured object.'], 422);
            }
            $purchaseLink = trim((string) ($purchase['button_link'] ?? ''));
            if ($purchaseLink !== '' && !$this->isSafeLink($purchaseLink)) {
                return response()->json(['message' => 'Purchase buttons must use a safe HTTP(S), mailto, tel, or internal link.'], 422);
            }
            foreach (['whatsapp', 'telegram'] as $key) {
                $value = trim((string) ($purchase[$key] ?? ''));
                if ($value !== '' && !$this->isSafeLink($value)) {
                    return response()->json(['message' => 'Purchase contact links must use a safe URL.'], 422);
                }
            }
            foreach (($payload['page_content'] ?? []) as $page => $overrides) {
                if (!is_array($overrides)) {
                    return response()->json(['message' => 'Page content overrides must be structured records.'], 422);
                }
                foreach ($overrides as $override) {
                    if (!is_array($override)) {
                        return response()->json(['message' => 'Page content overrides must be structured records.'], 422);
                    }
                    $src = trim((string) ($override['src'] ?? ''));
                    if ($src !== '' && !MediaFiles::isSafeMediaUrl($src)) {
                        return response()->json(['message' => 'Page images must use a public HTTP(S) URL or a site-relative path, not inline file data.'], 422);
                    }
                    $href = trim((string) ($override['href'] ?? ''));
                    if ($href !== '' && !$this->isSafeLink($href)) {
                        return response()->json(['message' => 'Page links must use a safe HTTP(S), mailto, tel, or internal link.'], 422);
                    }
                }
            }
            if (isset($payload['home_sections'])) {
                if (!is_array($payload['home_sections'])) {
                    return response()->json(['message' => 'Homepage sections must be a list.'], 422);
                }
                $allowed = ['hero', 'services', 'work', 'process', 'reviews', 'team', 'about', 'contact'];
                $keys = [];
                foreach ($payload['home_sections'] as $item) {
                    if (!is_array($item) || !in_array($item['key'] ?? '', $allowed, true) || !is_numeric($item['order'] ?? null)) {
                        return response()->json(['message' => 'Homepage section settings contain an invalid section or order.'], 422);
                    }
                    if (in_array($item['key'], $keys, true)) {
                        return response()->json(['message' => 'A homepage section can only appear once in the order list.'], 422);
                    }
                    $keys[] = $item['key'];
                }
            }
        }

        if ($section === 'team') {
            $members = $payload['members'] ?? [];
            if (!is_array($members)) {
                return response()->json(['message' => 'Team members must be a list of profile records.'], 422);
            }
            $ids = [];
            foreach ($members as $member) {
                if (!is_array($member) || !isset($member['id']) || is_array($member['id']) || is_object($member['id'])) {
                    return response()->json(['message' => 'Every team member needs a unique ID.'], 422);
                }
                $id = (string) $member['id'];
                if (in_array($id, $ids, true)) {
                    return response()->json(['message' => 'Team member IDs must be unique.'], 422);
                }
                $ids[] = $id;
            }
        }

        if ($section === 'portfolio') {
            foreach (['items', 'recent', 'demos', 'shorts', 'videos'] as $group) {
                $items = $payload[$group] ?? [];
                if (!is_array($items)) {
                    return response()->json(['message' => 'Each work category must contain a list of entries.'], 422);
                }
                foreach ($items as $item) {
                    if (!is_array($item)) {
                        return response()->json(['message' => 'Work entries must be structured records.'], 422);
                    }
                    foreach (['url', 'video_url'] as $key) {
                        $url = trim((string) ($item[$key] ?? ''));
                        if ($url !== '' && (!filter_var($url, FILTER_VALIDATE_URL) || !in_array(strtolower((string) parse_url($url, PHP_URL_SCHEME)), ['http', 'https'], true))) {
                            return response()->json(['message' => 'Video links must use a public HTTP or HTTPS URL.'], 422);
                        }
                    }
                }
            }
        }

        if ($section === 'team') {
            $oldIds = array_map(fn ($row) => (string) ($row['id'] ?? ''), SiteData::get('team')['members'] ?? []);
            $newIds = array_map(fn ($row) => (string) ($row['id'] ?? ''), $payload['members'] ?? []);
            $removedIds = array_values(array_diff($oldIds, $newIds));
            if ($removedIds) {
                DB::table('team_profile_access')->whereIn('member_id', $removedIds)->delete();
                DB::table('team_profile_submissions')->whereIn('member_id', $removedIds)->delete();
            }
        }

        try {
            SiteData::put($section, $payload);
        } catch (JsonException) {
            return response()->json(['message' => 'This section contains characters that cannot be saved as JSON.'], 422);
        }

        return response()->json(['ok' => true, 'section' => $section, 'saved_at' => now()->toIso8601String()]);
    }

    public function videoPreview(Request $request): JsonResponse
    {
        $validated = $request->validate(['url' => ['required', 'url:http,https', 'max:2048']]);

        return response()->json(VideoEmbed::resolve($validated['url']));
    }

    public function updatePassword(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'current_password' => ['required', 'string'],
            'password' => ['required', 'string', 'min:12', 'confirmed', 'max:72', function ($attribute, $value, $fail): void {
                if (strlen($value) > 72) {
                    $fail('The password may not exceed 72 bytes.');
                }
            }],
        ]);
        $user = DB::table('users')->find($request->session()->get('admin_user_id'));
        if (!$user || !\Illuminate\Support\Facades\Hash::check($validated['current_password'], $user->password)) {
            return response()->json(['message' => 'The current password is incorrect.'], 422);
        }

        DB::table('users')->where('id', $user->id)->update(['password' => \Illuminate\Support\Facades\Hash::make($validated['password']), 'updated_at' => now()]);
        $request->session()->regenerate();

        return response()->json(['ok' => true]);
    }

    private function isSafeLink(string $value): bool
    {
        if (str_starts_with($value, '/') || str_starts_with($value, '#')) {
            return !str_starts_with($value, '//');
        }
        $scheme = strtolower((string) parse_url($value, PHP_URL_SCHEME));
        if (in_array($scheme, ['mailto', 'tel'], true)) {
            return true;
        }

        return filter_var($value, FILTER_VALIDATE_URL) !== false && in_array($scheme, ['http', 'https'], true);
    }
}

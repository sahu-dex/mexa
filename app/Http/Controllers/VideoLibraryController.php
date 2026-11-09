<?php

namespace App\Http\Controllers;

use App\Support\MediaFiles;
use App\Support\SiteData;
use App\Support\VideoCatalog;
use App\Support\VideoEmbed;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class VideoLibraryController extends Controller
{
    public function index(): JsonResponse
    {
        if (VideoCatalog::records() === []) {
            VideoCatalog::importLegacy();
        }
        return response()->json(['videos' => VideoCatalog::records()]);
    }

    public function store(Request $request): JsonResponse
    {
        return $this->save($request, null);
    }

    public function update(Request $request, int $video): JsonResponse
    {
        abort_unless(DB::table('video_library')->where('id', $video)->exists(), 404);
        return $this->save($request, $video);
    }

    public function destroy(int $video): JsonResponse
    {
        $record = DB::table('video_library')->where('id', $video)->first();
        abort_unless($record, 404);

        DB::transaction(function () use ($record, $video): void {
            $placements = DB::table('video_placements')->where('video_id', $video)->get();
            $this->removeLegacyReferences((string) $record->url, $placements);
            DB::table('video_library')->where('id', $video)->delete();
        });

        return response()->json(['ok' => true]);
    }

    private function save(Request $request, ?int $id): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title' => ['required', 'string', 'max:180'],
            'description' => ['nullable', 'string', 'max:5000'],
            'url' => ['required', 'url:http,https', 'max:2048'],
            'thumbnail_url' => ['nullable', 'url:http,https', 'max:2048'],
            'category' => ['nullable', 'string', 'max:120'],
            'is_featured' => ['sometimes', 'boolean'],
            'is_enabled' => ['sometimes', 'boolean'],
            'display_order' => ['sometimes', 'integer', 'min:0', 'max:100000'],
            'placements' => ['required', 'array', 'min:1', 'max:30'],
            'placements.*.page' => ['required', 'string', Rule::in(['home', 'service', 'work'])],
            'placements.*.section' => ['required', 'string', Rule::in(['showreel', 'overview', 'service-card', 'service-demo', 'items', 'recent', 'demos', 'shorts', 'videos'])],
            'placements.*.item_key' => ['nullable', 'string', 'max:60'],
            'placements.*.service_id' => ['nullable', 'string', 'max:40'],
        ]);

        $validator->after(function ($validator) use ($request): void {
            foreach ((array) $request->input('placements', []) as $index => $placement) {
                if (!is_array($placement) || empty($placement['page']) || empty($placement['section'])) {
                    continue;
                }
                $page = $placement['page'];
                $section = $placement['section'];
                $valid = match ($page) {
                    'home' => $section === 'showreel',
                    'service' => in_array($section, ['overview', 'service-card', 'service-demo'], true),
                    'work' => in_array($section, ['items', 'recent', 'demos', 'shorts', 'videos'], true),
                    default => false,
                };
                if (!$valid) {
                    $validator->errors()->add("placements.$index.section", 'Choose a section that belongs to the selected page.');
                }
                $needsService = $page === 'service' && in_array($section, ['service-card', 'service-demo'], true);
                $serviceId = (string) ($placement['service_id'] ?? '');
                if ($needsService && ($serviceId === '' || !collect(SiteData::get('services'))->contains(fn ($service) => (string) ($service['id'] ?? '') === $serviceId))) {
                    $validator->errors()->add("placements.$index.service_id", 'Select an existing service for this placement.');
                }
                if (!$needsService && $serviceId !== '') {
                    $validator->errors()->add("placements.$index.service_id", 'A service can only be selected for service card or demo placements.');
                }
            }
        });

        $validated = $validator->validate();
        if (MediaFiles::containsInlineMedia($validated['url']) || MediaFiles::containsInlineMedia($validated['thumbnail_url'] ?? '')) {
            throw ValidationException::withMessages(['url' => 'Use an uploaded file URL or a public HTTP(S) link; inline file data is not allowed.']);
        }
        $url = trim($validated['url']);
        $resolved = VideoEmbed::resolve($url);
        if (!in_array($resolved['type'], ['iframe', 'video'], true)) {
            throw ValidationException::withMessages(['url' => 'This URL is not a supported video source. Use YouTube, Facebook, Google Drive, Vimeo, Dailymotion, Streamable, MP4, WebM, or HLS.']);
        }

        $hash = hash('sha256', $url);
        $thumbnail = VideoCatalog::validThumbnail((string) ($validated['thumbnail_url'] ?? '')) ?: ($resolved['thumbnail_url'] ?? null);
        $existingId = $id ?? DB::table('video_library')->where('url_hash', $hash)->value('id');
        foreach ($validated['placements'] as $placement) {
            if (!in_array($placement['section'], ['showreel', 'overview', 'service-card'], true)) {
                continue;
            }
            $itemKey = isset($placement['service_id']) && $placement['service_id'] !== '' ? (string) $placement['service_id'] : '';
            $slot = DB::table('video_placements')->where('page', $placement['page'])->where('section', $placement['section'])->where('item_key', $itemKey);
            if ($existingId !== null) $slot->where('video_id', '!=', $existingId);
            if ($slot->exists()) {
                throw ValidationException::withMessages(['placements' => 'This page section already has a video. Edit or remove the existing record before assigning another.']);
            }
        }
        [$recordId, $reused] = DB::transaction(function () use ($validated, $id, $url, $resolved, $hash, $thumbnail): array {
            $duplicate = DB::table('video_library')->where('url_hash', $hash)->first();
            if ($id !== null && $duplicate && (int) $duplicate->id !== $id) {
                throw ValidationException::withMessages(['url' => 'This video URL is already in the library. Edit that record to reuse it.']);
            }

            $values = [
                'url_hash' => $hash,
                'title' => trim($validated['title']),
                'description' => trim((string) ($validated['description'] ?? '')) ?: null,
                'url' => $url,
                'provider' => $resolved['provider'],
                'embed_type' => $resolved['type'],
                'embed_url' => $resolved['embed_url'] ?: null,
                'thumbnail_url' => $thumbnail,
                'category' => trim((string) ($validated['category'] ?? '')) ?: null,
                'is_featured' => (bool) ($validated['is_featured'] ?? false),
                'is_enabled' => (bool) ($validated['is_enabled'] ?? true),
                'display_order' => (int) ($validated['display_order'] ?? 0),
                'updated_at' => now(),
            ];

            if ($id !== null) {
                $old = DB::table('video_library')->where('id', $id)->first();
                $oldPlacements = DB::table('video_placements')->where('video_id', $id)->get();
                $requested = collect($validated['placements'])->map(fn ($placement): string => implode('|', [
                    $placement['page'], $placement['section'], (string) ($placement['item_key'] ?? ''),
                ]))->all();
                $removed = $oldPlacements->filter(fn ($placement): bool => !in_array(implode('|', [
                    $placement->page, $placement->section, (string) $placement->item_key,
                ]), $requested, true));
                if ($removed->isNotEmpty()) {
                    $this->removeLegacyReferences((string) $old->url, $removed);
                }
                DB::table('video_library')->where('id', $id)->update($values);
                $recordId = $id;
                DB::table('video_placements')->where('video_id', $recordId)->delete();
            } elseif ($duplicate) {
                DB::table('video_library')->where('id', $duplicate->id)->update($values);
                $recordId = (int) $duplicate->id;
            } else {
                $values['created_at'] = now();
                $recordId = (int) DB::table('video_library')->insertGetId($values);
            }

            foreach ($validated['placements'] as $placement) {
                VideoCatalog::attachPlacement(
                    $recordId,
                    $placement['page'],
                    $placement['section'],
                    (string) ($placement['item_key'] ?? ''),
                    isset($placement['service_id']) && $placement['service_id'] !== '' ? (string) $placement['service_id'] : null,
                );
            }

            return [$recordId, $id === null && (bool) $duplicate];
        });

        return response()->json([
            'ok' => true,
            'reused' => $reused,
            'video' => collect(VideoCatalog::records())->firstWhere('id', $recordId),
        ], $id === null && !$reused ? 201 : 200);
    }

    private function removeLegacyReferences(string $url, iterable $placements): void
    {
        $portfolio = SiteData::get('portfolio');
        $portfolioChanged = false;
        foreach ($placements as $placement) {
            if ($placement->page === 'work') {
                $section = (string) $placement->section;
                $urlKey = $section === 'videos' ? 'video_url' : 'url';
                if (!isset($portfolio[$section]) || !is_array($portfolio[$section])) {
                    continue;
                }
                $portfolio[$section] = array_values(array_filter($portfolio[$section], fn ($item) =>
                    (string) ($item['id'] ?? '') !== (string) $placement->item_key
                    && (string) ($item[$urlKey] ?? $item['url'] ?? '') !== $url
                ));
                $portfolioChanged = true;
            }
        }
        if ($portfolioChanged) {
            SiteData::put('portfolio', $portfolio);
        }

        $services = SiteData::get('services');
        $servicesChanged = false;
        foreach ($placements as $placement) {
            if ($placement->page !== 'service' || !$placement->service_id) {
                continue;
            }
            foreach ($services as &$service) {
                if ((string) ($service['id'] ?? '') !== (string) $placement->service_id) {
                    continue;
                }
                if ($placement->section === 'service-card' && ($service['main_video_url'] ?? '') === $url) {
                    $service['main_video_url'] = '';
                    $service['video_thumbnail'] = '';
                    if (!empty($service['image_url'])) {
                        $service['media'] = array_replace($service['media'] ?? [], ['type' => 'image', 'imageUrl' => $service['image_url']]);
                    }
                    $servicesChanged = true;
                }
                if ($placement->section === 'service-demo' && isset($service['demo_videos'])) {
                    $before = count($service['demo_videos']);
                    $service['demo_videos'] = array_values(array_filter($service['demo_videos'], fn ($demo) =>
                        (string) ($demo['id'] ?? '') !== (string) $placement->item_key
                        && (string) ($demo['video_url'] ?? '') !== $url
                    ));
                    $servicesChanged = $servicesChanged || $before !== count($service['demo_videos']);
                }
            }
            unset($service);
        }
        if ($servicesChanged) {
            SiteData::put('services', $services);
        }

        $settings = SiteData::get('settings');
        foreach ($placements as $placement) {
            if ($placement->page === 'service' && $placement->section === 'overview' && ($settings['content']['overview_video_url'] ?? '') === $url) {
                $settings['content']['overview_video_url'] = '';
                $settings['content']['overview_video_embed_type'] = '';
                $settings['content']['overview_video_embed_url'] = '';
                SiteData::put('settings', $settings);
            }
        }
    }
}

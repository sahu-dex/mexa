<?php

namespace App\Http\Controllers;

use App\Support\MediaFiles;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Symfony\Component\HttpFoundation\BinaryFileResponse;
use Throwable;

class ImageUploadController extends Controller
{
    public function index(): JsonResponse
    {
        $media = DB::table('media_assets')->latest('id')->limit(200)->get();

        return response()->json(['media' => $media, 'images' => $media]);
    }

    public function store(Request $request): JsonResponse
    {
        $field = $request->hasFile('media') ? 'media' : ($request->hasFile('image') ? 'image' : 'video');
        $file = $request->file($field);
        if (!$file || !$file->isValid()) {
            return response()->json(['message' => 'Choose a valid image or video file to upload.'], 422);
        }

        $mime = strtolower((string) $file->getMimeType());
        if (str_starts_with($mime, 'image/')) {
            $request->validate([$field => ['required', 'file', 'image', 'mimetypes:image/jpeg,image/png,image/webp,image/gif', 'max:8192']]);
            $kind = 'image';
        } else {
            $request->validate([$field => ['required', 'file', 'mimetypes:video/mp4,video/webm,video/ogg,application/ogg', 'max:204800']]);
            $kind = 'video';
            if ($mime === 'application/ogg') {
                $mime = 'video/ogg';
            }
        }

        // The validated MIME type, not the client-provided name, decides the stored extension.
        $extension = MediaFiles::extensionForMime($mime);
        if ($extension === null) {
            return response()->json(['message' => 'This file type is not supported for website media.'], 422);
        }

        $filename = Str::uuid().'.'.$extension;
        $path = 'media/'.$filename;

        try {
            Storage::disk('public')->makeDirectory('media');
            $storedPath = $file->storeAs('media', $filename, 'public');
            if (!$storedPath || !Storage::disk('public')->exists($path)) {
                Storage::disk('public')->delete($path);

                return response()->json(['message' => 'The file could not be saved to the website storage.'], 500);
            }
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($path);
            report($exception);

            return response()->json(['message' => 'The file could not be saved to the website storage.'], 500);
        }

        $url = url('/storage/media/'.$filename);
        $name = mb_substr(basename((string) $file->getClientOriginalName()), 0, 255);
        $name = trim((string) preg_replace('/[\x00-\x1F\x7F]/', '', $name)) ?: 'Uploaded media';
        $size = (int) $file->getSize();

        try {
            $id = DB::table('media_assets')->insertGetId([
                'url' => $url,
                'thumbnail_url' => $kind === 'image' ? $url : null,
                'provider' => 'local',
                'name' => $name,
                'mime_type' => $mime,
                'size_bytes' => $size,
                'created_at' => now(),
                'updated_at' => now(),
            ]);
        } catch (Throwable $exception) {
            Storage::disk('public')->delete($path);
            report($exception);

            return response()->json(['message' => 'The file was uploaded, but its media record could not be saved. Please try again.'], 500);
        }

        $asset = [
            'id' => $id,
            'url' => $url,
            'thumbnail_url' => $kind === 'image' ? $url : null,
            'provider' => 'local',
            'name' => $name,
            'mime_type' => $mime,
            'size_bytes' => $size,
            'kind' => $kind,
            'disk' => 'public',
            'path' => $path,
        ];

        return response()->json(['ok' => true, 'asset' => $asset, 'image' => $kind === 'image' ? $asset : null], 201);
    }

    public function show(string $file): BinaryFileResponse
    {
        abort_unless(MediaFiles::isSafeFilename($file), 404);

        $urlSuffix = '/storage/media/'.$file;
        $asset = DB::table('media_assets')->where('provider', 'local')->where('url', 'like', '%'.$urlSuffix)->first();
        abort_unless($asset, 404);

        $path = Storage::disk('public')->path('media/'.$file);
        abort_unless(is_file($path), 404);

        return response()->file($path, [
            'Content-Type' => $asset->mime_type ?: 'application/octet-stream',
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }

    public function destroy(int $media): JsonResponse
    {
        $asset = DB::table('media_assets')->where('id', $media)->first();
        abort_unless($asset, 404);

        if ($this->isReferenced((string) $asset->url)) {
            return response()->json(['message' => 'This file is being used on a page or video. Replace it there before removing it.'], 409);
        }

        if ($asset->provider === 'local') {
            $filename = $this->localFilename((string) $asset->url);
            if ($filename !== null) {
                Storage::disk('public')->delete('media/'.$filename);
            }
        }

        DB::table('media_assets')->where('id', $media)->delete();

        return response()->json(['ok' => true]);
    }

    private function localFilename(string $url): ?string
    {
        $path = (string) (parse_url($url, PHP_URL_PATH) ?: '');
        $filename = basename($path);
        if (!MediaFiles::isSafeFilename($filename)) {
            return null;
        }

        // A suffix match also works when APP_URL points to a subfolder installation.
        return str_ends_with($path, '/storage/media/'.$filename) ? $filename : null;
    }

    private function isReferenced(string $url): bool
    {
        if (DB::table('video_library')->where('url', $url)->orWhere('thumbnail_url', $url)->exists()) {
            return true;
        }

        $containsUrl = static function (mixed $value) use (&$containsUrl, $url): bool {
            if (is_array($value)) {
                foreach ($value as $child) {
                    if ($containsUrl($child)) {
                        return true;
                    }
                }

                return false;
            }

            return is_string($value) && ($value === $url || str_starts_with($value, $url.'?') || str_starts_with($value, $url.'#'));
        };

        foreach (DB::table('site_data')->pluck('payload') as $payload) {
            if ($containsUrl(json_decode((string) $payload, true))) {
                return true;
            }
        }

        return false;
    }
}

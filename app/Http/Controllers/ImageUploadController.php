<?php

namespace App\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Throwable;

class ImageUploadController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json(['images' => DB::table('media_assets')->latest('id')->limit(100)->get()]);
    }

    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate(['image' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:8192']]);
        $key = trim((string) config('services.imgbb.key'));
        if ($key === '') {
            return response()->json(['message' => 'ImgBB is not configured yet. Add IMGBB_API_KEY to the server .env file.'], 422);
        }

        $file = $validated['image'];
        try {
            $response = Http::asForm()->timeout(45)->post('https://api.imgbb.com/1/upload', [
                'key' => $key,
                'image' => base64_encode(file_get_contents($file->getRealPath())),
                'name' => pathinfo($file->getClientOriginalName(), PATHINFO_FILENAME),
            ]);
        } catch (Throwable $exception) {
            report($exception);

            return response()->json(['message' => 'The image host could not be reached. Please try again.'], 502);
        }

        if (!$response->successful() || !($response->json('success') ?? false)) {
            return response()->json(['message' => 'ImgBB did not accept this upload. Check the API key and image, then try again.'], 502);
        }

        $data = $response->json('data');
        $url = $data['display_url'] ?? $data['url'] ?? null;
        if (!$url || !filter_var($url, FILTER_VALIDATE_URL)) {
            return response()->json(['message' => 'ImgBB returned an invalid image URL.'], 502);
        }

        $id = DB::table('media_assets')->insertGetId([
            'url' => $url,
            'thumbnail_url' => $data['thumb']['url'] ?? null,
            'provider' => 'imgbb',
            'name' => mb_substr((string) ($data['title'] ?? $file->getClientOriginalName()), 0, 255),
            'mime_type' => $file->getMimeType(),
            'size_bytes' => $file->getSize(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true, 'image' => ['id' => $id, 'url' => $url, 'thumbnail_url' => $data['thumb']['url'] ?? null]], 201);
    }
}

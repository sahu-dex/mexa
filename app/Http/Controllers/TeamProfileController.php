<?php

namespace App\Http\Controllers;

use App\Support\SiteData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\View\View;

class TeamProfileController extends Controller
{
    private const PROFILE_FIELDS = [
        'name', 'role', 'designation', 'photo_url', 'bio', 'description', 'skills', 'responsibilities',
        'whatsapp', 'telegram', 'phone', 'email', 'linkedin', 'facebook', 'instagram', 'youtube', 'website',
    ];

    public function edit(string $token): View
    {
        $member = $this->memberForToken($token);

        return view('pages.team-profile', ['member' => $member, 'token' => $token]);
    }

    public function submit(Request $request, string $token): JsonResponse
    {
        $member = $this->memberForToken($token);
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'role' => ['nullable', 'string', 'max:160'],
            'designation' => ['nullable', 'string', 'max:160'],
            'photo_url' => ['nullable', 'url:http,https', 'max:2048'],
            'bio' => ['nullable', 'string', 'max:3000'],
            'description' => ['nullable', 'string', 'max:5000'],
            'skills' => ['nullable', 'array', 'max:30'],
            'skills.*' => ['string', 'max:120'],
            'responsibilities' => ['nullable', 'array', 'max:30'],
            'responsibilities.*' => ['string', 'max:160'],
            'whatsapp' => ['nullable', 'string', 'max:80'],
            'telegram' => ['nullable', 'string', 'max:500'],
            'phone' => ['nullable', 'string', 'max:80'],
            'email' => ['nullable', 'email', 'max:190'],
            'linkedin' => ['nullable', 'url:http,https', 'max:2048'],
            'facebook' => ['nullable', 'url:http,https', 'max:2048'],
            'instagram' => ['nullable', 'url:http,https', 'max:2048'],
            'youtube' => ['nullable', 'url:http,https', 'max:2048'],
            'website' => ['nullable', 'url:http,https', 'max:2048'],
        ]);

        $payload = array_intersect_key($validated, array_flip(self::PROFILE_FIELDS));
        DB::table('team_profile_submissions')->insert([
            'member_id' => (string) $member['id'],
            'payload' => json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE),
            'status' => 'pending',
            'submitted_at' => now(),
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true, 'status' => 'pending', 'message' => 'Profile changes sent to the MEXA MOTION team for approval.'], 201);
    }

    public function memberForToken(string $token): array
    {
        abort_unless(preg_match('/^[A-Za-z0-9_-]{40,100}$/', $token) === 1, 404);
        $access = DB::table('team_profile_access')->where('token_hash', hash('sha256', $token))->first();
        abort_unless($access, 404);

        $team = SiteData::get('team');
        foreach ($team['members'] ?? [] as $member) {
            if ((string) ($member['id'] ?? '') === (string) $access->member_id) {
                return $member;
            }
        }

        abort(404);
    }
}

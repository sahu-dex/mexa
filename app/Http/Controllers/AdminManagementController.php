<?php

namespace App\Http\Controllers;

use App\Support\SiteData;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AdminManagementController extends Controller
{
    public function approvals(): JsonResponse
    {
        $reviews = array_values(array_filter(SiteData::get('reviews'), fn ($row) => ($row['status'] ?? 'pending') === 'pending'));
        $submissions = DB::table('team_profile_submissions')->where('status', 'pending')->orderByDesc('submitted_at')->get();
        $members = SiteData::get('team')['members'] ?? [];
        $membersById = [];
        foreach ($members as $member) {
            $membersById[(string) ($member['id'] ?? '')] = $member;
        }

        return response()->json([
            'reviews' => $reviews,
            'team_submissions' => $submissions->map(fn ($submission) => [
                'id' => $submission->id,
                'member_id' => $submission->member_id,
                'member_name' => $membersById[(string) $submission->member_id]['name'] ?? 'Former team member',
                'payload' => json_decode($submission->payload, true) ?? [],
                'submitted_at' => $submission->submitted_at,
            ]),
        ]);
    }

    public function decideReview(string $review, string $decision): JsonResponse
    {
        abort_unless(in_array($decision, ['approve', 'reject', 'delete'], true), 404);
        DB::transaction(function () use ($review, $decision): void {
            DB::table('site_data')->where('section', 'reviews')->lockForUpdate()->first();
            $rows = SiteData::get('reviews');
            $index = array_search($review, array_map(fn ($row) => (string) ($row['id'] ?? ''), $rows), true);
            abort_unless($index !== false, 404);
            if ($decision === 'delete') {
                array_splice($rows, $index, 1);
            } else {
                $rows[$index]['status'] = $decision === 'approve' ? 'approved' : 'rejected';
                $rows[$index]['published_at'] = $decision === 'approve' ? now()->toIso8601String() : null;
            }
            SiteData::put('reviews', $rows);
        });

        return response()->json(['ok' => true, 'status' => $decision === 'approve' ? 'approved' : 'rejected']);
    }

    public function decideTeamSubmission(Request $request, int $submission, string $decision): JsonResponse
    {
        abort_unless(in_array($decision, ['approve', 'reject'], true), 404);
        $proposal = DB::table('team_profile_submissions')->where('id', $submission)->where('status', 'pending')->first();
        abort_unless($proposal, 404);

        DB::transaction(function () use ($proposal, $decision, $request): void {
            if ($decision === 'approve') {
                $team = SiteData::get('team');
                $payload = json_decode($proposal->payload, true) ?? [];
                $matched = false;
                $team['members'] ??= [];
                foreach ($team['members'] as &$member) {
                    if ((string) ($member['id'] ?? '') !== (string) $proposal->member_id) {
                        continue;
                    }
                    $member = array_replace($member, $payload);
                    $member['profile_updated_at'] = now()->toIso8601String();
                    $matched = true;
                    break;
                }
                unset($member);
                abort_unless($matched, 404);
                SiteData::put('team', $team);
            }

            DB::table('team_profile_submissions')->where('id', $proposal->id)->update([
                'status' => $decision === 'approve' ? 'approved' : 'rejected',
                'reviewed_by' => $request->session()->get('admin_user_id'),
                'reviewed_at' => now(),
                'updated_at' => now(),
            ]);
        });

        return response()->json(['ok' => true, 'status' => $decision === 'approve' ? 'approved' : 'rejected']);
    }

    public function deleteTeamSubmission(int $submission): JsonResponse
    {
        $deleted = DB::table('team_profile_submissions')->where('id', $submission)->where('status', 'pending')->delete();
        abort_unless($deleted > 0, 404);

        return response()->json(['ok' => true, 'status' => 'deleted']);
    }

    public function profileLink(string $member): JsonResponse
    {
        $found = collect(SiteData::get('team')['members'] ?? [])->contains(fn ($row) => (string) ($row['id'] ?? '') === $member);
        abort_unless($found, 404);

        $token = Str::random(48);
        DB::table('team_profile_access')->updateOrInsert(
            ['member_id' => $member],
            ['token_hash' => hash('sha256', $token), 'updated_at' => now(), 'created_at' => now()],
        );

        return response()->json(['ok' => true, 'url' => url('/team/profile/'.$token)]);
    }

    public function moderators(): JsonResponse
    {
        return response()->json(['users' => DB::table('users')->where('role', 'moderator')->orderBy('name')->get(['id', 'name', 'email', 'role', 'is_active', 'created_at'])]);
    }

    public function storeModerator(Request $request): JsonResponse
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190', 'unique:users,email'],
            'password' => ['required', 'string', 'min:12', 'max:72', function ($attribute, $value, $fail): void {
                if (strlen($value) > 72) {
                    $fail('The password may not exceed 72 bytes.');
                }
            }],
        ]);
        $id = DB::table('users')->insertGetId([
            'name' => trim($data['name']),
            'email' => strtolower($data['email']),
            'password' => Hash::make($data['password']),
            'role' => 'moderator',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        return response()->json(['ok' => true, 'user' => DB::table('users')->where('id', $id)->first(['id', 'name', 'email', 'role', 'is_active', 'created_at'])], 201);
    }

    public function deleteModerator(Request $request, int $user): JsonResponse
    {
        abort_if((int) $request->session()->get('admin_user_id') === $user, 422, 'You cannot deactivate your own account.');
        $record = DB::table('users')->where('id', $user)->where('role', 'moderator')->first();
        abort_unless($record, 404);
        DB::table('users')->where('id', $user)->update(['is_active' => false, 'updated_at' => now()]);

        return response()->json(['ok' => true]);
    }
}

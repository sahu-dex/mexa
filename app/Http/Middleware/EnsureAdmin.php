<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpFoundation\Response;

class EnsureAdmin
{
    public function handle(Request $request, Closure $next): Response
    {
        $id = $request->session()->get('admin_user_id');

        $user = $id ? DB::table('users')->where('id', $id)->where('is_active', true)->first() : null;

        if (!$user) {
            $request->session()->forget('admin_user_id');

            return $request->expectsJson()
                ? response()->json(['message' => 'Your admin session has expired. Please sign in again.'], 401)
                : redirect()->route('admin.login');
        }

        $request->attributes->set('admin_user', $user);

        return $next($request);
    }
}

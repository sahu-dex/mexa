<?php

namespace App\Http\Controllers;

use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Validation\ValidationException;
use Illuminate\View\View;

class AdminController extends Controller
{
    public function setupForm(): View|RedirectResponse
    {
        return DB::table('users')->exists() ? redirect()->route('admin.login') : view('admin.setup');
    }

    public function setup(Request $request): RedirectResponse
    {
        if (DB::table('users')->exists()) {
            abort(403, 'The first admin account has already been created.');
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:120'],
            'email' => ['required', 'email', 'max:190'],
            'password' => ['required', 'string', 'min:12', 'confirmed', 'max:72', function ($attribute, $value, $fail): void {
                if (strlen($value) > 72) {
                    $fail('The password may not exceed 72 bytes.');
                }
            }],
        ]);

        $userId = DB::table('users')->insertGetId([
            'name' => $validated['name'],
            'email' => strtolower($validated['email']),
            'password' => Hash::make($validated['password']),
            'role' => 'owner',
            'is_active' => true,
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $request->session()->regenerate();
        $request->session()->put('admin_user_id', $userId);

        return redirect()->route('admin.dashboard');
    }

    public function loginForm(): View|RedirectResponse
    {
        if (!DB::table('users')->exists()) {
            return redirect()->route('admin.setup');
        }

        return session()->has('admin_user_id') ? redirect()->route('admin.dashboard') : view('admin.login');
    }

    public function login(Request $request): RedirectResponse
    {
        $validated = $request->validate(['email' => ['required', 'email'], 'password' => ['required', 'string']]);
        $key = 'admin-login:'.strtolower($validated['email']).'|'.$request->ip();

        if (RateLimiter::tooManyAttempts($key, 8)) {
            throw ValidationException::withMessages(['email' => 'Too many sign-in attempts. Please wait a minute and try again.']);
        }

        $user = DB::table('users')->where('email', strtolower($validated['email']))->first();
        if (!$user || !$user->is_active || !Hash::check($validated['password'], $user->password)) {
            RateLimiter::hit($key, 60);
            throw ValidationException::withMessages(['email' => 'The email or password is incorrect.']);
        }

        RateLimiter::clear($key);
        $request->session()->regenerate();
        $request->session()->put('admin_user_id', $user->id);

        return redirect()->route('admin.dashboard');
    }

    public function dashboard(Request $request): View|RedirectResponse
    {
        if (!DB::table('users')->exists()) {
            return redirect()->route('admin.setup');
        }

        return view('admin.dashboard', ['admin' => DB::table('users')->find(session('admin_user_id'))]);
    }

    public function logout(Request $request): RedirectResponse
    {
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('admin.login');
    }
}

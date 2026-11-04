<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class EnsureOwner
{
    public function handle(Request $request, Closure $next): Response
    {
        abort_unless($request->attributes->get('admin_user')?->role === 'owner', 403, 'Only the website owner can manage this area.');

        return $next($request);
    }
}

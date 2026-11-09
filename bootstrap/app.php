<?php

use App\Http\Middleware\EnsureAdmin;
use App\Http\Middleware\EnsureOwner;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Cloudflare/Tunnel sends RFC 7239 or X-Forwarded-* headers. Trust
        // proxies only when TRUSTED_PROXIES is explicitly set in .env.
        $middleware->trustProxies(headers: Request::HEADER_FORWARDED
            | Request::HEADER_X_FORWARDED_FOR
            | Request::HEADER_X_FORWARDED_HOST
            | Request::HEADER_X_FORWARDED_PORT
            | Request::HEADER_X_FORWARDED_PROTO
            | Request::HEADER_X_FORWARDED_PREFIX
            | Request::HEADER_X_FORWARDED_AWS_ELB);

        $middleware->alias(['admin' => EnsureAdmin::class, 'admin.owner' => EnsureOwner::class]);
        $middleware->validateCsrfTokens(except: ['api/public/reviews']);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // Keep framework exceptions in Laravel's default error pipeline.
    })
    ->create();

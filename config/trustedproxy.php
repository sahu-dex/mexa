<?php

return [
    /*
    |--------------------------------------------------------------------------
    | Trusted reverse proxies
    |--------------------------------------------------------------------------
    |
    | Cloudflare, a tunnel or another reverse proxy terminates HTTPS before PHP
    | sees the request. Laravel must trust the forwarded headers so generated
    | URLs, redirects, forms and secure cookies use the public HTTPS hostname.
    | Set TRUSTED_PROXIES=* only when the PHP server is reachable exclusively
    | through that proxy; otherwise list proxy IPs/CIDRs separated by commas.
    | Leave it empty for direct Apache/cPanel hosting.
    |
    */

    'proxies' => env('TRUSTED_PROXIES'),
];

<?php

use Illuminate\Support\Facades\Artisan;

Artisan::command('mexa:check', function (): void {
    $this->info('Mexa Motion Laravel site is ready.');
})->purpose('Check the Mexa Motion application bootstrap.');

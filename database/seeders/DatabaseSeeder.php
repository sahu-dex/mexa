<?php

namespace Database\Seeders;

use App\Support\SiteData;
use App\Support\VideoCatalog;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        foreach (SiteData::defaults() as $section => $payload) {
            if (!DB::table('site_data')->where('section', $section)->exists()) {
                SiteData::put($section, $payload);
            }
        }

        VideoCatalog::importLegacy();
    }
}

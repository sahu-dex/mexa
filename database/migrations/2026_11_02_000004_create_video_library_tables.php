<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('video_library', function (Blueprint $table): void {
            $table->id();
            $table->char('url_hash', 64)->unique();
            $table->string('title', 180);
            $table->text('description')->nullable();
            $table->string('url', 2048);
            $table->string('provider', 40);
            $table->string('embed_type', 16);
            $table->text('embed_url')->nullable();
            $table->string('thumbnail_url', 2048)->nullable();
            $table->string('category', 120)->nullable();
            $table->boolean('is_featured')->default(false);
            $table->boolean('is_enabled')->default(true);
            $table->unsignedInteger('display_order')->default(0);
            $table->timestamps();
        });

        Schema::create('video_placements', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('video_id')->constrained('video_library')->cascadeOnDelete();
            $table->string('page', 24);
            $table->string('section', 32);
            $table->string('item_key', 60)->default('');
            $table->string('service_id', 40)->nullable();
            $table->timestamps();
            $table->unique(['video_id', 'page', 'section', 'item_key'], 'video_placement_identity');
            $table->index(['page', 'section', 'service_id'], 'video_placement_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('video_placements');
        Schema::dropIfExists('video_library');
    }
};

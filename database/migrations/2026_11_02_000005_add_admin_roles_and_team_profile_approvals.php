<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->string('role', 24)->default('moderator')->after('password');
            $table->boolean('is_active')->default(true)->after('role');
        });

        DB::table('users')->orderBy('id')->limit(1)->update(['role' => 'owner']);

        Schema::create('team_profile_access', function (Blueprint $table): void {
            $table->id();
            $table->string('member_id', 100)->unique();
            $table->char('token_hash', 64)->unique();
            $table->timestamps();
        });

        Schema::create('team_profile_submissions', function (Blueprint $table): void {
            $table->id();
            $table->string('member_id', 100)->index();
            $table->longText('payload');
            $table->string('status', 16)->default('pending')->index();
            $table->timestamp('submitted_at');
            $table->foreignId('reviewed_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('reviewed_at')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('team_profile_submissions');
        Schema::dropIfExists('team_profile_access');

        Schema::table('users', function (Blueprint $table): void {
            $table->dropColumn(['role', 'is_active']);
        });
    }
};

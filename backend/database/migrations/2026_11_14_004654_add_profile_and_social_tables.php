<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            if (!Schema::hasColumn('users', 'nickname')) {
                $table->string('nickname', 60)->nullable();
            }
            if (!Schema::hasColumn('users', 'phone')) {
                $table->string('phone', 30)->nullable();
            }
            if (!Schema::hasColumn('users', 'bio')) {
                $table->text('bio')->nullable();
            }
            if (!Schema::hasColumn('users', 'status_text')) {
                $table->string('status_text', 100)->nullable();
            }
            if (!Schema::hasColumn('users', 'avatar')) {
                $table->text('avatar')->nullable();
            }
            if (!Schema::hasColumn('users', 'theme_color')) {
                $table->string('theme_color', 20)->default('orange');
            }
            if (!Schema::hasColumn('users', 'notifications_enabled')) {
                $table->boolean('notifications_enabled')->default(true);
            }
        });

        if (!Schema::hasTable('friendships')) {
            Schema::create('friendships', function (Blueprint $table) {
                $table->id();
                $table->foreignId('sender_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('receiver_id')->constrained('users')->cascadeOnDelete();
                $table->string('status', 20)->default('pending'); // pending, accepted
                $table->timestamps();
                $table->unique(['sender_id', 'receiver_id']);
            });
        }

        if (!Schema::hasTable('space_invitations')) {
            Schema::create('space_invitations', function (Blueprint $table) {
                $table->id();
                $table->foreignId('house_id')->constrained('houses')->cascadeOnDelete();
                $table->foreignId('inviter_id')->constrained('users')->cascadeOnDelete();
                $table->foreignId('invitee_id')->constrained('users')->cascadeOnDelete();
                $table->string('status', 20)->default('pending'); // pending, accepted
                $table->timestamps();
                $table->unique(['house_id', 'invitee_id']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('space_invitations');
        Schema::dropIfExists('friendships');
    }
};
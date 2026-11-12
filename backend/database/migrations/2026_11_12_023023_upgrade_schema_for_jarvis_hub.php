<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Contextos na tabela houses
        Schema::table('houses', function (Blueprint $table) {
            $table->string('context_type')->default('personal');
            $table->string('icon')->nullable();
        });

        // 2. Todos os campos do novo fluxo na tabela tasks
        Schema::table('tasks', function (Blueprint $table) {
            $table->boolean('is_completed')->default(false); // Adicionando o boolean que faltava
            $table->string('type')->default('task');
            $table->foreignId('in_progress_by')->nullable()->constrained('users')->nullOnDelete();
            $table->text('completion_note')->nullable();
            $table->timestamp('notify_at')->nullable();
            $table->boolean('notified')->default(false);

            $table->index(['type', 'is_completed']);
            $table->index(['notify_at', 'notified']);
        });

        // 3. Tabela de Resumos Diários do Jarvis
        Schema::create('daily_briefings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->date('reference_date');
            $table->jsonb('calendar_events')->default('[]');
            $table->jsonb('pending_bills')->default('[]');
            $table->jsonb('emails_summary')->default('[]');
            $table->text('spoken_summary')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'reference_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('daily_briefings');
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn([
                'is_completed', 'type', 'in_progress_by', 
                'completion_note', 'notify_at', 'notified'
            ]);
        });
        Schema::table('houses', function (Blueprint $table) {
            $table->dropColumn(['context_type', 'icon']);
        });
    }
};
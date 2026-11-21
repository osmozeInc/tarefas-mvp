<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // 1. Ordem personalizada de espaços por usuário
        Schema::table('house_user', function (Blueprint $table) {
            if (!Schema::hasColumn('house_user', 'position')) {
                $table->integer('position')->default(0);
            }
        });

        // 2. Quem realmente clicou em concluir a tarefa
        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'completed_by')) {
                $table->foreignId('completed_by')->nullable()->constrained('users')->nullOnDelete();
            }
        });

        // 3. Tabela pivô para múltiplos responsáveis por tarefa
        if (!Schema::hasTable('task_assignees')) {
            Schema::create('task_assignees', function (Blueprint $table) {
                $table->id();
                $table->foreignId('task_id')->constrained('tasks')->cascadeOnDelete();
                $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
                $table->timestamps();
                $table->unique(['task_id', 'user_id']);
            });

            // Migra os responsáveis únicos já existentes para a nova tabela pivô
            $existing = DB::table('tasks')->whereNotNull('assigned_to')->get(['id', 'assigned_to']);
            foreach ($existing as $t) {
                DB::table('task_assignees')->insertOrIgnore([
                    'task_id'    => $t->id,
                    'user_id'    => $t->assigned_to,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('task_assignees');

        Schema::table('tasks', function (Blueprint $table) {
            if (Schema::hasColumn('tasks', 'completed_by')) {
                $table->dropConstrainedForeignId('completed_by');
            }
        });

        Schema::table('house_user', function (Blueprint $table) {
            if (Schema::hasColumn('house_user', 'position')) {
                $table->dropColumn('position');
            }
        });
    }
};
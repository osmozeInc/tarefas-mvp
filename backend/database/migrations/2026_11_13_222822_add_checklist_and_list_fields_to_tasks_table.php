<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            if (!Schema::hasColumn('tasks', 'recurrence')) {
                $table->string('recurrence')->default('none');
            }
            if (!Schema::hasColumn('tasks', 'checklist')) {
                $table->jsonb('checklist')->default('[]');
            }
            if (!Schema::hasColumn('tasks', 'is_numbered')) {
                $table->boolean('is_numbered')->default(false);
            }
        });

        // Unifica registros antigos do tipo 'priority' para 'task' com prioridade alta
        DB::table('tasks')->where('type', 'priority')->update([
            'type' => 'task',
            'priority' => 'high',
        ]);
    }

    public function down(): void
    {
        Schema::table('tasks', function (Blueprint $table) {
            $table->dropColumn(['checklist', 'is_numbered']);
        });
    }
};
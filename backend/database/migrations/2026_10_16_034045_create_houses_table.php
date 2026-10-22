<?php

use App\Enums\HouseRole;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('houses', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('invite_code', 12)->unique();
            $table->timestamps();
        });

        // Tabela pivô: controla quem pertence à casa e qual o seu papel
        Schema::create('house_user', function (Blueprint $table) {
            $table->id();
            $table->foreignId('house_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('role')->default(HouseRole::RESIDENT->value);
            $table->timestamps();

            $table->unique(['house_id', 'user_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('house_user');
        Schema::dropIfExists('houses');
    }
};
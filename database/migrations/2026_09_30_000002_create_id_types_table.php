<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Accepted IDs, managed by the Admin. Reception picks one when holding a guest's ID.
        Schema::create('id_types', function (Blueprint $table) {
            $table->id();
            $table->string('name', 50)->unique();
            // Turned off = no longer offered at check-in; kept for past records.
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::table('id_custody', function (Blueprint $table) {
            $table->unsignedBigInteger('id_type_id')->nullable();
        });

        // Check-in is not built yet, so only sample rows exist. Keep their type by name.
        foreach (DB::table('id_custody')->distinct()->pluck('id_type') as $name) {
            $typeId = DB::table('id_types')->where('name', $name)->value('id')
                ?? DB::table('id_types')->insertGetId(['name' => $name, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()]);

            DB::table('id_custody')->where('id_type', $name)->update(['id_type_id' => $typeId]);
        }

        // Separate steps: SQL Server cannot change a column's nullability once a foreign key uses it.
        Schema::table('id_custody', function (Blueprint $table) {
            $table->unsignedBigInteger('id_type_id')->nullable(false)->change();
            $table->foreign('id_type_id')->references('id')->on('id_types');
        });

        Schema::table('id_custody', function (Blueprint $table) {
            $table->dropColumn('id_type');
        });
    }

    public function down(): void
    {
        Schema::table('id_custody', function (Blueprint $table) {
            $table->string('id_type')->nullable();
        });

        foreach (DB::table('id_types')->pluck('name', 'id') as $id => $name) {
            DB::table('id_custody')->where('id_type_id', $id)->update(['id_type' => $name]);
        }

        Schema::table('id_custody', function (Blueprint $table) {
            $table->dropForeign(['id_type_id']);
            $table->dropColumn('id_type_id');
        });

        Schema::dropIfExists('id_types');
    }
};

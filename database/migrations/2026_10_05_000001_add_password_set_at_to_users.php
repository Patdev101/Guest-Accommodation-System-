<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Null = created by an Admin and still waiting for the person to set a password.
        Schema::table('users', function (Blueprint $table) {
            $table->dateTime('password_set_at')->nullable();
        });

        // Everyone who exists already has a password.
        DB::table('users')->update(['password_set_at' => now()]);
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropColumn('password_set_at');
        });
    }
};

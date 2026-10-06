<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            // Set for an overpayment refund on a stay (no cascade: SQL Server rule).
            $table->foreignId('stay_id')->nullable()->constrained();
            // How the money went back, recorded when the refund is completed.
            $table->string('method', 50)->nullable();
            $table->string('reference', 100)->nullable();
        });
    }

    public function down(): void
    {
        Schema::table('refunds', function (Blueprint $table) {
            $table->dropConstrainedForeignId('stay_id');
            $table->dropColumn(['method', 'reference']);
        });
    }
};

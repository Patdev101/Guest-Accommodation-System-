<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Email verification is switched on (owner decision 6 Oct 2026). Accounts that
 * already exist were made before it and must not be locked out, so they count
 * as verified. New guests verify from the email sent when they register; staff
 * accounts are verified when they set their password from the emailed link.
 */
return new class extends Migration
{
    public function up(): void
    {
        DB::table('users')->whereNull('email_verified_at')->update(['email_verified_at' => now()]);
    }

    public function down(): void
    {
        // Nothing to undo: which accounts were unverified before is not kept.
    }
};

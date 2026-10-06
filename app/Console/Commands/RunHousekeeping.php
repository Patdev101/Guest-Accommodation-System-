<?php

namespace App\Console\Commands;

use App\Models\Setting;
use App\Services\Housekeeping;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('housekeeping:run {--backup : Also write a backup}')]
#[Description('Delete ID photos past their retention period, and optionally write a backup')]
class RunHousekeeping extends Command
{
    public function handle(Housekeeping $housekeeping): int
    {
        $days = (int) Setting::get('id_photo_retention_days');

        // 0 days means "keep the photos"; only the Admin's button deletes them then.
        $deleted = $days > 0 ? $housekeeping->deletePhotos($days) : 0;
        $this->info("Deleted {$deleted} ID photo(s).");

        if ($this->option('backup')) {
            $this->info('Backup written: '.$housekeeping->backup());
        }

        return self::SUCCESS;
    }
}

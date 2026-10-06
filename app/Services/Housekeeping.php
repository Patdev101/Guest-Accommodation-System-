<?php

namespace App\Services;

use App\Enums\IdCustodyStatus;
use App\Models\IdCustody;
use App\Models\Setting;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use RuntimeException;
use ZipArchive;

/**
 * Data care for the Admin: deleting ID photos once they are no longer needed
 * (they are personal data), and backups of the database and uploaded files.
 */
class Housekeeping
{
    /** Tables that hold no business records. */
    private const SKIPPED_TABLES = ['cache', 'cache_locks', 'sessions', 'jobs', 'job_batches', 'failed_jobs', 'password_reset_tokens'];

    public const BACKUP_FOLDER = 'backups';

    /**
     * ID photos whose ID was returned more than the retention period ago.
     *
     * @return Builder<IdCustody>
     */
    public function photosDue(?int $days = null): Builder
    {
        $days ??= (int) Setting::get('id_photo_retention_days');

        return IdCustody::query()
            ->where('status', IdCustodyStatus::Returned)
            ->whereNotNull('photo_path')
            ->where('returned_at', '<=', CarbonImmutable::now()->subDays(max(0, $days)));
    }

    /** Delete those photos (the record of the ID stays). Returns how many were deleted. */
    public function deletePhotos(?int $days = null): int
    {
        $deleted = 0;

        foreach ($this->photosDue($days)->get() as $custody) {
            Storage::disk(IdCustody::DISK)->delete((string) $custody->photo_path);
            $custody->updateQuietly(['photo_path' => null]);
            $deleted++;
        }

        return $deleted;
    }

    /**
     * Write a backup: every table as a JSON file, plus room photos and ID photos.
     * Returns the file name.
     */
    public function backup(): string
    {
        $folder = Storage::disk('local')->path(self::BACKUP_FOLDER);
        File::ensureDirectoryExists($folder);

        $name = 'backup-'.CarbonImmutable::now()->format('Y-m-d-His').'.zip';
        $zip = new ZipArchive;

        if ($zip->open($folder.DIRECTORY_SEPARATOR.$name, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) {
            throw new RuntimeException('The backup file could not be created.');
        }

        $tables = [];

        foreach (Schema::getTableListing(schemaQualified: false) as $table) {
            if (in_array($table, self::SKIPPED_TABLES, true)) {
                continue;
            }

            $rows = DB::table($table)->get();
            $zip->addFromString("data/{$table}.json", (string) json_encode($rows, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE));
            $tables[$table] = $rows->count();
        }

        $files = 0;

        foreach ([['public', 'rooms'], [IdCustody::DISK, 'id-photos']] as [$disk, $directory]) {
            foreach (Storage::disk($disk)->allFiles($directory) as $path) {
                $zip->addFile(Storage::disk($disk)->path($path), "files/{$disk}/{$path}");
                $files++;
            }
        }

        $zip->addFromString('README.txt', implode("\n", [
            config('app.name').' backup, made '.CarbonImmutable::now()->format('j M Y, g:i A'),
            '',
            'data/   one JSON file per database table ('.count($tables).' tables, '.array_sum($tables).' rows)',
            'files/  uploaded files: room photos and ID photos ('.$files.' files)',
            '',
            'This file contains personal data (guest names, contact numbers, ID photos). Keep it private.',
        ]));
        $zip->close();

        $this->pruneBackups();

        return $name;
    }

    /**
     * Backups on the server, newest first.
     *
     * @return list<array{name: string, size: int, created_at: string}>
     */
    public function backups(): array
    {
        $disk = Storage::disk('local');

        return array_values(collect($disk->files(self::BACKUP_FOLDER))
            ->filter(fn (string $path) => str_ends_with($path, '.zip'))
            ->map(fn (string $path) => [
                'name' => basename($path),
                'size' => $disk->size($path),
                'created_at' => CarbonImmutable::createFromTimestamp($disk->lastModified($path))->toIso8601String(),
            ])
            ->sortByDesc('name')
            ->all());
    }

    /** The full path of a backup, or null when the name is not one of ours. */
    public function backupPath(string $name): ?string
    {
        if (preg_match('/^backup-[0-9-]+\.zip$/', $name) !== 1) {
            return null;
        }

        $path = self::BACKUP_FOLDER.'/'.$name;

        return Storage::disk('local')->exists($path) ? Storage::disk('local')->path($path) : null;
    }

    public function deleteBackup(string $name): bool
    {
        return $this->backupPath($name) !== null && Storage::disk('local')->delete(self::BACKUP_FOLDER.'/'.$name);
    }

    /** Keep only the newest backups (setting backups_to_keep). */
    private function pruneBackups(): void
    {
        $keep = max(1, (int) Setting::get('backups_to_keep'));

        foreach (array_slice($this->backups(), $keep) as $old) {
            $this->deleteBackup($old['name']);
        }
    }
}

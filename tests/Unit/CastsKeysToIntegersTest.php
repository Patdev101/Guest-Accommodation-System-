<?php

namespace Tests\Unit;

use App\Enums\BilledTo;
use App\Models\MaintenanceRecord;
use App\Models\Payment;
use App\Models\StayRoom;
use PHPUnit\Framework\TestCase;

/**
 * SQL Server returns bigint ids as strings; the tests' SQLite does not, so
 * this checks the casts directly (bug found 30 Sep 2026: inspections 404'd).
 */
class CastsKeysToIntegersTest extends TestCase
{
    public function test_foreign_keys_are_cast_to_integers()
    {
        $casts = (new StayRoom)->getCasts();

        $this->assertSame('integer', $casts['stay_id']);
        $this->assertSame('integer', $casts['room_id']);
        $this->assertSame('integer', $casts['inspected_by']);

        $room = (new StayRoom)->setRawAttributes(['stay_id' => '3', 'room_id' => '12']);
        $this->assertSame(3, $room->stay_id);
        $this->assertSame(12, $room->room_id);
    }

    public function test_existing_casts_are_kept()
    {
        $casts = (new Payment)->getCasts();

        $this->assertSame(BilledTo::class, $casts['paid_by']);
        $this->assertSame('integer', $casts['received_by']);

        // done_by is a name, not a user id.
        $this->assertSame('string', (new MaintenanceRecord)->getCasts()['done_by']);
    }
}

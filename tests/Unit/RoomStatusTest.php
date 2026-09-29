<?php

namespace Tests\Unit;

use App\Enums\PaymentStatus;
use App\Enums\RoomStatus;
use PHPUnit\Framework\TestCase;

class RoomStatusTest extends TestCase
{
    public function test_rooms_follow_the_turnover_cycle()
    {
        $this->assertTrue(RoomStatus::Available->canMoveTo(RoomStatus::Occupied));
        $this->assertTrue(RoomStatus::Occupied->canMoveTo(RoomStatus::CheckOut));
        $this->assertTrue(RoomStatus::CheckOut->canMoveTo(RoomStatus::Inspection));
        $this->assertTrue(RoomStatus::Inspection->canMoveTo(RoomStatus::Cleaning));
        $this->assertTrue(RoomStatus::Cleaning->canMoveTo(RoomStatus::Available));
    }

    public function test_a_room_returns_to_available_only_after_cleaning_or_maintenance()
    {
        $this->assertFalse(RoomStatus::CheckOut->canMoveTo(RoomStatus::Available));
        $this->assertFalse(RoomStatus::Inspection->canMoveTo(RoomStatus::Available));
        $this->assertTrue(RoomStatus::UnderMaintenance->canMoveTo(RoomStatus::Available));
    }

    public function test_maintenance_and_out_of_service_can_start_from_an_available_room()
    {
        $this->assertTrue(RoomStatus::Available->canMoveTo(RoomStatus::UnderMaintenance));
        $this->assertTrue(RoomStatus::Available->canMoveTo(RoomStatus::OutOfService));
        $this->assertTrue(RoomStatus::Inspection->canMoveTo(RoomStatus::UnderMaintenance));
        $this->assertFalse(RoomStatus::Occupied->canMoveTo(RoomStatus::OutOfService));
    }

    public function test_reserved_is_not_a_room_status()
    {
        $this->assertNull(RoomStatus::tryFrom('reserved'));
    }

    public function test_payment_status_follows_the_amount_paid()
    {
        $this->assertSame(PaymentStatus::Unpaid, PaymentStatus::for(1000, 0));
        $this->assertSame(PaymentStatus::Partial, PaymentStatus::for(1000, 1));
        $this->assertSame(PaymentStatus::Paid, PaymentStatus::for(1000, 1000));
    }
}

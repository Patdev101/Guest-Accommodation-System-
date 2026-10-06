<?php

namespace Tests\Feature\Reception;

use App\Enums\RefundStatus;
use App\Models\Refund;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Inertia\Testing\AssertableInertia as Assert;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class RefundTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    public function test_a_refund_moves_from_requested_to_processing_to_refunded()
    {
        $desk = User::factory()->reception()->create();
        $reservation = $this->reserve([$this->roomWithRate('A-101')], Carbon::parse('2026-10-02 14:00'), Carbon::parse('2026-10-03 12:00'));
        $reservation->payments()->create(['amount' => 500, 'payment_type' => 'downpayment', 'paid_by' => 'guest', 'method' => 'Cash', 'received_by' => $desk->id, 'paid_at' => now()]);
        $reservation->requestRefunds(100, 'Cancelled: test', $desk);
        $refund = Refund::query()->sole();

        $this->actingAs($desk)
            ->get(route('reception.refunds.index'))
            ->assertInertia(fn (Assert $page) => $page
                ->component('reception/refunds')
                ->where('openCount', 1)
                ->where('openTotal', '500.00')
                ->where('refunds.data.0.next_label', 'Processing'));

        $this->actingAs($desk)->patch(route('reception.refunds.advance', $refund));
        $refund->refresh();
        $this->assertSame(RefundStatus::Processing, $refund->status);
        $this->assertSame($desk->id, $refund->processed_by);

        // Giving the money back records how it went.
        $this->actingAs($desk)->patch(route('reception.refunds.advance', $refund), ['method' => 'Cash']);
        $refund->refresh();
        $this->assertSame(RefundStatus::Refunded, $refund->status);
        $this->assertNotNull($refund->refunded_at);
        $this->assertSame('Cash', $refund->method);

        $this->actingAs($desk)->patch(route('reception.refunds.advance', $refund));
        $this->assertSame(RefundStatus::Refunded, $refund->refresh()->status);

        $this->assertDatabaseHas('activity_logs', ['subject_type' => 'Refund', 'description' => "Refund of ₱500.00 for reservation #{$reservation->id} is now Refunded"]);
    }
}

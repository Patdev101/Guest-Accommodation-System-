<?php

namespace Tests\Feature;

use App\Enums\BookingRequestStatus;
use App\Enums\GuestType;
use App\Models\BookingRequest;
use App\Models\Setting;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Carbon;
use Tests\Concerns\CreatesBookings;
use Tests\TestCase;

class BookingRequestTablesTest extends TestCase
{
    use CreatesBookings, RefreshDatabase;

    public function test_a_booking_request_is_stored_with_its_rooms_and_hold()
    {
        $this->travelTo(Carbon::parse('2026-10-07 09:00'));
        $room = $this->roomWithRate('A-101');
        $rate = $room->rates()->firstOrFail();
        $hours = (int) Setting::get('booking_request_hold_hours');

        $request = BookingRequest::create([
            'user_id' => User::factory()->create()->id,
            'contact_name' => 'Ana Guest',
            'contact_number' => '0917 000 0000',
            'company' => 'Seatech Welding',
            'guest_type' => GuestType::Visitor,
            'guests' => 2,
            'starts_at' => '2026-10-10 14:00',
            'ends_at' => '2026-10-11 12:00',
            'total' => $rate->price,
            'hold_expires_at' => now()->addHours($hours),
        ]);
        $request->rooms()->create(['room_id' => $room->id, 'room_rate_id' => $rate->id, 'pax' => 2, 'price' => $rate->price]);

        $request->refresh();
        $this->assertSame(24, $hours);
        $this->assertSame(BookingRequestStatus::Pending, $request->status);
        $this->assertTrue($request->isPending());
        $this->assertSame('A-101', $request->rooms()->sole()->room->name);
        $this->assertSame(1, BookingRequest::query()->holding()->count());

        // The hold runs out when Reception does not answer in time.
        $this->travelTo(Carbon::parse('2026-10-08 09:01'));
        $this->assertSame(0, BookingRequest::query()->holding()->count());
    }
}

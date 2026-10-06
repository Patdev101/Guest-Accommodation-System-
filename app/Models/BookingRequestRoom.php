<?php

namespace App\Models;

use App\Concerns\CastsKeysToIntegers;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One room in a booking request, with how many guests it takes and its price.
 *
 * @property int $id
 * @property int $booking_request_id
 * @property int $room_id
 * @property int|null $room_rate_id
 * @property int $pax
 * @property string $price
 * @property-read BookingRequest $bookingRequest
 * @property-read Room $room
 * @property-read RoomRate|null $rate
 */
#[Fillable(['booking_request_id', 'room_id', 'room_rate_id', 'pax', 'price'])]
class BookingRequestRoom extends Model
{
    use CastsKeysToIntegers;

    protected function casts(): array
    {
        return [
            'pax' => 'integer',
            'price' => 'decimal:2',
        ];
    }

    /** @return BelongsTo<BookingRequest, $this> */
    public function bookingRequest(): BelongsTo
    {
        return $this->belongsTo(BookingRequest::class);
    }

    /** @return BelongsTo<Room, $this> */
    public function room(): BelongsTo
    {
        return $this->belongsTo(Room::class);
    }

    /** @return BelongsTo<RoomRate, $this> */
    public function rate(): BelongsTo
    {
        return $this->belongsTo(RoomRate::class, 'room_rate_id');
    }
}

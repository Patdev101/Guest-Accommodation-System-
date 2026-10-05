<?php

namespace App\Http\Requests\Reception;

use App\Concerns\ProfileValidationRules;
use App\Enums\BilledTo;
use App\Enums\GuestType;
use App\Models\Payment;
use App\Models\Reservation;
use App\Models\Room;
use App\Models\RoomRate;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * A booking made at the front desk (walk-in or phone): contact details, dates,
 * one or more rooms, and an optional payment (rules 12 and 15). The guest list
 * and the ID come later, at check-in.
 */
class StoreReservationRequest extends FormRequest
{
    use ProfileValidationRules;

    public const DATE_FORMAT = 'Y-m-d\TH:i';

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'contact_name' => $this->nameRules(),
            'contact_number' => $this->contactNumberRules(),
            'email' => ['nullable', 'string', 'email', 'max:255'],
            // Owner decision 30 Sep 2026: every booking is for a company.
            'company' => ['required', 'string', 'max:255'],
            'purpose' => ['nullable', 'string', 'max:255'],
            'guest_type' => ['required', Rule::enum(GuestType::class)],

            // When editing, an arrival that is left as it was may be in the past (a late guest).
            'starts_at' => ['required', 'date_format:'.self::DATE_FORMAT, ...($this->keepsArrival() ? [] : ['after_or_equal:today'])],
            'ends_at' => ['required', 'date_format:'.self::DATE_FORMAT, 'after:starts_at'],

            'rooms' => ['required', 'array', 'min:1', 'max:50'],
            'rooms.*.room_id' => ['required', 'integer', 'distinct', Rule::exists(Room::class, 'id')],
            'rooms.*.room_rate_id' => ['required', 'integer'],
            'rooms.*.pax' => ['required', 'integer', 'min:1', 'max:1000'],
            'rooms.*.price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            // Everyone in the booking. The rooms together must have a place for each of them.
            'guests' => ['nullable', 'integer', 'min:1', 'max:1000'],

            'payment_amount' => ['nullable', 'numeric', 'decimal:0,2', 'min:0'],
            'payment_method' => ['nullable', Rule::in(Payment::METHODS)],
            'paid_by' => ['nullable', Rule::enum(BilledTo::class)],
            'receipt_number' => ['nullable', 'string', 'max:100'],

            // Walk-in: open the check-in form right after saving.
            'check_in_now' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'rooms.required' => __('Add at least one room.'),
            'rooms.*.room_id.distinct' => __('Each room can be added once.'),
            'starts_at.after_or_equal' => __('The arrival cannot be before today.'),
            'ends_at.after' => __('The departure must be after the arrival.'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'contact_name' => 'contact person',
            'guest_type' => 'guest type',
            'starts_at' => 'arrival',
            'ends_at' => 'departure',
            'rooms.*.room_rate_id' => 'rate',
            'rooms.*.pax' => 'guests',
            'rooms.*.price' => 'price',
            'payment_amount' => 'amount paid',
            'payment_method' => 'payment method',
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if ($this->paymentAmount() > 0 && ! $this->filled('payment_method')) {
                    $validator->errors()->add('payment_method', __('Choose how it was paid.'));
                }

                // The room checks need a valid list of rooms first.
                if ($validator->errors()->has('rooms*')) {
                    return;
                }

                if ($this->paymentAmount() > $this->total()) {
                    $validator->errors()->add('payment_amount', __('The payment cannot be more than the total.'));
                }

                $rooms = Room::query()->whereKey(array_column($this->roomLines(), 'room_id'))->get()->keyBy('id');

                // Refuse a booking that leaves guests without a room (the page suggests rooms to add).
                $placed = array_sum(array_column($this->roomLines(), 'pax'));

                if ($this->filled('guests') && $placed < $this->integer('guests')) {
                    $validator->errors()->add('rooms', trans_choice(
                        '{1} The rooms have places for :placed, but the booking is for :guests guests: 1 guest has no room. Add another room.|[2,*] The rooms have places for :placed, but the booking is for :guests guests: :count guests have no room. Add another room.',
                        $this->integer('guests') - $placed,
                        ['placed' => $placed, 'guests' => $this->integer('guests')],
                    ));
                }

                foreach ($this->roomLines() as $index => $line) {
                    $room = $rooms[$line['room_id']];

                    if ($line['pax'] > $room->pax_capacity) {
                        $validator->errors()->add("rooms.{$index}.pax", __(':room takes at most :count guests.', ['room' => $room->name, 'count' => $room->pax_capacity]));
                    }

                    $rateBelongs = RoomRate::query()
                        ->whereKey($line['room_rate_id'])
                        ->where('room_id', $room->id)
                        ->where('is_extension_rate', false)
                        ->exists();

                    if (! $rateBelongs) {
                        $validator->errors()->add("rooms.{$index}.room_rate_id", __('Choose one of :room’s rates.', ['room' => $room->name]));
                    }
                }
            },
        ];
    }

    /** Editing a reservation without changing its arrival time. */
    private function keepsArrival(): bool
    {
        $reservation = $this->route('reservation');

        return $reservation instanceof Reservation
            && $reservation->starts_at->format(self::DATE_FORMAT) === $this->input('starts_at');
    }

    /**
     * @return list<array{room_id: int, room_rate_id: int, pax: int, price: float}>
     */
    public function roomLines(): array
    {
        /** @var array<int, array<string, mixed>> $rooms */
        $rooms = $this->input('rooms', []);

        return array_values(array_map(fn (array $line) => [
            'room_id' => (int) $line['room_id'],
            'room_rate_id' => (int) $line['room_rate_id'],
            'pax' => (int) $line['pax'],
            'price' => round((float) $line['price'], 2),
        ], $rooms));
    }

    public function total(): float
    {
        return round(array_sum(array_column($this->roomLines(), 'price')), 2);
    }

    public function startsAt(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat(self::DATE_FORMAT, $this->string('starts_at')->toString())->startOfMinute();
    }

    public function endsAt(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat(self::DATE_FORMAT, $this->string('ends_at')->toString())->startOfMinute();
    }

    public function paymentAmount(): float
    {
        return round((float) $this->input('payment_amount', 0), 2);
    }
}

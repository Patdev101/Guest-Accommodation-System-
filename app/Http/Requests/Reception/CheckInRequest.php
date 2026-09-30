<?php

namespace App\Http\Requests\Reception;

use App\Concerns\ProfileValidationRules;
use App\Enums\VerificationResult;
use App\Models\IdType;
use App\Models\Reservation;
use App\Models\Room;
use Carbon\CarbonImmutable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Validator;

/**
 * The owner's check-in form: booking details, dates, guest list with rooms,
 * verification, and one valid ID with a photo (rules 6, 7 and 9).
 * A failed verification needs only the notes; nothing else is kept.
 */
class CheckInRequest extends FormRequest
{
    use ProfileValidationRules;

    /** Largest ID photo accepted, in kilobytes (phone photos are often 3–6 MB). */
    public const MAX_PHOTO_KB = 10240;

    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $unlessPassed = 'exclude_unless:verification,'.VerificationResult::Passed->value;

        return [
            'verification' => ['required', Rule::enum(VerificationResult::class)],
            'verification_notes' => ['nullable', 'string', 'max:1000', 'required_if:verification,'.VerificationResult::Failed->value],

            'contact_name' => [$unlessPassed, ...$this->nameRules()],
            'contact_number' => [$unlessPassed, ...$this->contactNumberRules()],
            'email' => [$unlessPassed, 'nullable', 'string', 'email', 'max:255'],
            'company' => [$unlessPassed, 'required', 'string', 'max:255'],
            'purpose' => [$unlessPassed, 'nullable', 'string', 'max:255'],
            'expected_check_out_at' => [$unlessPassed, 'required', 'date_format:'.StoreReservationRequest::DATE_FORMAT, 'after:now'],

            'guests' => [$unlessPassed, 'required', 'array', 'min:1', 'max:500'],
            'guests.*.name' => [$unlessPassed, 'required', 'string', 'max:255'],
            'guests.*.address' => [$unlessPassed, 'required', 'string', 'max:255'],
            'guests.*.contact_number' => [$unlessPassed, 'nullable', 'string', 'max:30', 'regex:/^[0-9+()\-\s]{7,30}$/'],
            'guests.*.room_id' => [$unlessPassed, 'required', 'integer', Rule::in($this->bookedRoomIds())],

            'id_type_id' => [$unlessPassed, 'required', 'integer', Rule::exists(IdType::class, 'id')->where('is_active', true)],
            'id_number' => [$unlessPassed, 'required', 'string', 'max:100'],
            'id_photo' => [$unlessPassed, 'required', 'image', 'mimes:jpg,jpeg,png,webp', 'max:'.self::MAX_PHOTO_KB],
            'id_collected' => [$unlessPassed, 'accepted'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'verification_notes.required_if' => __('Say why the verification failed.'),
            'expected_check_out_at.after' => __('The check-out must be later than now.'),
            'guests.required' => __('Add at least one guest.'),
            'guests.*.room_id.in' => __('Choose one of this booking’s rooms.'),
            'id_type_id.exists' => __('Choose one of the accepted ID types.'),
            'id_photo.required' => __('Take or upload a photo of the ID.'),
            'id_photo.max' => __('The photo must be 10 MB or smaller.'),
            'id_collected.accepted' => __('Confirm that you have the ID.'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'contact_name' => 'contact person',
            'expected_check_out_at' => 'check-out',
            'guests.*.name' => 'name',
            'guests.*.address' => 'address',
            'guests.*.contact_number' => 'contact number',
            'guests.*.room_id' => 'room',
            'id_type_id' => 'ID type',
            'id_number' => 'ID number',
            'id_photo' => 'ID photo',
        ];
    }

    /**
     * @return array<int, callable(Validator): void>
     */
    public function after(): array
    {
        return [
            function (Validator $validator) {
                if (! $this->passed() || $validator->errors()->has('guests*')) {
                    return;
                }

                $counts = array_count_values(array_map(fn (array $guest) => (int) $guest['room_id'], $this->guestList()));
                $rooms = Room::query()->whereKey(array_keys($counts))->get(['id', 'name', 'pax_capacity']);

                foreach ($rooms as $room) {
                    if ($counts[$room->id] > $room->pax_capacity) {
                        $validator->errors()->add('guests', __(':room takes at most :max guests; :count are assigned to it.', [
                            'room' => $room->name,
                            'max' => $room->pax_capacity,
                            'count' => $counts[$room->id],
                        ]));
                    }
                }
            },
        ];
    }

    public function passed(): bool
    {
        return $this->input('verification') === VerificationResult::Passed->value;
    }

    public function expectedCheckOut(): CarbonImmutable
    {
        return CarbonImmutable::createFromFormat(StoreReservationRequest::DATE_FORMAT, $this->string('expected_check_out_at')->toString())->startOfMinute();
    }

    /**
     * @return list<array{name: string, address: string, contact_number: string|null, room_id: int}>
     */
    public function guestList(): array
    {
        /** @var array<int, array<string, mixed>> $guests */
        $guests = $this->input('guests', []);

        return array_values(array_map(fn (array $guest) => [
            'name' => trim((string) $guest['name']),
            'address' => trim((string) $guest['address']),
            'contact_number' => filled($guest['contact_number'] ?? null) ? trim((string) $guest['contact_number']) : null,
            'room_id' => (int) $guest['room_id'],
        ], $guests));
    }

    /**
     * @return list<int>
     */
    private function bookedRoomIds(): array
    {
        $reservation = $this->route('reservation');

        return $reservation instanceof Reservation
            ? array_values($reservation->rooms()->pluck('room_id')->map(fn ($id) => (int) $id)->all())
            : [];
    }
}

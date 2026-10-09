<?php

namespace App\Services;

use App\Enums\ConsentStatus;
use App\Enums\ReminderType;
use App\Enums\ReservationStatus;
use App\Enums\Role;
use App\Enums\RoomStatus;
use App\Models\BookingRequest;
use App\Models\BookingRequestRoom;
use App\Models\Extension;
use App\Models\ExtensionMove;
use App\Models\Guest;
use App\Models\Reservation;
use App\Models\ReservationRoom;
use App\Models\Room;
use App\Models\Setting;
use App\Models\Stay;
use App\Models\StayRoom;
use App\Models\User;
use App\Notifications\FrontDeskAlert;
use App\Notifications\GuestNotice;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Str;
use Throwable;

/**
 * In-app alerts (rules 17, 18 and 27). Front-desk alerts go to reception;
 * the Admin gets only what is theirs to act on (rooms needing repair).
 * Timed alerts come from run(), every minute; the rest are sent when
 * something happens.
 */
class FrontDeskAlerts
{
    /** Minutes before arrival that reception is told a guest is coming. */
    public const ARRIVAL_NOTICE_MINUTES = 60;

    /**
     * Check for due alerts at most once a minute. Called by the scheduler and,
     * so alerts also work without a scheduler, when the bell asks for news.
     */
    public function runThrottled(): void
    {
        if (Cache::add('front-desk-alerts:ran', true, 55)) {
            $this->run();
        }
    }

    /** @return int How many alerts were sent. */
    public function run(): int
    {
        // Booking requests nobody answered in time let go of their rooms.
        app(BookingRequests::class)->expire();

        return $this->checkOutCalls() + $this->notArrived() + $this->arrivingSoon() + $this->roomClashes();
    }

    /** Rule 18: from the reminder time before check-out, call the guest. */
    private function checkOutCalls(): int
    {
        $now = CarbonImmutable::now();
        $sent = 0;

        $stays = Stay::query()
            ->with(['guest:id,name,contact_number', 'rooms.room:id,name'])
            ->whereNull('checked_out_at')
            ->whereNull('not_extending_confirmed_at')
            ->where('expected_check_out_at', '<=', $now->addMinutes((int) Setting::get('checkout_reminder_minutes')))
            ->where('expected_check_out_at', '>', $now->subHours(12))
            ->get();

        foreach ($stays as $stay) {
            $key = "checkout:{$stay->id}:{$stay->expected_check_out_at->timestamp}";

            $sent += (int) $this->once($key, function () use ($stay) {
                // Rule 21: every reminder is logged.
                $stay->reminderLogs()->create(['type' => ReminderType::InApp, 'sent_at' => now()]);

                $this->toDesk(new FrontDeskAlert(
                    'checkout_call',
                    __('Call :name before check-out', ['name' => $stay->guest->name]),
                    __(':rooms · leaves at :time. Ask if they are checking out or staying longer. Number: :number.', [
                        'rooms' => $this->roomNames($stay->rooms),
                        'time' => $stay->expected_check_out_at->format('g:i A'),
                        'number' => $stay->guest->contact_number,
                    ]),
                    route('reception.stays.show', $stay),
                ));

                // Rule 18: the guest gets the same reminder under their bell.
                GuestNotice::tell(
                    $this->accountOf($stay->guest_id),
                    __('Your check-out is coming up'),
                    __('Check-out is at :time. To stay longer, ask the front desk before then.', ['time' => $stay->expected_check_out_at->format('g:i A')]),
                );
            });
        }

        return $sent;
    }

    /** Rule 17: the grace period is over and the guests have not arrived. */
    private function notArrived(): int
    {
        $now = CarbonImmutable::now();
        $sent = 0;

        $reservations = Reservation::query()
            ->with(['guest:id,name', 'rooms.room:id,name'])
            ->where('status', ReservationStatus::Active)
            ->where('starts_at', '<=', $now->subMinutes((int) Setting::get('no_show_grace_minutes')))
            ->where('starts_at', '>', $now->subDays(2))
            ->get();

        foreach ($reservations as $reservation) {
            $sent += (int) $this->once("late:{$reservation->id}:{$reservation->starts_at->timestamp}", fn () => $this->toDesk(new FrontDeskAlert(
                'not_arrived',
                __(':name has not arrived', ['name' => $reservation->guest->name]),
                __('Expected at :time (:rooms). Mark it as a no-show to free the rooms, or keep waiting.', [
                    'time' => $reservation->starts_at->format('g:i A'),
                    'rooms' => $this->roomNames($reservation->rooms),
                ]),
                route('reception.reservations.show', $reservation),
            )));
        }

        return $sent;
    }

    /** Rule 27: upcoming check-in. */
    private function arrivingSoon(): int
    {
        $now = CarbonImmutable::now();
        $sent = 0;

        $reservations = Reservation::query()
            ->with(['guest:id,name', 'rooms.room:id,name'])
            ->where('status', ReservationStatus::Active)
            ->where('starts_at', '>', $now)
            ->where('starts_at', '<=', $now->addMinutes(self::ARRIVAL_NOTICE_MINUTES))
            ->get();

        foreach ($reservations as $reservation) {
            $sent += (int) $this->once("arriving:{$reservation->id}:{$reservation->starts_at->timestamp}", fn () => $this->toDesk(new FrontDeskAlert(
                'arriving',
                __(':name arrives at :time', ['name' => $reservation->guest->name, 'time' => $reservation->starts_at->format('g:i A')]),
                __(':rooms · :guests. Make sure the rooms are ready.', [
                    'rooms' => $this->roomNames($reservation->rooms),
                    'guests' => $this->guests((int) $reservation->rooms->sum('pax')),
                ]),
                route('reception.reservations.show', $reservation),
            )));
        }

        return $sent;
    }

    /**
     * A guest arrives within the hour (or is already due) and their room still
     * has the previous guest in it: reception must check out or move someone.
     */
    private function roomClashes(): int
    {
        $now = CarbonImmutable::now();
        $sent = 0;

        $reservations = Reservation::query()
            ->with(['guest:id,name', 'rooms'])
            ->where('status', ReservationStatus::Active)
            ->where('starts_at', '<=', $now->addMinutes(self::ARRIVAL_NOTICE_MINUTES))
            ->where('starts_at', '>', $now->subDays(2))
            ->get();

        foreach ($reservations as $reservation) {
            $occupied = StayRoom::query()
                ->whereIn('room_id', $reservation->rooms->pluck('room_id'))
                ->whereHas('stay', fn ($query) => $query->whereNull('checked_out_at'))
                ->with(['room:id,name', 'stay.guest:id,name'])
                ->get();

            if ($occupied->isEmpty()) {
                continue;
            }

            $sent += (int) $this->once("clash:{$reservation->id}:{$reservation->starts_at->timestamp}", fn () => $this->toDesk(new FrontDeskAlert(
                'room_clash',
                __(':rooms still occupied, next guest due', ['rooms' => $this->roomNames($occupied)]),
                __(':next arrives at :time, but :current has not checked out. Check them out, or give the new guest another room.', [
                    'next' => $reservation->guest->name,
                    'time' => $reservation->starts_at->format('g:i A'),
                    'current' => $occupied->map(fn (StayRoom $line) => $line->stay->guest->name)->unique()->implode(', '),
                ]),
                route('reception.reservations.show', $reservation),
            )));
        }

        return $sent;
    }

    /** Rule 27: a new booking. */
    public function booked(Reservation $reservation, ?User $by): void
    {
        $reservation->loadMissing(['guest:id,name', 'rooms.room:id,name']);

        $this->toDesk(new FrontDeskAlert(
            'booked',
            __('New booking: :name', ['name' => $reservation->guest->name]),
            __(':rooms · :guests · arrives :time.', [
                'rooms' => $this->roomNames($reservation->rooms),
                'guests' => $this->guests((int) $reservation->rooms->sum('pax')),
                'time' => $reservation->starts_at->format('j M g:i A'),
            ]),
            route('reception.reservations.show', $reservation),
        ), $by);
    }

    /** A guest sent a booking request online; Reception must approve or decline it. */
    public function requested(BookingRequest $request): void
    {
        $request->loadMissing('rooms.room:id,name');

        $this->toDesk(new FrontDeskAlert(
            'request',
            __('Booking request from :name', ['name' => $request->contact_name]),
            __(':rooms · :guests · :from to :to. Approve or decline it; the room is held until :until.', [
                'rooms' => $request->rooms->map(fn (BookingRequestRoom $line) => $line->room->name)->implode(', '),
                'guests' => $this->guests($request->guests),
                'from' => $request->starts_at->format('j M'),
                'to' => $request->ends_at->format('j M'),
                'until' => $request->hold_expires_at?->format('j M g:i A') ?? __('you answer'),
            ]),
            route('reception.requests.index'),
        ));
    }

    /** Rule 27: a booking's dates, rooms or contact were changed. */
    public function changed(Reservation $reservation, ?User $by): void
    {
        $reservation->load(['guest:id,name', 'rooms.room:id,name']);

        $this->toDesk(new FrontDeskAlert(
            'changed',
            __('Booking changed: :name', ['name' => $reservation->guest->name]),
            __('Now :rooms · :guests · arrives :time.', [
                'rooms' => $this->roomNames($reservation->rooms),
                'guests' => $this->guests((int) $reservation->rooms->sum('pax')),
                'time' => $reservation->starts_at->format('j M g:i A'),
            ]),
            route('reception.reservations.show', $reservation),
        ), $by);
    }

    /** Rule 27: a booking was cancelled or marked as a no-show; its rooms are free again. */
    public function cancelled(Reservation $reservation, bool $noShow, ?User $by): void
    {
        $reservation->loadMissing(['guest:id,name', 'rooms.room:id,name']);

        $this->toDesk(new FrontDeskAlert(
            'cancelled',
            $noShow
                ? __('No-show: :name', ['name' => $reservation->guest->name])
                : __('Booking cancelled: :name', ['name' => $reservation->guest->name]),
            __(':rooms :are free again from :time.', [
                'rooms' => $this->roomNames($reservation->rooms),
                'are' => $reservation->rooms->count() === 1 ? __('is') : __('are'),
                'time' => $reservation->starts_at->format('j M g:i A'),
            ]),
            route('reception.reservations.show', $reservation),
        ), $by);

        // The guest hears about it too, unless they cancelled it themselves.
        $account = $this->accountOf($reservation->guest_id);

        if ($account !== null && ! $account->is($by)) {
            GuestNotice::tell(
                $account,
                $noShow ? __('Your booking was marked as a no-show') : __('Your booking was cancelled'),
                $noShow
                    ? __(':rooms, :time. Nobody arrived, so the room was released.', ['rooms' => $this->roomNames($reservation->rooms), 'time' => $reservation->starts_at->format('j M g:i A')])
                    : __(':rooms, :time. Reason: :reason', ['rooms' => $this->roomNames($reservation->rooms), 'time' => $reservation->starts_at->format('j M g:i A'), 'reason' => (string) $reservation->cancellation_reason]),
                route('guest.reservations.show', $reservation),
            );
        }
    }

    /** A guest asked from their own screen to stay longer; Reception decides on the stay page. */
    public function guestAsksToExtend(Stay $stay, CarbonImmutable $until, ?string $message): void
    {
        $stay->loadMissing(['guest:id,name', 'rooms.room:id,name']);

        $this->toDesk(new FrontDeskAlert(
            'extension_waiting',
            __(':name asks to stay longer', ['name' => $stay->guest->name]),
            __(':rooms, until :time instead of :now.:message Open the stay to check the room and extend it.', [
                'rooms' => $this->roomNames($stay->rooms),
                'time' => $until->format('j M g:i A'),
                'now' => $stay->expected_check_out_at->format('j M g:i A'),
                'message' => filled($message) ? ' "'.$message.'"' : '',
            ]),
            route('reception.stays.show', [$stay, 'extend_to' => $until->format('Y-m-d\TH:i')]),
        ));
    }

    /** Rule 27: a room is ready again. */
    public function roomReady(Room $room, ?User $by): void
    {
        $next = ReservationRoom::query()
            ->where('room_id', $room->id)
            ->whereHas('reservation', fn ($query) => $query->where('status', ReservationStatus::Active)->where('ends_at', '>', now()))
            ->with('reservation.guest:id,name')
            ->get()
            ->sortBy(fn (ReservationRoom $line) => $line->reservation->starts_at->getTimestamp())
            ->first();

        $this->toDesk(new FrontDeskAlert(
            'room_ready',
            __(':room is ready', ['room' => $room->name]),
            $next === null
                ? __('Clean and free for the next guest.')
                : __('Next guest: :name, :time.', ['name' => $next->reservation->guest->name, 'time' => $next->reservation->starts_at->format('j M g:i A')]),
            route('reception.calendar'),
        ), $by);
    }

    /** Rule 20: an extension needs the next guest to agree to move first. */
    public function extensionWaiting(Stay $stay, Extension $extension, ?User $by): void
    {
        $stay->loadMissing(['guest:id,name', 'rooms.room:id,name']);
        $waiting = $extension->moves()
            ->where('consent_status', ConsentStatus::Pending)
            ->with(['reservationRoom.reservation.guest:id,name,contact_number', 'toRoom:id,name'])
            ->get();

        $this->toDesk(new FrontDeskAlert(
            'extension_waiting',
            __('Call :names about a room move', [
                'names' => $waiting->map(fn (ExtensionMove $move) => $move->reservationRoom->reservation->guest->name)->unique()->implode(', '),
            ]),
            __(':name wants to stay until :time. Ask the next guest to move (:moves), then record the answer.', [
                'name' => $stay->guest->name,
                'time' => $extension->new_check_out_at->format('j M g:i A'),
                'moves' => $waiting->map(fn (ExtensionMove $move) => $move->toRoom
                    ? "{$move->reservationRoom->reservation->guest->contact_number}, to {$move->toRoom->name}"
                    : $move->reservationRoom->reservation->guest->contact_number)->implode('; '),
            ]),
            route('reception.stays.show', $stay),
        ), $by);
    }

    /** Rule 27: an extension was approved or denied. */
    public function extensionDecided(Stay $stay, bool $approved, ?string $reason, ?User $by): void
    {
        $stay->loadMissing('guest:id,name');

        $this->toDesk(new FrontDeskAlert(
            'extension',
            $approved
                ? __('Extension approved: :name', ['name' => $stay->guest->name])
                : __('Extension denied: :name', ['name' => $stay->guest->name]),
            $approved
                ? __('Now leaves :time.', ['time' => $stay->expected_check_out_at->format('j M g:i A')])
                : (string) $reason,
            route('reception.stays.show', $stay),
        ), $by);

        GuestNotice::tell(
            $this->accountOf($stay->guest_id),
            $approved ? __('Your stay was extended') : __('Your stay could not be extended'),
            $approved
                ? __('Your new check-out is :time.', ['time' => $stay->expected_check_out_at->format('j M g:i A')])
                : (string) $reason,
        );
    }

    /** The guest account behind a booking, when it has one. */
    private function accountOf(int $guestId): ?User
    {
        $userId = Guest::query()->whereKey($guestId)->value('user_id');

        return $userId === null ? null : User::query()->whereKey($userId)->first();
    }

    /** For the Admin: a room was sent for repair or taken out of service. */
    public function roomOutOfUse(Room $room, RoomStatus $status, ?string $issue, ?User $by): void
    {
        $this->toAdmins(new FrontDeskAlert(
            'repair',
            $status === RoomStatus::OutOfService
                ? __(':room is out of service', ['room' => $room->name])
                : __(':room needs repair', ['room' => $room->name]),
            $issue !== null && $issue !== ''
                ? __(':issue (reported by :by)', ['issue' => $issue, 'by' => $by->name ?? __('the system')])
                : __('Reported by :by.', ['by' => $by->name ?? __('the system')]),
            route('admin.rooms.show', $room),
        ), $by);
    }

    /**
     * Who works the front desk: active reception accounts, or the admins when
     * there is no reception account (a small setup where the Admin does it all).
     *
     * @return Collection<int, User>
     */
    private function desk(): Collection
    {
        $reception = User::query()->active()->where('role', Role::Reception)->get();

        return $reception->isNotEmpty()
            ? $reception
            : User::query()->active()->where('role', Role::Admin)->get();
    }

    private function toDesk(FrontDeskAlert $alert, ?User $by = null): void
    {
        $this->deliver($this->desk(), $alert, $by);
    }

    private function toAdmins(FrontDeskAlert $alert, ?User $by = null): void
    {
        $this->deliver(User::query()->active()->where('role', Role::Admin)->get(), $alert, $by);
    }

    /**
     * Send to everyone in the group. Whoever caused it gets it too, already
     * read: it stays in their list without popping up for something they did.
     *
     * @param  Collection<int, User>  $users
     */
    private function deliver(Collection $users, FrontDeskAlert $alert, ?User $by): void
    {
        $others = $by === null ? $users : $users->reject(fn (User $user) => $user->is($by));

        Notification::send($others, $alert);

        // Urgent alerts also go by email when the Admin switched that on, so they
        // reach reception even when nobody has the app open. A mail problem must
        // never stop the front desk's work.
        if ($alert->isUrgent() && Setting::get('alert_emails') === '1') {
            try {
                Notification::send($others, $alert->byMail());
            } catch (Throwable $exception) {
                report($exception);
            }
        }

        if ($by !== null && $others->count() < $users->count()) {
            $copy = clone $alert;
            $copy->id = (string) Str::uuid();
            $by->notifyNow($copy);
            DatabaseNotification::query()->whereKey($copy->id)->update(['read_at' => now()]);
        }
    }

    /** Send once per key, even if two checks run at the same moment. */
    private function once(string $key, callable $send): bool
    {
        try {
            DB::table('sent_alerts')->insert(['key' => $key, 'created_at' => now()]);
        } catch (UniqueConstraintViolationException) {
            return false;
        }

        $send();

        return true;
    }

    private function guests(int $count): string
    {
        return trans_choice('{1} 1 guest|[2,*] :count guests', $count);
    }

    /**
     * @param  Collection<int, covariant ReservationRoom|StayRoom>  $lines
     */
    private function roomNames(Collection $lines): string
    {
        return $lines->map(fn (ReservationRoom|StayRoom $line) => $line->room->name)->implode(', ');
    }
}

<?php

namespace App\Models;

use App\Enums\GuestType;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

#[Fillable(['user_id', 'name', 'type', 'company', 'contact_number'])]
class Guest extends Model
{
    protected function casts(): array
    {
        return ['type' => GuestType::class];
    }

    /** @return BelongsTo<User, $this> */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /** @return HasMany<Reservation, $this> */
    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }

    /** @return HasMany<Stay, $this> */
    public function stays(): HasMany
    {
        return $this->hasMany(Stay::class);
    }

    /** @return HasMany<VerificationAttempt, $this> */
    public function verificationAttempts(): HasMany
    {
        return $this->hasMany(VerificationAttempt::class);
    }
}

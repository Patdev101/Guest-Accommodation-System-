<?php

namespace App\Models;

use App\Enums\VerificationResult;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasOne;

#[Fillable(['guest_id', 'result', 'notes', 'verified_by', 'attempted_at'])]
class VerificationAttempt extends Model
{
    protected function casts(): array
    {
        return [
            'result' => VerificationResult::class,
            'attempted_at' => 'datetime',
        ];
    }

    /** @return BelongsTo<Guest, $this> */
    public function guest(): BelongsTo
    {
        return $this->belongsTo(Guest::class);
    }

    /** @return BelongsTo<User, $this> */
    public function verifier(): BelongsTo
    {
        return $this->belongsTo(User::class, 'verified_by');
    }

    /** @return HasOne<Stay, $this> */
    public function stay(): HasOne
    {
        return $this->hasOne(Stay::class);
    }
}

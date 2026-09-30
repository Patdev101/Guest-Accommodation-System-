<?php

namespace App\Models;

use App\Concerns\LogsActivity;
use App\Enums\Role;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;
use Illuminate\Support\Carbon;

/**
 * @property int $id
 * @property string $name
 * @property string $email
 * @property Role $role
 * @property string|null $contact_number
 * @property Carbon|null $email_verified_at
 * @property string $password
 * @property string|null $remember_token
 * @property Carbon|null $deactivated_at
 * @property Carbon|null $created_at
 * @property Carbon|null $updated_at
 */
#[Fillable(['name', 'email', 'password', 'role', 'contact_number', 'deactivated_at'])]
#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, LogsActivity, Notifiable;

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'password' => 'hashed',
            'role' => Role::class,
            'deactivated_at' => 'datetime',
        ];
    }

    /**
     * The guest profile used for this account's reservations and stays.
     *
     * @return HasOne<Guest, $this>
     */
    public function guest(): HasOne
    {
        return $this->hasOne(Guest::class);
    }

    public function hasRole(Role ...$roles): bool
    {
        return in_array($this->role, $roles, true);
    }

    public function isAdmin(): bool
    {
        return $this->role === Role::Admin;
    }

    public function isStaff(): bool
    {
        return $this->hasRole(Role::Reception, Role::Admin);
    }

    public function isActive(): bool
    {
        return $this->deactivated_at === null;
    }

    /**
     * True when this is the only active Admin, who must never be removed,
     * demoted or deactivated (otherwise nobody could manage the system).
     */
    public function isLastActiveAdmin(): bool
    {
        return $this->isAdmin()
            && $this->isActive()
            && static::query()->where('role', Role::Admin)->active()->count() === 1;
    }

    /** @param  Builder<User>  $query */
    public function scopeActive(Builder $query): void
    {
        $query->whereNull('deactivated_at');
    }

    public function activityLabel(): string
    {
        return "account {$this->name} ({$this->email})";
    }

    /**
     * @param  array<string, array{0: mixed, 1: mixed}>  $changes
     */
    protected function activityUpdateDescription(array $changes): string
    {
        return match (true) {
            array_keys($changes) === ['role'] => "Changed role of {$this->name} to {$this->role->label()}",
            array_keys($changes) === ['deactivated_at'] => ($this->isActive() ? 'Reactivated ' : 'Deactivated ').$this->activityLabel(),
            array_keys($changes) === ['password'] => "Changed the password of {$this->name}",
            default => 'Updated '.$this->activityLabel(),
        };
    }
}

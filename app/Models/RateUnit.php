<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Model;

#[Fillable(['name'])]
class RateUnit extends Model
{
    /** Units the system starts with; the Admin can add more. */
    public const DEFAULTS = ['Per hour', 'Overnight', 'Day tour'];
}

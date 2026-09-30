<?php

namespace App\Http\Requests\Admin;

use App\Enums\NoShowRefund;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SettingsRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'cleaning_buffer_minutes' => ['required', 'integer', 'min:0', 'max:1440'],
            'no_show_grace_minutes' => ['required', 'integer', 'min:0', 'max:1440'],
            'checkout_reminder_minutes' => ['required', 'integer', 'min:5', 'max:1440'],
            'standard_check_in_time' => ['required', 'date_format:H:i'],
            'standard_check_out_time' => ['required', 'date_format:H:i'],
            'no_show_refund' => ['required', Rule::enum(NoShowRefund::class)],
            // Only a partial refund uses the percentage; for full or none it is
            // ignored (the controller stores 100 or 0).
            'no_show_refund_percent' => [
                'exclude_unless:no_show_refund,'.NoShowRefund::Partial->value,
                'required', 'integer', 'min:1', 'max:99',
            ],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'cleaning_buffer_minutes' => 'cleaning buffer',
            'no_show_grace_minutes' => 'no-show grace period',
            'checkout_reminder_minutes' => 'check-out reminder',
            'standard_check_in_time' => 'standard check-in time',
            'standard_check_out_time' => 'standard check-out time',
            'no_show_refund' => 'no-show refund',
            'no_show_refund_percent' => 'refund percentage',
        ];
    }
}

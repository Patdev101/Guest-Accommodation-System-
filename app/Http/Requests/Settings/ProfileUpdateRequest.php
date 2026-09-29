<?php

namespace App\Http\Requests\Settings;

use App\Concerns\ProfileValidationRules;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class ProfileUpdateRequest extends FormRequest
{
    use ProfileValidationRules;

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $contactNumberRules = $this->contactNumberRules();

        if ($this->user()->isStaff()) {
            $contactNumberRules[0] = 'nullable';
        }

        return [
            ...$this->profileRules($this->user()->id),
            'contact_number' => $contactNumberRules,
        ];
    }
}

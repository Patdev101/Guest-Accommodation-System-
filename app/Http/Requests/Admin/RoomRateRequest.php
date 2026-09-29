<?php

namespace App\Http\Requests\Admin;

use App\Models\RateUnit;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class RoomRateRequest extends FormRequest
{
    /**
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'name' => ['required', 'string', 'max:100'],
            'rate_unit_id' => ['required', 'integer', Rule::exists(RateUnit::class, 'id')],
            'price' => ['required', 'numeric', 'decimal:0,2', 'min:0', 'max:9999999999.99'],
            'is_extension_rate' => ['nullable', 'boolean'],
        ];
    }

    /**
     * @return array{name: string, rate_unit_id: int, price: string, is_extension_rate: bool}
     */
    public function rate(): array
    {
        return [
            'name' => $this->string('name')->toString(),
            'rate_unit_id' => $this->integer('rate_unit_id'),
            'price' => $this->string('price')->toString(),
            'is_extension_rate' => $this->boolean('is_extension_rate'),
        ];
    }

    /**
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'rate_unit_id' => 'unit',
        ];
    }
}

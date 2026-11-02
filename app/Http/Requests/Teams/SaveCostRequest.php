<?php

namespace App\Http\Requests\Teams;

use App\Enums\CostCategory;
use App\Enums\CostInterval;
use App\Models\Team;
use App\Services\CostService;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class SaveCostRequest extends FormRequest
{
    /**
     * Determine if the user is authorized to make this request.
     */
    public function authorize(): bool
    {
        return true;
    }

    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        /** @var Team $team */
        $team = $this->route('team');

        return [
            'name' => ['required', 'string', 'max:120'],
            'category' => ['required', Rule::enum(CostCategory::class)],
            'server_id' => [
                'nullable',
                'integer',
                Rule::exists('servers', 'id')->where('team_id', $team->id),
            ],
            'amount' => ['required', 'numeric', 'gt:0', 'max:1000000', 'decimal:0,2'],
            'currency' => ['required', Rule::in(app(CostService::class)->currencies())],
            'interval' => ['required', Rule::enum(CostInterval::class)],
        ];
    }

    /**
     * Get custom attributes for validator errors.
     *
     * @return array<string, string>
     */
    public function attributes(): array
    {
        return [
            'server_id' => 'server',
        ];
    }

    /**
     * The validated input as cost attributes, the amount in cents.
     *
     * @return array<string, mixed>
     */
    public function costAttributes(): array
    {
        $validated = $this->validated();

        return [
            'name' => $validated['name'],
            'category' => $validated['category'],
            'server_id' => $validated['server_id'] ?? null,
            'amount_cents' => (int) round((float) $validated['amount'] * 100),
            'currency' => $validated['currency'],
            'interval' => $validated['interval'],
        ];
    }
}

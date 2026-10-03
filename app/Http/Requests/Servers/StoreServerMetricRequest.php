<?php

namespace App\Http\Requests\Servers;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

/**
 * One sample posted by the LaraOwl agent (`/agent.sh`). Sizes are bytes.
 */
class StoreServerMetricRequest extends FormRequest
{
    /**
     * The agent is authenticated by the server token middleware.
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
        return [
            'hostname' => ['nullable', 'string', 'max:255'],
            'os' => ['nullable', 'string', 'max:255'],
            'cpu_count' => ['nullable', 'integer', 'min:1', 'max:4096'],
            'cpu_percent' => ['required', 'numeric', 'min:0', 'max:100'],
            'load' => ['required', 'array', 'size:3'],
            'load.*' => ['required', 'numeric', 'min:0'],
            'memory' => ['required', 'array'],
            'memory.total' => ['required', 'integer', 'min:1'],
            'memory.available' => ['required', 'integer', 'min:0'],
            'swap' => ['nullable', 'array'],
            'swap.total' => ['nullable', 'integer', 'min:0'],
            'swap.free' => ['nullable', 'integer', 'min:0'],
            'disks' => ['required', 'array', 'min:1', 'max:50'],
            'disks.*.mount' => ['required', 'string', 'max:255'],
            'disks.*.total' => ['required', 'integer', 'min:0'],
            'disks.*.used' => ['required', 'integer', 'min:0'],
            'uptime' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}

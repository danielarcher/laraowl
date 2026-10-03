<?php

namespace App\Models;

use Database\Factories\ServerMetricFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Prunable;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One agent sample of a server's resources. Sizes are bytes.
 */
class ServerMetric extends Model
{
    /** @use HasFactory<ServerMetricFactory> */
    use HasFactory, Prunable;

    public $timestamps = false;

    protected $fillable = [
        'server_id',
        'recorded_at',
        'recorded_ts',
        'cpu_percent',
        'load_1',
        'load_5',
        'load_15',
        'memory_total',
        'memory_used',
        'swap_total',
        'swap_used',
        'disk_total',
        'disk_used',
        'disks',
        'uptime_seconds',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'recorded_at' => 'datetime',
            'recorded_ts' => 'integer',
            'cpu_percent' => 'float',
            'load_1' => 'float',
            'load_5' => 'float',
            'load_15' => 'float',
            'memory_total' => 'integer',
            'memory_used' => 'integer',
            'swap_total' => 'integer',
            'swap_used' => 'integer',
            'disk_total' => 'integer',
            'disk_used' => 'integer',
            'disks' => 'array',
            'uptime_seconds' => 'integer',
        ];
    }

    /**
     * @return BelongsTo<Server, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }

    /**
     * Samples older than the configured retention window.
     *
     * @return Builder<static>
     */
    public function prunable(): Builder
    {
        return static::query()->where(
            'recorded_ts',
            '<',
            now()->subDays((int) config('laraowl.servers.retention_days'))->getTimestamp(),
        );
    }
}

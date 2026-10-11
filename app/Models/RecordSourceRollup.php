<?php

namespace App\Models;

use App\Concerns\PrunesByRollupRetention;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\MassPrunable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A request rollup for one traffic source (see TrafficSource).
 */
class RecordSourceRollup extends Model
{
    use MassPrunable, PrunesByRollupRetention;

    public $timestamps = false;

    protected $guarded = [];

    protected $casts = [
        'bucket' => 'datetime',
    ];

    public function project(): BelongsTo
    {
        return $this->belongsTo(Project::class);
    }

    public function prunable(): Builder
    {
        return $this->prunableByRollupRetention();
    }

    /**
     * Limit the query to the buckets covered by the requested period.
     */
    public function scopeForPeriod(Builder $query, ?string $period, ?string $from = null, ?string $to = null): Builder
    {
        if ($period === 'custom' && $from && $to) {
            return $query->whereBetween('bucket', [$from, $to]);
        }

        return $query->where('bucket', '>=', Record::periodStartsAt($period)->startOfMinute());
    }
}

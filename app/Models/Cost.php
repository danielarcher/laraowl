<?php

namespace App\Models;

use App\Enums\CostCategory;
use App\Enums\CostInterval;
use Database\Factories\CostFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * Something the team pays for on a schedule: a server, a plan, a service or
 * a domain. Server costs are tied to their server so its apps can share them.
 */
class Cost extends Model
{
    /** @use HasFactory<CostFactory> */
    use HasFactory;

    protected $fillable = [
        'team_id',
        'server_id',
        'name',
        'category',
        'amount_cents',
        'currency',
        'interval',
        'renews_on',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'category' => CostCategory::class,
            'interval' => CostInterval::class,
            'amount_cents' => 'integer',
            'renews_on' => 'date',
        ];
    }

    /**
     * @return BelongsTo<Team, $this>
     */
    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    /**
     * @return BelongsTo<Server, $this>
     */
    public function server(): BelongsTo
    {
        return $this->belongsTo(Server::class);
    }
}

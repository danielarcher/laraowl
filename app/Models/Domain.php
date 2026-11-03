<?php

namespace App\Models;

use Database\Factories\DomainFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A domain the team's apps live on, with what the last scan found:
 * DNS, certificates, mail records and registration.
 */
#[UseFactory(DomainFactory::class)]
class Domain extends Model
{
    /** @use HasFactory<DomainFactory> */
    use HasFactory;

    protected $fillable = [
        'team_id',
        'name',
        'kind',
        'hosts',
        'nameservers',
        'dns_provider',
        'email',
        'http_status',
        'redirects_to',
        'registrar',
        'registered_at',
        'expires_at',
        'rdap_status',
        'rdap_checked_at',
        'scanned_at',
    ];

    protected function casts(): array
    {
        return [
            'hosts' => 'array',
            'nameservers' => 'array',
            'email' => 'array',
            'registered_at' => 'datetime',
            'expires_at' => 'datetime',
            'rdap_checked_at' => 'datetime',
            'scanned_at' => 'datetime',
        ];
    }

    public function team(): BelongsTo
    {
        return $this->belongsTo(Team::class);
    }

    public function isPlatform(): bool
    {
        return $this->kind === 'platform';
    }
}

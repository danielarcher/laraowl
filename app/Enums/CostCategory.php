<?php

namespace App\Enums;

enum CostCategory: string
{
    case Server = 'server';
    case Plan = 'plan';
    case Service = 'service';
    case Domain = 'domain';

    /**
     * Get the display label for the category.
     */
    public function label(): string
    {
        return match ($this) {
            self::Server => 'Servers',
            self::Plan => 'Plans',
            self::Service => 'Services',
            self::Domain => 'Domains',
        };
    }
}

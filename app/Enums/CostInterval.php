<?php

namespace App\Enums;

enum CostInterval: string
{
    case Monthly = 'monthly';
    case Yearly = 'yearly';

    /**
     * How many months one charge covers.
     */
    public function months(): int
    {
        return match ($this) {
            self::Monthly => 1,
            self::Yearly => 12,
        };
    }
}

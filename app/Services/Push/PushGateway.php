<?php

namespace App\Services\Push;

use App\Models\PushSubscription;

/**
 * Hands encrypted messages to the browsers' push services.
 */
interface PushGateway
{
    /**
     * @param  iterable<PushSubscription>  $subscriptions
     * @return array<int, PushOutcome> Keyed by subscription id.
     */
    public function deliver(iterable $subscriptions, string $payload, ?string $topic = null): array;
}

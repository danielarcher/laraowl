<?php

namespace Tests\Fakes;

use App\Services\Push\PushGateway;
use App\Services\Push\PushOutcome;

/**
 * Records what would have gone to the push services; answers per endpoint.
 */
class FakePushGateway implements PushGateway
{
    /** @var array<int, array{endpoint: string, payload: array<string, mixed>, topic: ?string}> */
    public array $sent = [];

    /** @var array<string, PushOutcome> */
    public array $outcomes = [];

    public function deliver(iterable $subscriptions, string $payload, ?string $topic = null): array
    {
        $result = [];

        foreach ($subscriptions as $subscription) {
            $outcome = $this->outcomes[$subscription->endpoint] ?? PushOutcome::Sent;
            $result[$subscription->id] = $outcome;

            if ($outcome === PushOutcome::Sent) {
                $this->sent[] = [
                    'endpoint' => $subscription->endpoint,
                    'payload' => json_decode($payload, true),
                    'topic' => $topic,
                ];
            }
        }

        return $result;
    }
}

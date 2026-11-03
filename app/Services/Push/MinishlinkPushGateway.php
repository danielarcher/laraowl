<?php

namespace App\Services\Push;

use GuzzleHttp\Client;
use Illuminate\Support\Facades\Log;
use Minishlink\WebPush\Subscription;
use Minishlink\WebPush\WebPush;
use Psr\Http\Client\ClientInterface;

class MinishlinkPushGateway implements PushGateway
{
    public function __construct(protected ?ClientInterface $client = null) {}

    public function deliver(iterable $subscriptions, string $payload, ?string $topic = null): array
    {
        $webPush = new WebPush([
            'VAPID' => [
                'subject' => config('webpush.subject'),
                'publicKey' => config('webpush.public_key'),
                'privateKey' => config('webpush.private_key'),
            ],
        ], [
            'TTL' => config('webpush.ttl'),
            'urgency' => 'high',
            'topic' => $topic,
        ], $this->client ?? new Client(['timeout' => 10, 'connect_timeout' => 5]));

        $byEndpoint = [];

        foreach ($subscriptions as $subscription) {
            $byEndpoint[$subscription->endpoint] = $subscription->id;

            $webPush->queueNotification(Subscription::create([
                'endpoint' => $subscription->endpoint,
                'publicKey' => $subscription->public_key,
                'authToken' => $subscription->auth_token,
                'contentEncoding' => $subscription->content_encoding,
            ]), $payload);
        }

        $outcomes = [];

        foreach ($webPush->flush() as $report) {
            $id = $byEndpoint[$report->getEndpoint()] ?? null;

            if ($id === null) {
                continue;
            }

            if ($report->isSuccess()) {
                $outcomes[$id] = PushOutcome::Sent;
            } elseif ($report->isSubscriptionExpired()) {
                $outcomes[$id] = PushOutcome::Expired;
            } else {
                Log::warning('Web push failed: '.$report->getReason());
                $outcomes[$id] = PushOutcome::Failed;
            }
        }

        return $outcomes;
    }
}

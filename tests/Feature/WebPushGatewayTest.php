<?php

use App\Models\PushSubscription;
use App\Models\User;
use App\Services\Push\MinishlinkPushGateway;
use App\Services\Push\PushOutcome;
use GuzzleHttp\Client;
use GuzzleHttp\Handler\MockHandler;
use GuzzleHttp\HandlerStack;
use GuzzleHttp\Middleware;
use GuzzleHttp\Psr7\Response;

it('encrypts, signs and reads each push service\'s answer', function () {
    config([
        'webpush.public_key' => 'BI59XgxWF4mFcuDV34qBsQoE5pQtcWwaYCKg0dKZAiM6OTt00M2nFhd527Jt-ixGyTGeo9nZw0n3uEkQjpqkOoQ',
        'webpush.private_key' => '0hXTT47anxvG2PEbvHY9tRt1ovh0s92SMjATf_bo868',
        'webpush.subject' => 'https://laraowl.example.test',
    ]);

    $requests = [];
    $stack = HandlerStack::create(new MockHandler([
        new Response(201),
        new Response(410),
        new Response(500),
    ]));
    $stack->push(Middleware::history($requests));

    $subscriptions = collect(['https://push.test/ok', 'https://push.test/gone', 'https://push.test/broken'])
        ->map(fn ($endpoint, $i) => PushSubscription::factory()->for(User::factory())->create([
            'endpoint' => $endpoint,
            'endpoint_hash' => PushSubscription::hashEndpoint($endpoint),
        ]));

    $outcomes = (new MinishlinkPushGateway(new Client(['handler' => $stack])))
        ->deliver($subscriptions, json_encode(['title' => 'Down']), 'abc123');

    expect($outcomes)->toBe([
        $subscriptions[0]->id => PushOutcome::Sent,
        $subscriptions[1]->id => PushOutcome::Expired,
        $subscriptions[2]->id => PushOutcome::Failed,
    ]);

    $request = $requests[0]['request'];
    expect($request->getHeaderLine('Content-Encoding'))->toBe('aes128gcm')
        ->and($request->getHeaderLine('Topic'))->toBe('abc123')
        ->and($request->getHeaderLine('Urgency'))->toBe('high')
        ->and($request->getHeaderLine('Authorization'))->toStartWith('vapid t=')
        ->and((string) $request->getBody())->not->toContain('Down');
});

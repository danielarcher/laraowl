<?php

namespace App\Services\Push;

use App\Models\PushSubscription;
use App\Models\Team;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Str;
use RuntimeException;

/**
 * Sends LaraOwl's alerts to the devices people switched push on for.
 */
class WebPushService
{
    public function __construct(protected PushGateway $gateway) {}

    public function configured(): bool
    {
        return filled(config('webpush.public_key')) && filled(config('webpush.private_key'));
    }

    /**
     * Turn an alert (as the integrations receive it) into a notification.
     *
     * @param  array<string, scalar|null>  $fields
     * @return array{title: string, body: string, url: string, tag: string}
     */
    public function message(string $title, string $message, array $fields = [], ?string $url = null): array
    {
        $title = $this->plain($title);
        $app = isset($fields['Project']) ? (string) $fields['Project'] : null;
        $line = Str::of($this->plain($message))->explode("\n")->map(fn ($l) => trim($l))->filter()->first() ?? '';

        return [
            'title' => Str::limit($title, 90, '…'),
            'body' => Str::limit(collect([$app, $line])->filter()->implode(' · '), 180, '…'),
            'url' => $url ?: url('/dashboard'),
            // Repeats of the same alert replace each other in the tray.
            'tag' => substr(sha1(($app ?? '').'|'.$title), 0, 16),
        ];
    }

    /**
     * Push an alert to every device of every member of the team.
     *
     * @param  array<string, scalar|null>  $fields
     */
    public function sendToTeam(Team $team, string $title, string $message, array $fields = [], ?string $url = null): int
    {
        $subscriptions = PushSubscription::query()
            ->whereIn('user_id', $team->members()->select('users.id'))
            ->get();

        return $this->deliver($subscriptions, $this->message($title, $message, $fields, $url));
    }

    /**
     * @param  array<string, scalar|null>  $fields
     */
    public function sendToUser(User $user, string $title, string $message, array $fields = [], ?string $url = null): int
    {
        return $this->deliver(
            PushSubscription::where('user_id', $user->id)->get(),
            $this->message($title, $message, $fields, $url),
        );
    }

    /**
     * @param  Collection<int, PushSubscription>  $subscriptions
     * @param  array{title: string, body: string, url: string, tag: string}  $notification
     * @return int How many devices took the message.
     */
    public function deliver(Collection $subscriptions, array $notification): int
    {
        if (! $this->configured()) {
            throw new RuntimeException('Push is not set up on this LaraOwl: VAPID keys are missing.');
        }

        if ($subscriptions->isEmpty()) {
            throw new RuntimeException('No device has push switched on yet.');
        }

        $payload = json_encode([...$notification, 'at' => now()->getTimestampMs()], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
        $outcomes = $this->gateway->deliver($subscriptions, $payload, $notification['tag']);

        $sent = array_keys(array_filter($outcomes, fn ($o) => $o === PushOutcome::Sent));
        $expired = array_keys(array_filter($outcomes, fn ($o) => $o === PushOutcome::Expired));

        if ($sent) {
            PushSubscription::whereKey($sent)->update(['last_used_at' => now()]);
        }

        if ($expired) {
            PushSubscription::whereKey($expired)->delete();
        }

        if (! $sent) {
            throw new RuntimeException($expired && count($expired) === $subscriptions->count()
                ? 'Every device had switched push off; they were removed.'
                : 'No device accepted the push message.');
        }

        return count($sent);
    }

    /**
     * Drop the emoji and Markdown the chat integrations use.
     */
    protected function plain(string $text): string
    {
        $text = preg_replace('/[\x{1F000}-\x{1FAFF}\x{2600}-\x{27BF}\x{FE0F}\x{200D}]/u', '', $text) ?? $text;
        $text = str_replace(['*', '`'], '', $text);

        return trim(preg_replace('/[ \t]+/', ' ', $text) ?? $text);
    }
}

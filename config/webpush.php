<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Web Push (VAPID)
    |--------------------------------------------------------------------------
    |
    | Keys that sign the push messages sent to installed LaraOwl apps.
    | Generate a pair with `php artisan laraowl:push:vapid`. Without
    | them the app still installs, but push stays switched off.
    |
    */

    'public_key' => env('VAPID_PUBLIC_KEY'),

    'private_key' => env('VAPID_PRIVATE_KEY'),

    'subject' => env('VAPID_SUBJECT', env('APP_URL')),

    // Seconds a push service keeps a message for a device that is offline.
    'ttl' => (int) env('WEBPUSH_TTL', 3600),

];

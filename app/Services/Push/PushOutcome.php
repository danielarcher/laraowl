<?php

namespace App\Services\Push;

enum PushOutcome: string
{
    case Sent = 'sent';

    // The browser dropped the subscription (404/410): forget the device.
    case Expired = 'expired';

    case Failed = 'failed';
}

<?php

namespace Tests;

/**
 * Browser tests drive the real, built front end, so Vite stays on.
 */
abstract class BrowserTestCase extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        $this->withVite();
    }
}

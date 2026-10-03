<?php

namespace App\Providers;

use App\Services\ArrayIngestBuffer;
use App\Services\IngestBuffer;
use App\Services\RedisIngestBuffer;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Date;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        $this->app->singleton(IngestBuffer::class, fn ($app): IngestBuffer => match (config('laraowl.ingest.buffer')) {
            'array' => new ArrayIngestBuffer(config('laraowl.ingest.max_failed')),
            default => new RedisIngestBuffer(
                $app['redis']->connection(config('laraowl.ingest.redis_connection')),
                config('laraowl.ingest.max_failed'),
            ),
        });
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        $this->configureDefaults();
    }

    /**
     * Configure default behaviors for production-ready applications.
     */
    protected function configureDefaults(): void
    {
        Date::use(CarbonImmutable::class);

        DB::prohibitDestructiveCommands(
            app()->isProduction(),
        );

        Password::defaults(fn (): ?Password => app()->isProduction()
            ? Password::min(12)
                ->mixedCase()
                ->letters()
                ->numbers()
                ->symbols()
                ->uncompromised()
            : null,
        );
    }
}

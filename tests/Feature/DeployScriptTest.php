<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

/*
 * Runs the server half of deploy.sh in a throwaway Forge layout. php,
 * composer, npm and sudo are stubs that log how they were called; the php
 * stub "generates" Wayfinder's route types from routes/web.php and the npm
 * stub "builds" by writing a manifest, so the build cache can be followed.
 */
beforeEach(function () {
    $this->root = sys_get_temp_dir().'/laraowl-deploy-'.bin2hex(random_bytes(4));
    $this->stubs = "{$this->root}/stubs";
    $this->log = "{$this->root}/calls.log";
    $this->cache = "{$this->root}/.deploy-cache";

    $stubs = [
        'php' => <<<'SH'
            if [ "$2" = wayfinder:generate ]; then mkdir -p resources/js/routes && cp routes/web.php resources/js/routes/index.ts; fi
            SH,
        'composer' => '',
        'npm' => <<<'SH'
            case "$1" in
                ci) mkdir -p node_modules/.bin ;;
                run) [ -e "$FAIL_BUILD" ] && exit 1; mkdir -p public/build/assets && echo "{\"build\": $(date +%s%N)}" > public/build/manifest.json ;;
            esac
            SH,
        'sudo' => '',
    ];
    File::makeDirectory($this->stubs, 0755, true);
    foreach ($stubs as $bin => $body) {
        File::put("{$this->stubs}/{$bin}", "#!/usr/bin/env bash\necho \"{$bin} \$*\" >> '{$this->log}'\n{$body}\n");
        chmod("{$this->stubs}/{$bin}", 0755);
    }

    File::put("{$this->root}/.env", "APP_NAME=LaraOwl\nVITE_APP_NAME=LaraOwl\n");

    // The live release, with its dependencies installed.
    File::makeDirectory("{$this->root}/releases/live/vendor", 0755, true);
    File::put("{$this->root}/releases/live/composer.lock", 'composer-v1');
    File::put("{$this->root}/releases/live/vendor/autoload.php", '<?php // live');
    symlink("{$this->root}/releases/live", "{$this->root}/current");

    // Writes a new release, as Forge's checkout would, from a set of changes.
    $this->checkout = function (string $id, array $changes = []): string {
        $dir = "{$this->root}/releases/{$id}";
        $files = [
            'composer.lock' => 'composer-v1',
            'package.json' => '{}',
            'package-lock.json' => 'lock-v1',
            'vite.config.ts' => 'export default {}',
            'tsconfig.json' => '{}',
            'routes/web.php' => '<?php // routes v1',
            'app/Models/Project.php' => '<?php // model v1',
            'resources/js/app.tsx' => 'app v1',
            'resources/css/app.css' => 'css v1',
            'resources/views/app.blade.php' => 'view v1',
            ...$changes,
        ];
        foreach ($files as $path => $contents) {
            File::ensureDirectoryExists(dirname("{$dir}/{$path}"));
            File::put("{$dir}/{$path}", $contents);
        }
        File::ensureDirectoryExists("{$dir}/public");
        symlink("{$this->root}/.env", "{$dir}/.env");

        return $dir;
    };

    $this->run = function (string $mode, ?string $dir = null, array $env = []) {
        File::delete($this->log);

        return Process::path($dir ?? $this->root)
            ->env([
                'FORGE_PHP' => "{$this->stubs}/php",
                'FORGE_COMPOSER' => "{$this->stubs}/composer",
                'FORGE_PHP_FPM' => 'php8.5-fpm',
                'PATH' => "{$this->stubs}:".getenv('PATH'),
                ...$env,
            ])
            ->run(['bash', base_path('deploy.sh'), $mode]);
    };

    $this->calls = fn () => File::exists($this->log) ? array_values(array_filter(explode("\n", File::get($this->log)))) : [];
    $this->npmCalls = fn () => array_values(array_filter(($this->calls)(), fn ($call) => str_starts_with($call, 'npm ')));
    $this->builds = fn () => count(File::directories("{$this->cache}/builds"));
});

afterEach(function () {
    File::deleteDirectory($this->root);
});

test('a first release installs Node packages once, builds, and caches the build', function () {
    $release = ($this->checkout)('one');

    $result = ($this->run)('release', $release);

    expect($result->successful())->toBeTrue($result->errorOutput())
        ->and(($this->calls)())->toBe([
            'composer dump-autoload --no-dev --optimize --no-interaction',
            'php artisan wayfinder:generate --with-form',
            'npm ci --include=dev --no-audit --no-fund --loglevel=error',
            'npm run build --silent',
            'php artisan optimize',
            'php artisan storage:link',
            'php artisan migrate --force',
        ])
        ->and(File::exists("{$release}/public/build/manifest.json"))->toBeTrue()
        ->and(is_link("{$release}/node_modules") || File::exists("{$release}/node_modules"))->toBeFalse()
        ->and(($this->builds)())->toBe(1);
});

test('a release whose frontend is unchanged copies the cached build', function () {
    ($this->run)('release', ($this->checkout)('one'));
    $first = File::get("{$this->root}/releases/one/public/build/manifest.json");

    // A backend-only change: a model, not routes or controllers.
    $release = ($this->checkout)('two', ['app/Models/Project.php' => '<?php // model v2']);
    $result = ($this->run)('release', $release);

    expect($result->successful())->toBeTrue($result->errorOutput())
        ->and($result->output())->toContain('Frontend unchanged')
        ->and(($this->npmCalls)())->toBe([])
        ->and(File::get("{$release}/public/build/manifest.json"))->toBe($first);
});

test('the frontend is rebuilt, without reinstalling packages, when what it is made from changes', function (array $change) {
    ($this->run)('release', ($this->checkout)('one'));

    $release = ($this->checkout)('two', $change['files'] ?? []);
    if (isset($change['env'])) {
        File::put("{$this->root}/.env", $change['env']);
    }

    expect(($this->run)('release', $release)->successful())->toBeTrue()
        ->and(($this->npmCalls)())->toBe(['npm run build --silent'])
        ->and(($this->builds)())->toBe(2);
})->with([
    'a component' => [['files' => ['resources/js/app.tsx' => 'app v2']]],
    'the CSS' => [['files' => ['resources/css/app.css' => 'css v2']]],
    'a view Tailwind reads' => [['files' => ['resources/views/app.blade.php' => 'view v2']]],
    'a route (through Wayfinder\'s types)' => [['files' => ['routes/web.php' => '<?php // routes v2']]],
    'a VITE_ setting' => [['env' => "APP_NAME=LaraOwl\nVITE_APP_NAME=Owl\n"]],
]);

test('a new package-lock reinstalls Node packages', function () {
    ($this->run)('release', ($this->checkout)('one'));

    $release = ($this->checkout)('two', ['package-lock.json' => 'lock-v2']);

    expect(($this->run)('release', $release)->successful())->toBeTrue()
        ->and(($this->npmCalls)())->toBe([
            'npm ci --include=dev --no-audit --no-fund --loglevel=error',
            'npm run build --silent',
        ]);
});

test('a failed build fails the release and caches nothing', function () {
    File::put("{$this->root}/fail-build", '');
    $release = ($this->checkout)('one');

    $result = ($this->run)('release', $release, ['FAIL_BUILD' => "{$this->root}/fail-build"]);

    expect($result->failed())->toBeTrue()
        ->and(($this->builds)())->toBe(0)
        ->and(($this->calls)())->not->toContain('php artisan migrate --force');
});

test('only the most recent builds are kept', function () {
    foreach (range(1, 7) as $n) {
        ($this->run)('release', ($this->checkout)("r{$n}", ['resources/js/app.tsx' => "app v{$n}"]));
    }

    expect(($this->builds)())->toBe(5);
});

test('with composer.lock changed a release installs PHP dependencies', function () {
    $release = ($this->checkout)('one', ['composer.lock' => 'composer-v2']);

    expect(($this->run)('release', $release)->successful())->toBeTrue()
        ->and(File::exists("{$release}/vendor"))->toBeFalse()
        ->and(($this->calls)()[0])->toBe('composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader');
});

test('with composer.lock unchanged a release copies the live vendor', function () {
    $release = ($this->checkout)('one');

    expect(($this->run)('release', $release)->successful())->toBeTrue()
        ->and(File::get("{$release}/vendor/autoload.php"))->toBe('<?php // live');
});

test('once live, PHP-FPM is reloaded to clear the opcache and the queue restarts', function () {
    expect(($this->run)('activated')->successful())->toBeTrue()
        ->and(($this->calls)())->toBe([
            'sudo -n service php8.5-fpm reload',
            'php artisan queue:restart',
        ]);
});

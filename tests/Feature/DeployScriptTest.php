<?php

use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Process;

/*
 * Runs the server half of deploy.sh in a throwaway Forge layout, with php,
 * composer and sudo replaced by stubs that log how they were called.
 */
beforeEach(function () {
    $this->root = sys_get_temp_dir().'/laraowl-deploy-'.bin2hex(random_bytes(4));
    $this->stubs = "{$this->root}/stubs";
    $this->log = "{$this->root}/calls.log";

    File::makeDirectory("{$this->stubs}", 0755, true);
    foreach (['php', 'composer', 'sudo'] as $bin) {
        File::put("{$this->stubs}/{$bin}", "#!/usr/bin/env bash\necho \"{$bin} \$*\" >> '{$this->log}'\n");
        chmod("{$this->stubs}/{$bin}", 0755);
    }

    // The live release, with its dependencies installed.
    File::makeDirectory("{$this->root}/releases/live/vendor", 0755, true);
    File::put("{$this->root}/releases/live/composer.lock", 'lock-v1');
    File::put("{$this->root}/releases/live/vendor/autoload.php", '<?php // live');
    symlink("{$this->root}/releases/live", "{$this->root}/current");

    // The new release: a checkout of the commit being deployed.
    $this->release = "{$this->root}/releases/new";
    File::makeDirectory("{$this->release}/public", 0755, true);
    $this->commitRelease = function (string $lock): string {
        File::put("{$this->release}/composer.lock", $lock);
        $git = fn (string ...$args) => Process::path($this->release)
            ->run(['git', '-c', 'user.name=t', '-c', 'user.email=t@example.test', ...$args])->throw();
        $git('init', '-q');
        $git('add', '-A');
        $git('commit', '-q', '-m', 'release');

        return trim($git('rev-parse', 'HEAD')->output());
    };

    $this->upload = function (string $commit): void {
        File::ensureDirectoryExists("{$this->root}/prebuilt-build/assets");
        File::put("{$this->root}/prebuilt-build/assets/app.js", 'built');
        File::put("{$this->root}/prebuilt-build/.commit", $commit);
    };

    $this->deploy = fn (string $mode) => Process::path($mode === 'release' ? $this->release : $this->root)
        ->env([
            'FORGE_PHP' => "{$this->stubs}/php",
            'FORGE_COMPOSER' => "{$this->stubs}/composer",
            'FORGE_PHP_FPM' => 'php8.5-fpm',
            'PATH' => "{$this->stubs}:".getenv('PATH'),
        ])
        ->run(['bash', base_path('deploy.sh'), $mode]);

    $this->calls = fn () => File::exists($this->log) ? array_values(array_filter(explode("\n", File::get($this->log)))) : [];
});

afterEach(function () {
    File::deleteDirectory($this->root);
});

test('a release refuses a frontend built for another commit', function () {
    ($this->commitRelease)('lock-v1');
    ($this->upload)('0000000000000000000000000000000000000000');

    $result = ($this->deploy)('release');

    expect($result->failed())->toBeTrue()
        ->and($result->errorOutput())->toContain('built for 0000000000000000000000000000000000000000')
        ->and(($this->calls)())->toBe([])
        ->and(File::exists("{$this->release}/vendor"))->toBeFalse();
});

test('with composer.lock unchanged a release reuses the live vendor and only rebuilds the autoloader', function () {
    $commit = ($this->commitRelease)('lock-v1');
    ($this->upload)($commit);

    $result = ($this->deploy)('release');

    expect($result->successful())->toBeTrue($result->errorOutput())
        ->and(File::get("{$this->release}/vendor/autoload.php"))->toBe('<?php // live')
        ->and(File::get("{$this->release}/public/build/assets/app.js"))->toBe('built')
        ->and(File::exists("{$this->release}/public/build/.commit"))->toBeFalse()
        ->and(($this->calls)())->toBe([
            'composer dump-autoload --no-dev --optimize --no-interaction',
            'php artisan optimize',
            'php artisan storage:link',
            'php artisan migrate --force',
        ]);
});

test('with composer.lock changed a release installs dependencies', function () {
    $commit = ($this->commitRelease)('lock-v2');
    ($this->upload)($commit);

    expect(($this->deploy)('release')->successful())->toBeTrue()
        ->and(File::exists("{$this->release}/vendor"))->toBeFalse()
        ->and(($this->calls)()[0])->toBe('composer install --no-dev --no-interaction --prefer-dist --optimize-autoloader');
});

test('once live, PHP-FPM is reloaded to clear the opcache and the queue restarts', function () {
    expect(($this->deploy)('activated')->successful())->toBeTrue()
        ->and(($this->calls)())->toBe([
            'sudo -n service php8.5-fpm reload',
            'php artisan queue:restart',
        ]);
});

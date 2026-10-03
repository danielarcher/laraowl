#!/usr/bin/env bash
#
# Deploys LaraOwl to a Laravel Forge zero-downtime site.
#
#   ./deploy.sh             From the laptop: test, push, deploy, check the box.
#   ./deploy.sh check       From the laptop: check the box only.
#   ./deploy.sh release     Run by Forge inside the new release directory.
#   ./deploy.sh activated   Run by Forge once the new release is live.
#
# A deployment started from the Forge dashboard does the same as one from
# the laptop: the release builds everything it needs on the server. Builds
# are cached by what they are made from, so most deploys copy the previous
# frontend and the live vendor/ instead of rebuilding them, and whatever
# does run is niced so the live site keeps the CPU.
#
# The Forge deployment script is then just:
#
#   $CREATE_RELEASE()
#   cd $FORGE_RELEASE_DIRECTORY
#   FORGE_PHP="$FORGE_PHP" FORGE_COMPOSER="$FORGE_COMPOSER" bash deploy.sh release
#   $ACTIVATE_RELEASE()
#   FORGE_PHP="$FORGE_PHP" FORGE_PHP_FPM="$FORGE_PHP_FPM" bash deploy.sh activated
#   $RESTART_QUEUES()
#
# Laptop settings live in deploy.env (see deploy.env.example).

set -euo pipefail

PHP_BIN=${FORGE_PHP:-php}
COMPOSER_BIN=${FORGE_COMPOSER:-composer}

# Frontend builds kept, most recently used first.
KEEP_BUILDS=5

step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- On the server ----------------------------------------------------------

release() {
    local root live cache
    root=$(dirname "$(dirname "$PWD")") # <site>/releases/<id> → <site>
    live="$root/current"
    cache="$root/.deploy-cache"
    mkdir -p "$cache/builds"

    dependencies "$live"
    frontend "$cache"

    nice -n 15 $PHP_BIN artisan optimize
    $PHP_BIN artisan storage:link
    $PHP_BIN artisan migrate --force
}

# When composer.lock is unchanged, copy the live vendor/ and only rebuild
# the autoloader.
dependencies() {
    local live=$1

    if [ -d "$live/vendor" ] && cmp -s "$live/composer.lock" composer.lock; then
        step "composer.lock unchanged: reusing the live vendor/"
        cp -a "$live/vendor" vendor
        nice -n 15 $COMPOSER_BIN dump-autoload --no-dev --optimize --no-interaction
    else
        step "Installing PHP dependencies"
        nice -n 15 $COMPOSER_BIN install --no-dev --no-interaction --prefer-dist --optimize-autoloader
    fi
}

# The frontend is made from resources/js (including the route types Wayfinder
# generates from routes/ and the controllers, refreshed here first), the CSS,
# the views Tailwind reads, the Node and Vite configuration, composer.lock
# (vendor views Tailwind reads) and the VITE_ settings in .env. A build is
# cached under the hash of all of that.
frontend() {
    local cache=$1 key build
    $PHP_BIN artisan wayfinder:generate --with-form > /dev/null
    key=$(frontend_key)
    build="$cache/builds/$key"

    if [ -f "$build/manifest.json" ]; then
        step "Frontend unchanged: reusing build ${key:0:12}"
        touch "$build"
    else
        step "Building the frontend (${key:0:12})"
        node_packages "$cache"
        nice -n 15 npm run build --silent
        rm -f node_modules
        rm -rf "$build.partial"
        cp -a public/build "$build.partial"
        mv "$build.partial" "$build"
        # shellcheck disable=SC2012
        ls -1t "$cache/builds" | tail -n +$((KEEP_BUILDS + 1)) | sed "s#^#$cache/builds/#" | xargs -r rm -rf
    fi

    rm -rf public/build
    cp -a "$build" public/build
}

frontend_key() {
    {
        find resources/js resources/css resources/views -type f -print0 | LC_ALL=C sort -z | xargs -0 sha256sum
        sha256sum package.json package-lock.json vite.config.ts tsconfig.json composer.lock
        grep '^VITE_' .env 2> /dev/null || true
    } | sha256sum | cut -c1-64
}

# Node packages are installed once per package-lock.json, outside the
# releases, and linked in for the build only.
node_packages() {
    local cache=$1

    if ! cmp -s package-lock.json "$cache/installed.lock" || [ ! -d "$cache/node_modules" ]; then
        step "Installing Node packages"
        rm -rf "$cache/node_modules" "$cache/installed.lock"
        cp package.json package-lock.json "$cache/"
        (cd "$cache" && nice -n 15 npm ci --include=dev --no-audit --no-fund --loglevel=error)
        cp package-lock.json "$cache/installed.lock"
    fi

    ln -sfn "$cache/node_modules" node_modules
}

activated() {
    # Each release runs from a new path, so PHP's opcache would keep every
    # earlier release's compiled code until it filled, and from then on each
    # request would recompile the app (the outage of 03/10/2026). A graceful
    # reload starts the cache clean; requests in flight finish first.
    sudo -n service "${FORGE_PHP_FPM:-php8.5-fpm}" reload
    $PHP_BIN artisan queue:restart
}

# --- From the laptop --------------------------------------------------------

forge() {
    local method=$1 path=$2
    curl -fsS -X "$method" \
        -H "Authorization: Bearer $FORGE_TOKEN" -H 'Accept: application/json' \
        "https://forge.laravel.com/api/orgs/$FORGE_ORG/servers/$FORGE_SERVER/sites/$FORGE_SITE/$path"
}

json() { python3 -c "import json, sys; d = json.load(sys.stdin); print($1)"; }

settings() {
    cd "$(dirname "$0")"
    [ -f deploy.env ] || fail "Missing deploy.env: copy deploy.env.example and fill it in."
    # shellcheck source=/dev/null
    . ./deploy.env
    : "${FORGE_TOKEN:?}" "${FORGE_ORG:?}" "${FORGE_SERVER:?}" "${FORGE_SITE:?}" "${DEPLOY_SSH:?}" "${DEPLOY_ROOT:?}" "${APP_URL:?}"
}

deploy() {
    settings
    [ "$(git branch --show-current)" = main ] || fail "Deploy from main."
    git diff --quiet && git diff --cached --quiet || fail "Commit or stash your changes first."

    step "Tests"
    php artisan test --compact
    npm run --silent types:check

    step "Push"
    git push origin main

    step "Deploy"
    local id status=''
    id=$(forge POST deployments | json 'd["data"]["id"]')
    for _ in $(seq 1 90); do
        sleep 10
        status=$(forge GET "deployments/$id" | json 'd["data"]["attributes"]["status"]')
        [[ $status =~ ^(finished|failed)$ ]] && break
    done
    if [ "$status" != finished ]; then
        forge GET "deployments/$id/log" | json 'd["data"]["attributes"].get("output") or d' | tail -30
        fail "Deployment $id: ${status:-timed out}."
    fi
    echo "Deployment $id finished."

    step "Health"
    check
}

check() {
    local code
    code=$(curl -s -o /dev/null -m 10 -w '%{http_code}' -A 'Mozilla/5.0 (compatible; LaraOwlDeploy/1.0; bot)' "$APP_URL/up")
    [ "$code" = 200 ] || fail "$APP_URL/up answered $code."
    echo "$APP_URL/up: 200"
    ssh "$DEPLOY_SSH" "cd '$DEPLOY_ROOT/current' && php artisan laraowl:ingest:status && uptime"
}

case "${1:-deploy}" in
    release) release ;;
    activated) activated ;;
    deploy) deploy ;;
    check) settings && check ;;
    *) fail "Usage: ./deploy.sh [check|release|activated]" ;;
esac

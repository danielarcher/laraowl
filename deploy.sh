#!/usr/bin/env bash
#
# Deploys LaraOwl to a Laravel Forge zero-downtime site.
#
#   ./deploy.sh             From the laptop: test, build the frontend for this
#                           commit, upload it, push, deploy, check the box.
#   ./deploy.sh release     Run by Forge inside the new release directory.
#   ./deploy.sh activated   Run by Forge once the new release is live.
#
# The server never builds the frontend: npm on a small box takes minutes and
# most of its memory. The laptop uploads public/build to <site>/prebuilt-build
# stamped with the commit it was built from, and a release refuses a build
# stamped for any other commit, so stale assets can't ship.
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

step() { printf '\n\033[1m▸ %s\033[0m\n' "$*"; }
fail() { printf '\033[31m✗ %s\033[0m\n' "$*" >&2; exit 1; }

# --- On the server ----------------------------------------------------------

release() {
    local root live build commit built_for
    root=$(dirname "$(dirname "$PWD")") # <site>/releases/<id> → <site>
    live="$root/current"
    build="$root/prebuilt-build"
    commit=$(git rev-parse HEAD)
    built_for=$(cat "$build/.commit" 2>/dev/null || echo 'no commit')

    [ "$built_for" = "$commit" ] \
        || fail "The uploaded frontend was built for $built_for, not $commit. Deploy with ./deploy.sh from the laptop."

    # Deploy work runs at low priority so the live site keeps the CPU.
    if [ -d "$live/vendor" ] && cmp -s "$live/composer.lock" composer.lock; then
        step "composer.lock unchanged: reusing the live vendor/"
        cp -a "$live/vendor" vendor
        nice -n 15 $COMPOSER_BIN dump-autoload --no-dev --optimize --no-interaction
    else
        step "Installing dependencies"
        nice -n 15 $COMPOSER_BIN install --no-dev --no-interaction --prefer-dist --optimize-autoloader
    fi

    cp -R "$build" public/build
    rm -f public/build/.commit

    nice -n 15 $PHP_BIN artisan optimize
    $PHP_BIN artisan storage:link
    $PHP_BIN artisan migrate --force
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

deploy() {
    cd "$(dirname "$0")"
    [ -f deploy.env ] || fail "Missing deploy.env: copy deploy.env.example and fill it in."
    # shellcheck source=/dev/null
    . ./deploy.env
    : "${FORGE_TOKEN:?}" "${FORGE_ORG:?}" "${FORGE_SERVER:?}" "${FORGE_SITE:?}" "${DEPLOY_SSH:?}" "${DEPLOY_ROOT:?}" "${APP_URL:?}"

    [ "$(git branch --show-current)" = main ] || fail "Deploy from main."
    git diff --quiet && git diff --cached --quiet || fail "Commit or stash your changes first."
    local commit
    commit=$(git rev-parse HEAD)

    step "Tests"
    php artisan test --compact

    step "Frontend for ${commit:0:7}"
    [ -d node_modules ] || npm ci
    npm run --silent types:check
    npm run --silent build
    echo "$commit" > public/build/.commit

    step "Upload"
    rsync -az --delete public/build/ "$DEPLOY_SSH:$DEPLOY_ROOT/prebuilt-build/"

    step "Push"
    git push origin main

    step "Deploy"
    local id status=''
    id=$(forge POST deployments | json 'd["data"]["id"]')
    for _ in $(seq 1 60); do
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
    check) cd "$(dirname "$0")" && . ./deploy.env && check ;;
    *) fail "Usage: ./deploy.sh [release|activated|check]" ;;
esac

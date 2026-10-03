#!/usr/bin/env bash
#
# LaraOwl server agent: sends one CPU / memory / swap / disk / load sample.
#
# Run it every minute from cron or a Forge scheduled job. Linux only; it needs
# bash, coreutils (df, nproc) and curl, and no root.
#
# Config (default ~/.laraowl/agent.env, override with LARAOWL_AGENT_CONFIG):
#   LARAOWL_URL=https://your-laraowl-host
#   LARAOWL_SERVER_TOKEN=<token from `php artisan laraowl:servers:create`>

set -euo pipefail

config="${LARAOWL_AGENT_CONFIG:-$HOME/.laraowl/agent.env}"

if [ -f "$config" ]; then
    # shellcheck disable=SC1090
    . "$config"
fi

: "${LARAOWL_URL:?LARAOWL_URL is not set}"
: "${LARAOWL_SERVER_TOKEN:?LARAOWL_SERVER_TOKEN is not set}"

json_escape() {
    local value=${1//\\/\\\\}
    printf '%s' "${value//\"/\\\"}"
}

# Busy share of all CPUs over one second, from the aggregate line of /proc/stat.
cpu_counters() {
    local _ user nice system idle iowait irq softirq steal
    read -r _ user nice system idle iowait irq softirq steal _ < /proc/stat
    echo "$((user + nice + system + idle + iowait + irq + softirq + steal)) $((idle + iowait))"
}

read -r total_before idle_before <<< "$(cpu_counters)"
sleep 1
read -r total_after idle_after <<< "$(cpu_counters)"

total_delta=$((total_after - total_before))
idle_delta=$((idle_after - idle_before))
cpu_percent=0

if [ "$total_delta" -gt 0 ]; then
    cpu_percent=$(awk -v t="$total_delta" -v i="$idle_delta" 'BEGIN { printf "%.2f", (t - i) * 100 / t }')
fi

# /proc/meminfo is in kB; printf keeps big byte counts out of scientific notation.
meminfo_bytes() {
    awk -v key="$1:" '$1 == key { printf "%.0f", $2 * 1024; found = 1 } END { if (!found) printf "0" }' /proc/meminfo
}

memory_total=$(meminfo_bytes MemTotal)
memory_available=$(meminfo_bytes MemAvailable)
swap_total=$(meminfo_bytes SwapTotal)
swap_free=$(meminfo_bytes SwapFree)

read -r load_1 load_5 load_15 _ < /proc/loadavg
read -r uptime_seconds _ < /proc/uptime

os=""
if [ -r /etc/os-release ]; then
    os=$(. /etc/os-release && printf '%s' "${PRETTY_NAME:-}")
fi

# Real block-device filesystems only (no tmpfs, overlays, snaps).
disks=""
while read -r source size used target; do
    case "$source" in
        /dev/*) ;;
        *) continue ;;
    esac
    disks+="${disks:+,}{\"mount\":\"$(json_escape "$target")\",\"total\":$size,\"used\":$used}"
done < <(df -B1 --local --output=source,size,used,target -x tmpfs -x devtmpfs -x squashfs -x overlay -x efivarfs 2>/dev/null | tail -n +2)

if [ -z "$disks" ]; then
    read -r size used < <(df -B1 --output=size,used / | tail -n 1)
    disks="{\"mount\":\"/\",\"total\":$size,\"used\":$used}"
fi

payload=$(printf '{"hostname":"%s","os":"%s","cpu_count":%d,"cpu_percent":%s,"load":[%s,%s,%s],"memory":{"total":%s,"available":%s},"swap":{"total":%s,"free":%s},"disks":[%s],"uptime":%s}' \
    "$(json_escape "$(hostname)")" \
    "$(json_escape "$os")" \
    "$(nproc)" \
    "$cpu_percent" \
    "$load_1" "$load_5" "$load_15" \
    "$memory_total" "$memory_available" \
    "$swap_total" "$swap_free" \
    "$disks" \
    "$uptime_seconds")

# The token goes through curl's config on stdin so it never shows in `ps`.
printf 'header = "Authorization: Bearer %s"\n' "$LARAOWL_SERVER_TOKEN" | curl -fsS --max-time 10 \
    -K - \
    -H 'Content-Type: application/json' \
    -H 'Accept: application/json' \
    --data "$payload" \
    "${LARAOWL_URL%/}/api/servers/metrics" > /dev/null

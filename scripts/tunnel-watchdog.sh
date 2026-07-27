#!/bin/bash
# tunnel-watchdog.sh — Ensures the Cloudflare tunnel stays running.
# Designed to run as a cron job every 5 minutes.
# Keeps the Cloudflare tunnel alive (hostname from TUNNEL_URL in .env).

set -euo pipefail

# Homebrew PATH — cron doesn't inherit user's shell PATH
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"

TUNNEL_LOG="${TUNNEL_LOG:-/tmp/ag2r-tunnel.log}"

# If cloudflared is running, check its uptime.
# Restart if it's been up for more than 24 hours to prevent QUIC connection staleness.
MAX_UPTIME_HOURS=24

if pgrep -x cloudflared > /dev/null 2>&1; then
  TUNNEL_PID=$(pgrep -x cloudflared | head -1)
  # ps etime format: [[DD-]HH:]MM:SS — extract days if present
  ETIME=$(ps -p "$TUNNEL_PID" -o etime= | xargs)
  DAYS=0
  if echo "$ETIME" | grep -q '-'; then
    DAYS=$(echo "$ETIME" | cut -d'-' -f1 | sed 's/^0*//')
    DAYS=${DAYS:-0}
  fi
  # Extract hours (format after days: HH:MM:SS or MM:SS)
  TIME_PART=$(echo "$ETIME" | sed 's/.*-//')
  COLONS=$(echo "$TIME_PART" | tr -cd ':' | wc -c | xargs)
  HOURS=0
  if [ "$COLONS" -eq 2 ]; then
    HOURS=$(echo "$TIME_PART" | cut -d':' -f1 | sed 's/^0*//')
    HOURS=${HOURS:-0}
  fi
  TOTAL_HOURS=$(( DAYS * 24 + HOURS ))

  if [ "$TOTAL_HOURS" -ge "$MAX_UPTIME_HOURS" ]; then
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] cloudflared uptime ${TOTAL_HOURS}h exceeds ${MAX_UPTIME_HOURS}h — restarting for fresh QUIC connections"
    pkill -x cloudflared
    sleep 2
  else
    exit 0
  fi
fi

echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tunnel is down, restarting..."

nohup cloudflared tunnel run >> "$TUNNEL_LOG" 2>&1 &
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Tunnel restarted with PID $!"

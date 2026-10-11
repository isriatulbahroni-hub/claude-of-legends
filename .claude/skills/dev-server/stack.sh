#!/usr/bin/env bash
# The local stack for one task: the authoritative server and the Vite
# client, in the background, with their logs and pids in one run directory,
# and a state directory of their own so a task never touches data/.
#
#   .claude/skills/dev-server/stack.sh up        # build + start both, wait until ready
#   .claude/skills/dev-server/stack.sh status    # what is running, on which ports, where the logs are
#   .claude/skills/dev-server/stack.sh log [n]   # last n lines of the server log (default 40)
#   .claude/skills/dev-server/stack.sh links     # confirmation and reset links the log-only mailer printed
#   .claude/skills/dev-server/stack.sh down      # stop both
#
# Knobs (env): PORT (server, default from .env then 8787), CLIENT_PORT (Vite,
# default 5173), DATA_DIR (default RUN_DIR/data; set DATA_DIR=data for the
# ordinary local state), RUN_DIR (default .dev, gitignored), NO_CLIENT=1 to
# start only the server, and anything the server reads from .env
# (ANTHROPIC_API_KEY, GENERATION_PROVIDER=mock, ...) is passed through.
set -uo pipefail

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$root" || exit 1
# shellcheck disable=SC1091
. "$root/.claude/skills/dev-server/node_env.sh" || exit 1

RUN_DIR="${RUN_DIR:-$root/.dev}"
mkdir -p "$RUN_DIR"
if [ -z "${PORT:-}" ] && [ -f .env ]; then
  PORT="$(grep -E '^PORT=' .env | tail -1 | cut -d= -f2- | tr -d '[:space:]')"
fi
PORT="${PORT:-8787}"
CLIENT_PORT="${CLIENT_PORT:-5173}"
DATA_DIR="${DATA_DIR:-$RUN_DIR/data}"
case "$DATA_DIR" in /*) ;; *) DATA_DIR="$root/$DATA_DIR" ;; esac
export PORT DATA_DIR

server_pid="$RUN_DIR/server.pid"
client_pid="$RUN_DIR/client.pid"
server_log="$RUN_DIR/server.log"
client_log="$RUN_DIR/client.log"

alive() { [ -f "$1" ] && kill -0 "$(cat "$1")" 2>/dev/null; }
# Asked by name, as the browser asks: Vite listens on localhost, which Node
# may resolve to ::1 alone, and the server on both families; curl tries
# every address localhost has.
listening() { curl -s -o /dev/null --noproxy '*' --max-time 2 "http://localhost:$1$2"; }

# Starts a command in the background as the leader of a process group of
# its own (job control on for that one start), its pid in `pidfile` and its
# output appended to `log`: down stops that group and nothing else,
# whichever group the caller runs in.
start() { # pidfile log command...
  local pidfile="$1" log="$2"
  shift 2
  set -m
  nohup "$@" >>"$log" 2>&1 &
  echo $! >"$pidfile"
  set +m
}

# A pid and every process under it, deepest first.
tree() {
  local child
  for child in $(pgrep -P "$1" 2>/dev/null); do tree "$child"; done
  echo "$1"
}

# Stops what up started under one pid file, if that pid still runs it
# (`what` is in its command line): the process group up gave it, which
# holds the pnpm wrapper and vite alike, or the pid and its descendants
# when it leads no group of its own (started by an older up, in the
# caller's group). Never a group this script runs in.
stop() { # pidfile what
  local pid pgid name target
  pid="$(cat "$1")"
  name="$(basename "$1" .pid)"
  if ! ps -o args= -p "$pid" 2>/dev/null | grep -q -- "$2"; then
    echo "pid $pid no longer runs the $name ($2); left alone"
    return 0
  fi
  pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
  if [ "$pgid" = "$pid" ] && [ "$pgid" != "$(ps -o pgid= -p $$ | tr -d ' ')" ]; then
    target="-$pid"
    kill -- "$target" 2>/dev/null
  else
    target="$pid"
    # shellcheck disable=SC2046
    kill $(tree "$pid") 2>/dev/null
  fi
  # The server closes its sockets and flushes its stores on TERM: wait for
  # it, so the ports are free for the next up.
  for _ in $(seq 1 40); do
    if ! kill -0 -- "$target" 2>/dev/null; then
      echo "stopped pid $pid ($name)"
      return 0
    fi
    sleep 0.25
  done
  echo "pid $pid ($name) still running 10 s after TERM" >&2
  return 1
}

wait_for() { # port path label
  for _ in $(seq 1 60); do
    listening "$1" "$2" && return 0
    sleep 0.5
  done
  echo "timeout: $3 did not answer on :$1" >&2
  return 1
}

up() {
  if alive "$server_pid"; then
    echo "server already running (pid $(cat "$server_pid")), see status"
  elif listening "$PORT" /api/session; then
    echo "something else already listens on :$PORT (another checkout's pnpm server?). Set PORT to a free one." >&2
    exit 1
  else
    node scripts/build_server.mjs >"$server_log" 2>&1 || { cat "$server_log"; exit 1; }
    mkdir -p "$DATA_DIR"
    # --env-file-if-exists mirrors pnpm server: .env knobs apply, the shell wins.
    start "$server_pid" "$server_log" node --env-file-if-exists=.env dist-server/server.cjs
    wait_for "$PORT" /api/session server || { tail -20 "$server_log"; exit 1; }
    echo "server on :$PORT, state in $DATA_DIR, log $server_log"
    grep -E '^(suggestions|mail|generation|discord|arena):' "$server_log" | sed 's/^/  /'
  fi
  if [ "${NO_CLIENT:-}" = "1" ]; then return; fi
  if alive "$client_pid"; then
    echo "client already running (pid $(cat "$client_pid"))"
  elif listening "$CLIENT_PORT" /; then
    echo "something else already listens on :$CLIENT_PORT. Set CLIENT_PORT to a free one." >&2
    exit 1
  else
    : >"$client_log"
    start "$client_pid" "$client_log" pnpm exec vite --port "$CLIENT_PORT" --strictPort
    wait_for "$CLIENT_PORT" / client || { tail -20 "$client_log"; exit 1; }
    echo "client on http://localhost:$CLIENT_PORT (proxies /api and /ws to :$PORT), log $client_log"
  fi
}

down() {
  local failed=0
  # A pid file is kept while what it names would not stop.
  if alive "$client_pid" && ! stop "$client_pid" vite; then failed=1; else rm -f "$client_pid"; fi
  if alive "$server_pid" && ! stop "$server_pid" server.cjs; then failed=1; else rm -f "$server_pid"; fi
  return "$failed"
}

status() {
  for name in server client; do
    f="$RUN_DIR/$name.pid"
    if alive "$f"; then echo "$name: running (pid $(cat "$f"))"; else echo "$name: not running"; fi
  done
  echo "server port :$PORT ($(listening "$PORT" /api/session && echo answering || echo silent))"
  echo "client port :$CLIENT_PORT ($(listening "$CLIENT_PORT" / && echo answering || echo silent))"
  echo "state: $DATA_DIR"
  echo "logs: $server_log, $client_log"
}

links() {
  # The log-only mailer prints each mail after a [mail:log-only] line; the
  # links in it are the confirmation and reset URLs a developer follows.
  grep -Eo 'https?://[^ ]+' "$server_log" 2>/dev/null | grep -E '/(confirm|reset)' || echo "no links printed yet"
}

case "${1:-}" in
  up) up ;;
  down) down ;;
  status) status ;;
  log) tail -n "${2:-40}" "$server_log" ;;
  links) links ;;
  *) sed -n '2,20p' "$0"; exit 2 ;;
esac

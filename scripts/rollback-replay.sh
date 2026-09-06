#!/usr/bin/env bash
#
# Deploy, roll the players back to a pre-release snapshot, and catch their xp
# back up from the scores that snapshot predates.
#
# Runs unattended after the sudo prompt. Every step is fatal: if the build
# fails, or the restore fails, it stops rather than leaving the database half
# moved. The one irreversible step (the restore) happens only after a fresh
# snapshot of the current data has been written to backups/.
#
#   ./scripts/rollback-replay.sh [bump]
#
# bump defaults to `build` (private, no tag, no public push). Pass patch/minor
# /major for a real release.
set -euo pipefail

cd "$(dirname "$0")/.."

BUMP="${1:-build}"
SNAPSHOT="${SNAPSHOT:-backups/2026-09-05-adri_server-idle.sql}"
# taken during the run, once the server is down - see step 5
SCORES="backups/scores-to-replay.json"

step() { printf '\n\033[1;36m== %s\033[0m\n' "$1"; }

[ -f "$SNAPSHOT" ] || { echo "missing snapshot: $SNAPSHOT"; exit 1; }

step "sudo (asked once, cached for the rest)"
sudo -v

# hold the sudo timestamp open for the whole run
while true; do sudo -n true; sleep 50; kill -0 "$$" 2>/dev/null || exit; done 2>/dev/null &
SUDO_KEEPALIVE=$!
trap 'kill "$SUDO_KEEPALIVE" 2>/dev/null || true' EXIT

step "1/8 snapshot the database as it stands (the undo for all of this)"
npm run backup:prod

step "2/8 build and bump ($BUMP)"
node scripts/version-bump.mjs "$BUMP" \
  --verify "npm run i18n:upload && npm run i18n:download && node scripts/staged-build.mjs"

step "3/8 stop the server"
sudo systemctl stop osu-idle

step "4/8 dump the scores the snapshot predates (server is down, so the set is closed)"
node scripts/dump-missing-scores.mjs "$SNAPSHOT" "$SCORES"

step "5/8 restore $SNAPSHOT"
node scripts/restore-db.mjs "$SNAPSHOT"

step "6/8 migrate the restored database"
npm run migrate:prod

step "7/8 replay those scores"
npm -w @osu-idle/server run replay:scores:prod -- --file "../../$SCORES"

step "8/8 drop the rankings cache so it rebuilds from the restored data"
node scripts/reset-rankings.mjs

step "starting the server"
sudo systemctl start osu-idle

printf '\n\033[1;32mdone\033[0m - players rolled back, scores replayed, rankings rebuilding on boot\n'

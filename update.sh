#!/usr/bin/env bash
# ---------------------------------------------------------------------------
# FamyHub – Update aus GitHub einspielen
#
#   ./update.sh            Update von "main" holen, Backup, neu bauen, starten
#   ./update.sh --check    nur anzeigen, ob es ein Update gibt
#   ./update.sh --force    auch ohne neue Commits neu bauen
#   BRANCH=dev ./update.sh anderen Branch verwenden
#
# Ablauf: Prüfungen → Backup von data/ und uploads/ → git pull → Image bauen
# → Container neu starten → auf "healthy" warten. Schlägt der Start fehl,
# wird automatisch auf den vorherigen Stand zurückgerollt.
# ---------------------------------------------------------------------------
set -Eeuo pipefail

cd "$(dirname "$(readlink -f "$0")")"

BRANCH="${BRANCH:-main}"
KEEP_BACKUPS="${KEEP_BACKUPS:-7}"
BACKUP_DIR="backups"
MODE="${1:-}"

c_blue='\033[1;34m'; c_green='\033[1;32m'; c_yellow='\033[1;33m'; c_red='\033[1;31m'; c_off='\033[0m'
step() { echo -e "${c_blue}==>${c_off} $*"; }
ok()   { echo -e "${c_green}✓${c_off} $*"; }
warn() { echo -e "${c_yellow}!${c_off} $*"; }
die()  { echo -e "${c_red}✗ $*${c_off}" >&2; exit 1; }

# --- Prüfungen ------------------------------------------------------------
command -v git >/dev/null    || die "git ist nicht installiert."
command -v docker >/dev/null || die "docker ist nicht installiert."
docker compose version >/dev/null 2>&1 || die "'docker compose' (v2) wird benötigt."
[ -d .git ]  || die "Dieser Ordner ist kein Git-Klon. Siehe README → 'Installation mit Git'."
[ -f .env ]  || die ".env fehlt. Mit 'cp .env.example .env' anlegen und anpassen."

if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
    git status --short --untracked-files=no
    die "Es gibt lokale Änderungen an Dateien aus dem Repository. Bitte sichern/zurücksetzen (git stash) – eigene Anpassungen gehören in .env oder docker-compose.override.yml."
fi

# --- Gibt es etwas Neues? ---------------------------------------------------
step "Prüfe GitHub auf Updates (Branch: $BRANCH) …"
git fetch --quiet origin "$BRANCH"
LOCAL="$(git rev-parse HEAD)"
REMOTE="$(git rev-parse "origin/$BRANCH")"

if [ "$LOCAL" = "$REMOTE" ] && [ "$MODE" != "--force" ]; then
    ok "FamyHub ist aktuell ($(git log -1 --format='%h – %s'))."
    exit 0
fi

if [ "$LOCAL" != "$REMOTE" ]; then
    echo "Neue Änderungen:"
    git --no-pager log --oneline --no-decorate "$LOCAL..$REMOTE" | sed 's/^/   /'
fi
[ "$MODE" = "--check" ] && exit 0

# --- Backup -----------------------------------------------------------------
mkdir -p "$BACKUP_DIR"
STAMP="$(date +%Y-%m-%d_%H-%M-%S)"
BACKUP_FILE="$BACKUP_DIR/famyhub_${STAMP}_$(git rev-parse --short HEAD).tar.gz"

step "Stoppe FamyHub für ein konsistentes Backup …"
docker compose stop

step "Sichere data/ und uploads/ nach $BACKUP_FILE …"
DIRS=(); for d in data uploads; do [ -d "$d" ] && DIRS+=("$d"); done
[ ${#DIRS[@]} -gt 0 ] || die "Weder data/ noch uploads/ gefunden – falscher Ordner?"
tar czf "$BACKUP_FILE" "${DIRS[@]}"
ok "Backup erstellt ($(du -h "$BACKUP_FILE" | cut -f1))."

# Alte Backups aufräumen
ls -1t "$BACKUP_DIR"/famyhub_*.tar.gz 2>/dev/null | tail -n +"$((KEEP_BACKUPS + 1))" | xargs -r rm -f

# --- Update ---------------------------------------------------------------
rollback() {
    warn "Update fehlgeschlagen – rolle auf $(git rev-parse --short "$LOCAL") zurück …"
    git reset --quiet --hard "$LOCAL"
    docker compose build && docker compose up -d
    die "Update abgebrochen. Der vorherige Stand läuft wieder. Logs: docker compose logs --tail=100"
}

step "Hole neuen Stand …"
git merge --ff-only --quiet "origin/$BRANCH" || die "Fast-Forward nicht möglich (lokale Commits?). Bitte manuell prüfen."
ok "Jetzt auf $(git log -1 --format='%h – %s')"

trap rollback ERR

step "Baue Image (das dauert beim ersten Mal ein paar Minuten) …"
docker compose build --pull

step "Starte FamyHub neu …"
docker compose up -d --remove-orphans

step "Warte auf Healthcheck …"
CID="$(docker compose ps -q famyhub)"
for _ in $(seq 1 60); do
    STATUS="$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$CID" 2>/dev/null || echo unknown)"
    case "$STATUS" in
        healthy) break ;;
        unhealthy|exited|dead) docker compose logs --tail=50; false ;;
    esac
    sleep 2
done
[ "$STATUS" = "healthy" ] || { docker compose logs --tail=50; false; }

trap - ERR
docker image prune -f >/dev/null 2>&1 || true

PORT="$(grep -E '^FAMYHUB_PORT=' .env | cut -d= -f2 || true)"
ok "Update fertig – FamyHub läuft auf Port ${PORT:-3265}."
ok "Backup: $BACKUP_FILE"

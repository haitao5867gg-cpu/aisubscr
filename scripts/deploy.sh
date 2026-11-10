#!/usr/bin/env bash
# Zero-downtime release for aisubscr.
#
# Builds a fresh directory under /opt/aisubscr-releases/<sha> while the current
# process keeps serving, then points /opt/aisubscr-current at it and restarts.
# Shared .env, the SQLite database, and public uploads are symlinks.
#
# The service is stopped only when `prisma migrate deploy` has work to do.
# /api/health must report the new commit or the previous symlink is restored.
#
# This script never runs npm run db:seed, npm run db:setup, prisma db seed,
# prisma db push, or prisma migrate reset. It never deletes the shared uploads
# directory or the database file.
#
# Root's umask is 0077. Without `umask 022` the new tree is mode 0700/0600.
# After the build, the release is chowned to the service user so Next can
# write .next/cache. Symlinks to shared data are not followed.
#
# See docs/DEPLOY.md.
set -euo pipefail
umask 022

RELEASES_DIR="${RELEASES_DIR:-/opt/aisubscr-releases}"
CURRENT_LINK="${CURRENT_LINK:-/opt/aisubscr-current}"
SHARED_DIR="${SHARED_DIR:-/opt/aisubscr-shared}"
SERVICE="${SERVICE:-aisubscr.service}"
SERVICE_USER="${SERVICE_USER:-aisubscr}"
HEALTH_URL="${HEALTH_URL:-http://127.0.0.1:3000/api/health}"
ENV_FILE="${ENV_FILE:-$SHARED_DIR/.env}"
DB_FILE="${DB_FILE:-$SHARED_DIR/production.db}"
UPLOADS_DIR="${UPLOADS_DIR:-$SHARED_DIR/uploads}"
RELEASE_ENV="${RELEASE_ENV:-$SHARED_DIR/release.env}"

REPO=""
REF="HEAD"
FETCH=1

phase="check"
release=""
release_created=0
service_stopped=0
switched=0
commit_written=0
previous_target=""
release_env_backup=""

usage() {
  cat <<'EOF'
Usage: deploy.sh [--ref <git-ref>] [--repo <path>] [--no-fetch]

Build a new release, migrate only when needed, switch /opt/aisubscr-current,
and roll back if /api/health does not report the new commit.

Does not seed the database and does not delete uploads.
EOF
}

die() {
  echo "deploy.sh: $*" >&2
  exit 1
}

if [[ "${EUID}" -eq 0 ]]; then
  SYSTEMCTL=(systemctl)
  CHOWN=(chown)
else
  SYSTEMCTL=(sudo -n systemctl)
  CHOWN=(sudo -n chown)
fi

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      [[ $# -ge 2 ]] || die "--ref needs a commit or branch"
      REF="$2"
      shift 2
      ;;
    --repo)
      [[ $# -ge 2 ]] || die "--repo needs a git checkout path"
      REPO="$2"
      shift 2
      ;;
    --no-fetch)
      FETCH=0
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      die "unknown argument: $1"
      ;;
  esac
done

if [[ -z "$REPO" ]]; then
  REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
fi

command -v git >/dev/null 2>&1 || die "git is required"
command -v npm >/dev/null 2>&1 || die "npm is required"
command -v node >/dev/null 2>&1 || die "node is required"
command -v curl >/dev/null 2>&1 || die "curl is required"
command -v flock >/dev/null 2>&1 || die "flock is required"

[[ -d "$REPO/.git" || -f "$REPO/.git" ]] || die "$REPO is not a git checkout"
[[ -f "$ENV_FILE" ]] || die "missing $ENV_FILE"
[[ -f "$DB_FILE" ]] || die "missing $DB_FILE"
[[ -d "$UPLOADS_DIR" ]] || die "missing $UPLOADS_DIR (move the live public/uploads here; this script will not create or delete it)"
if [[ -e "$CURRENT_LINK" && ! -L "$CURRENT_LINK" ]]; then
  die "$CURRENT_LINK exists and is not a symlink"
fi

load_env_file() {
  local file="$1" line key value
  while IFS= read -r line || [[ -n "$line" ]]; do
    line="${line#"${line%%[![:space:]]*}"}"
    [[ -z "$line" || "${line:0:1}" == "#" ]] && continue
    [[ "$line" == export\ * ]] && line="${line#export }"
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || die "cannot parse a line in $file"
    key="${line%%=*}"
    value="${line#*=}"
    if [[ "$value" == \"*\" && "$value" == *\" ]]; then
      value="${value:1:${#value}-2}"
    elif [[ "$value" == \'*\' && "$value" == *\' ]]; then
      value="${value:1:${#value}-2}"
    fi
    export "${key}=${value}"
  done < "$file"
}

switch_current() {
  local target="$1" link_dir tmp
  link_dir="$(dirname "$CURRENT_LINK")"
  mkdir -p -- "$link_dir"
  tmp="${link_dir}/.aisubscr-current.$$"
  ln -s "$target" "$tmp"
  if ! mv -Tf "$tmp" "$CURRENT_LINK"; then
    rm -f -- "$tmp"
    return 1
  fi
}

save_release_env() {
  if [[ -f "$RELEASE_ENV" ]]; then
    release_env_backup="$(mktemp)"
    cp -p -- "$RELEASE_ENV" "$release_env_backup"
  fi
}

write_release_env() {
  local tmp
  tmp="$(mktemp "${SHARED_DIR}/release.env.XXXXXX")"
  printf 'GIT_COMMIT=%s\n' "$1" > "$tmp"
  chmod 600 "$tmp"
  mv -f -- "$tmp" "$RELEASE_ENV"
  commit_written=1
}

restore_release_env() {
  [[ "$commit_written" -eq 1 ]] || return 0
  if [[ -n "$release_env_backup" && -f "$release_env_backup" ]]; then
    mv -f -- "$release_env_backup" "$RELEASE_ENV"
    release_env_backup=""
  else
    rm -f -- "$RELEASE_ENV"
  fi
  commit_written=0
}

# Give the service user the release tree so next start can create .next/cache.
# -P does not walk symlinks: shared .env, the database, and uploads stay put.
own_release() {
  local dir="$1" real shared_real uploads_real
  [[ -n "$dir" && -d "$dir" ]] || return 0
  real="$(readlink -f -- "$dir")"
  shared_real="$(readlink -f -- "$SHARED_DIR")"
  uploads_real="$(readlink -f -- "$UPLOADS_DIR")"
  if [[ "$real" == "$shared_real" || "$real" == "$shared_real"/* || "$real" == "$uploads_real" || "$real" == "$uploads_real"/* ]]; then
    echo "deploy.sh: refusing to chown shared data at $dir" >&2
    return 1
  fi
  "${CHOWN[@]}" -RP -- "${SERVICE_USER}:" "$real"
}

# Refuse to delete a shared data directory. Only a release folder qualifies,
# and only when uploads and the database inside it are symlinks.
safe_rm_release() {
  local dir="$1" real releases_real
  [[ -n "$dir" && -d "$dir" ]] || return 0
  real="$(readlink -f -- "$dir")"
  releases_real="$(readlink -f -- "$RELEASES_DIR")"
  [[ "$real" == "$releases_real/"* ]] || {
    echo "deploy.sh: refusing to delete $dir" >&2
    return 1
  }
  if [[ -d "$dir/public/uploads" && ! -L "$dir/public/uploads" ]]; then
    echo "deploy.sh: refusing to delete $dir because public/uploads is a real directory" >&2
    return 1
  fi
  if [[ -e "$dir/prisma/production.db" && ! -L "$dir/prisma/production.db" ]]; then
    echo "deploy.sh: refusing to delete $dir because the database is a real file" >&2
    return 1
  fi
  rm -rf -- "$dir"
}

rollback() {
  local restart=0 do_switch=0
  if [[ "$service_stopped" -eq 1 && "$switched" -eq 0 ]]; then
    restart=1
  fi
  if [[ "$switched" -eq 1 ]]; then
    if [[ -n "$previous_target" ]]; then
      do_switch=1
      restart=1
    else
      echo "deploy.sh: no previous release; stopping $SERVICE" >&2
      "${SYSTEMCTL[@]}" stop "$SERVICE" || true
    fi
    switched=0
  fi
  restore_release_env || echo "deploy.sh: could not restore $RELEASE_ENV" >&2
  if [[ "$restart" -eq 1 && -n "$previous_target" ]]; then
    own_release "$previous_target" || echo "deploy.sh: could not chown $previous_target to $SERVICE_USER" >&2
  fi
  if [[ "$do_switch" -eq 1 ]]; then
    switch_current "$previous_target" || echo "deploy.sh: could not restore $CURRENT_LINK" >&2
  fi
  if [[ "$restart" -eq 1 ]]; then
    "${SYSTEMCTL[@]}" restart "$SERVICE" || "${SYSTEMCTL[@]}" start "$SERVICE" || echo "deploy.sh: could not start $SERVICE" >&2
  fi
  service_stopped=0
}

on_exit() {
  local code=$?
  trap - EXIT
  if [[ "$code" -eq 0 ]]; then
    [[ -n "$release_env_backup" && -f "$release_env_backup" ]] && rm -f -- "$release_env_backup"
    exit 0
  fi
  if [[ "$phase" == "rolled_back" ]]; then
    exit "$code"
  fi
  echo "deploy.sh: failed during ${phase}" >&2
  case "$phase" in
    build)
      restore_release_env || true
      if [[ "$release_created" -eq 1 && "$switched" -eq 0 ]]; then
        safe_rm_release "$release" || true
      fi
      if [[ "$service_stopped" -eq 1 ]]; then
        rollback || true
      fi
      ;;
    stopped|switching|switched)
      rollback || true
      ;;
  esac
  exit "$code"
}

require_unit() {
  local wd exec_start env_files
  wd="$("${SYSTEMCTL[@]}" show -p WorkingDirectory --value "$SERVICE")"
  exec_start="$("${SYSTEMCTL[@]}" show -p ExecStart --value "$SERVICE")"
  env_files="$("${SYSTEMCTL[@]}" show -p EnvironmentFiles --value "$SERVICE")"
  [[ "$wd" == "$CURRENT_LINK" ]] || die "set WorkingDirectory=$CURRENT_LINK on $SERVICE (now: ${wd:-unset}). See docs/DEPLOY.md"
  [[ "$exec_start" == *"$CURRENT_LINK"* ]] || die "ExecStart must use $CURRENT_LINK. See docs/DEPLOY.md"
  [[ "$env_files" == *"$RELEASE_ENV"* ]] || die "add EnvironmentFile=$RELEASE_ENV to $SERVICE. See docs/DEPLOY.md"
  [[ "$env_files" == *"$ENV_FILE"* ]] || die "add EnvironmentFile=$ENV_FILE to $SERVICE. See docs/DEPLOY.md"
}

link_shared() {
  local extra placeholder
  if [[ -d "$release/public/uploads" && ! -L "$release/public/uploads" ]]; then
    extra="$(find "$release/public/uploads" -mindepth 1 ! -name '.gitkeep' -print -quit || true)"
    [[ -z "$extra" ]] || die "the new release contains files under public/uploads; refusing to continue"
    # Extracted placeholder only (a gitkeep). The shared uploads directory is not this path.
    placeholder="$release/public/uploads"
    rm -rf -- "$placeholder"
  fi
  ln -sfn -- "$ENV_FILE" "$release/.env"
  mkdir -p -- "$release/prisma" "$release/public"
  if [[ -e "$release/prisma/production.db" && ! -L "$release/prisma/production.db" ]]; then
    die "refusing to replace a real database file inside the release"
  fi
  ln -sfn -- "$DB_FILE" "$release/prisma/production.db"
  ln -sfn -- "$UPLOADS_DIR" "$release/public/uploads"
}

health_matches() {
  HEALTH_EXPECT="$1" HEALTH_BODY="$2" node -e 'const expected=process.env.HEALTH_EXPECT||""; const body=process.env.HEALTH_BODY||""; let data; try { data=JSON.parse(body);} catch { process.exit(1);} if (data && data.ok===true && data.db===true && String(data.commit||"").toLowerCase()===expected.toLowerCase()) process.exit(0); process.exit(1);'
}

wait_healthy() {
  local expected="$1" attempt body
  attempt=1
  while [[ "$attempt" -le 30 ]]; do
    body="$(curl -fsS --max-time 5 "$HEALTH_URL" 2>/dev/null || true)"
    if [[ -n "$body" ]] && health_matches "$expected" "$body"; then
      return 0
    fi
    sleep 1
    attempt=$((attempt + 1))
  done
  echo "deploy.sh: ${HEALTH_URL} did not report commit ${expected}" >&2
  return 1
}

prune_old_releases() {
  local path real current_real previous_real
  current_real="$(readlink -f -- "$release")"
  previous_real=""
  if [[ -n "$previous_target" ]]; then
    previous_real="$(readlink -f -- "$previous_target" || true)"
  fi
  for path in "$RELEASES_DIR"/*; do
    [[ -d "$path" ]] || continue
    real="$(readlink -f -- "$path")"
    [[ "$real" == "$current_real" ]] && continue
    [[ -n "$previous_real" && "$real" == "$previous_real" ]] && continue
    safe_rm_release "$path" || echo "deploy.sh: left $path in place" >&2
  done
}

mkdir -p -- "$RELEASES_DIR"
exec 9>"$RELEASES_DIR/.deploy.lock"
if ! flock -n 9; then
  die "another deploy is running"
fi

trap on_exit EXIT
require_unit

if [[ "$FETCH" -eq 1 ]]; then
  git -C "$REPO" fetch --prune origin
fi
SHA="$(git -C "$REPO" rev-parse --verify "${REF}^{commit}")"
[[ "$SHA" =~ ^[0-9a-f]{40}$ ]] || die "ref did not resolve to a full commit"

release="${RELEASES_DIR}/${SHA}"
if [[ -L "$CURRENT_LINK" ]]; then
  previous_target="$(readlink -f -- "$CURRENT_LINK" || true)"
  if [[ -n "$previous_target" && "$previous_target" == "$(readlink -f -- "$release" 2>/dev/null || true)" ]]; then
    echo "deploy.sh: ${SHA} is already the current release"
    phase="done"
    exit 0
  fi
fi

phase="build"
[[ "$SERVICE_USER" =~ ^[a-z_][a-z0-9_-]{0,31}$ ]] || die "SERVICE_USER must be a simple account name"
id -u "$SERVICE_USER" >/dev/null 2>&1 || die "service user ${SERVICE_USER} does not exist"
if [[ -e "$release" ]]; then
  safe_rm_release "$release" || die "cannot replace an existing release at $release"
fi
mkdir -p -- "$release"
release_created=1
git -C "$REPO" archive --format=tar "$SHA" | tar -x -C "$release"
link_shared

cd "$release" || die "cannot enter $release"
env -u NODE_ENV npm ci --no-audit --no-fund
env NODE_ENV=production GIT_COMMIT="$SHA" npm run build

load_env_file "$ENV_FILE"
status_output="$(npx prisma migrate status 2>&1)" && status_code=0 || status_code=$?
if [[ "$status_code" -eq 0 ]]; then
  pending=0
elif [[ "$status_output" == *"not yet been applied"* ]]; then
  pending=1
else
  printf '%s\n' "$status_output" >&2
  die "prisma migrate status failed; the service was not stopped"
fi

if [[ "$pending" -eq 1 ]]; then
  phase="stopped"
  service_stopped=1
  "${SYSTEMCTL[@]}" stop "$SERVICE"
  npx prisma migrate deploy
fi

save_release_env
write_release_env "$SHA"
phase="switching"
own_release "$release" || die "could not chown $release to $SERVICE_USER"
switch_current "$release" || die "could not switch $CURRENT_LINK"
switched=1
phase="switched"
"${SYSTEMCTL[@]}" restart "$SERVICE"

if ! wait_healthy "$SHA"; then
  echo "deploy.sh: switching back to the previous release" >&2
  rollback
  phase="rolled_back"
  exit 1
fi

prune_old_releases || true
echo "deploy.sh: ${SHA} is serving"
phase="done"

#!/usr/bin/env bash
# Make Vercel's production and preview env vars match .env.production exactly:
# remove every variable on the linked project, then add each non-empty line.
# Values must be unquoted (KEY=value).
# Redeploy afterwards; existing deployments keep their old values.
set -euo pipefail

cd "$(dirname "$0")/.."
env_file=.env.production

if [ ! -f "$env_file" ]; then
  echo "Missing $env_file" >&2
  exit 1
fi

# 1. remove every variable currently on Vercel
keys=$(vercel env ls --format json </dev/null | node -e '
  let s = ""
  process.stdin.on("data", d => (s += d)).on("end", () => {
    const keys = new Set(JSON.parse(s).envs.map(e => e.key))
    console.log([...keys].join("\n"))
  })')

for key in $keys; do
  echo "Removing $key"
  for target in production preview development; do
    vercel env rm "$key" --environment "$target" --yes </dev/null >/dev/null 2>&1 || true
  done
done

# 2. add every non-empty value to production and preview
while IFS='=' read -r name value || [ -n "$name" ]; do
  case "$name" in '' | \#*) continue ;; esac
  [ -z "$value" ] && continue
  printf '%s' "$value" | vercel env add "$name" --environment production,preview --sensitive --yes
done <"$env_file"

vercel env ls </dev/null

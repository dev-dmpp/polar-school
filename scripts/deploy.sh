#!/usr/bin/env bash
# Deploy idempotente. Usar manualmente o desde GitHub Actions.
#
# Uso:
#   ./scripts/deploy.sh staging
#   ./scripts/deploy.sh production
#
# Requiere:
#   - git
#   - node 22+
#   - pnpm 10+
#   - pm2
#   - docker compose (para postgres si es local)
#   - .env en apps/api/

set -euo pipefail

ENV="${1:-}"
if [[ "$ENV" != "staging" && "$ENV" != "production" ]]; then
  echo "Uso: $0 <staging|production>"
  exit 1
fi

cd "$(dirname "$0")/.."

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "  Deploy $ENV"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Verificar .env
if [[ ! -f apps/api/.env ]]; then
  echo "ERROR: apps/api/.env no existe."
  echo "Copiar apps/api/.env.example y completar."
  exit 1
fi

# 2. Pull código
echo "▸ Pull código"
git fetch --tags
if [[ "$ENV" == "production" ]]; then
  if [[ -z "${TAG:-}" ]]; then
    echo "ERROR: para producción, TAG debe estar seteada."
    exit 1
  fi
  git checkout "$TAG"
  git reset --hard "$TAG"
else
  git checkout master
  git reset --hard origin/master
fi

# 3. Dependencies
echo "▸ Install deps"
pnpm install --frozen-lockfile

# 4. Migrations (sólo nuevas)
echo "▸ Migraciones DB"
(cd packages/db && pnpm exec drizzle-kit migrate)

# 5. Build
echo "▸ Build"
pnpm build

# 6. Restart con pm2 (zero-downtime reload)
echo "▸ Restart pm2"
if pm2 list 2>/dev/null | grep -q "polar-school-api"; then
  pm2 reload "polar-school-api" || pm2 restart "polar-school-api"
else
  pm2 start ecosystem.config.cjs --env "$ENV"
fi
pm2 save

# 7. Smoke tests
echo "▸ Smoke tests"
sleep 5
HEALTH=$(curl -fsS http://127.0.0.1:3001/health || echo "FAIL")
echo "  API /health: $HEALTH"

WEB=$(curl -fsS http://127.0.0.1:3000/ -o /dev/null && echo "OK" || echo "FAIL")
echo "  Web /: $WEB"

if [[ "$HEALTH" == "FAIL" || "$WEB" == "FAIL" ]]; then
  echo "✗ Smoke tests fallaron. Revirtiendo..."
  pm2 logs "polar-school-$ENV" --lines 50 --nostream --err
  exit 1
fi

echo "✓ Deploy $ENV completo."

#!/usr/bin/env bash
# Build la imagen de sandbox. Idempotente.
# Uso: ./build-image.sh [--no-cache]
#
# Variables opcionales:
#   IMAGE_NAME   default: polar-school-sandbox
#   IMAGE_TAG    default: latest
#   DOCKERFILE   default: apps/api/src/sandbox/Dockerfile

set -euo pipefail

cd "$(dirname "$0")/../../../.."

IMAGE_NAME="${IMAGE_NAME:-polar-school-sandbox}"
IMAGE_TAG="${IMAGE_TAG:-latest}"
DOCKERFILE="apps/api/src/sandbox/Dockerfile"

EXTRA_ARGS=()
if [[ "${1:-}" == "--no-cache" ]]; then
  EXTRA_ARGS+=(--no-cache)
fi

echo "▶ Building $IMAGE_NAME:$IMAGE_TAG from $DOCKERFILE"
docker build "${EXTRA_ARGS[@]}" \
  -t "$IMAGE_NAME:$IMAGE_TAG" \
  -f "$DOCKERFILE" \
  "apps/api/src/sandbox/"

echo ""
echo "▶ Image size:"
docker images "$IMAGE_NAME:$IMAGE_TAG" --format "  {{.Repository}}:{{.Tag}} {{.Size}}"

echo ""
echo "▶ Smoke test (bash, git, nano):"
docker run --rm "$IMAGE_NAME:$IMAGE_TAG" sh -c 'echo "  bash: $BASH_VERSION"'
docker run --rm "$IMAGE_NAME:$IMAGE_TAG" sh -c 'echo "  git:  $(git --version)"'
docker run --rm "$IMAGE_NAME:$IMAGE_TAG" sh -c 'echo "  nano: $(nano --version 2>&1 | head -1)"'

echo ""
echo "✓ Build OK"

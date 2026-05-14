#!/usr/bin/env bash
# Install edge-tts Python package on the Zo server.
# Required only when using tts-route-edge.ts — no API key needed.
set -e

echo "📦  Installing edge-tts …"
pip install --quiet --upgrade edge-tts

echo "✅  edge-tts installed: $(edge-tts --version 2>/dev/null || echo 'ok')"
echo ""
echo "Available voices (sample):"
edge-tts --list-voices 2>/dev/null | grep "en-US" | head -10 || true
echo ""
echo "Deploy the edge backend:"
echo "  bun deploy-tts-endpoint.ts --backend edge"

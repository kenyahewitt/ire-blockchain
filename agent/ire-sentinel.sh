#!/bin/zsh
set -euo pipefail

PROJECT_DIRECTORY="/Users/devonhewitt/Downloads/ire-blockchain/ire-blockchain"
KEYCHAIN_SERVICE="IRE_SENTINEL_OPENAI_API_KEY"

# The key is read only from the logged-in user's Keychain. It is never written
# to this repository, logs, or reports.
OPENAI_KEY="$(security find-generic-password -a "$USER" -s "$KEYCHAIN_SERVICE" -w 2>/dev/null || true)"
if [[ -n "$OPENAI_KEY" ]]; then
  export OPENAI_API_KEY="$OPENAI_KEY"
fi

exec /opt/homebrew/bin/node "$PROJECT_DIRECTORY/agent/ire-sentinel.mjs" "$@"

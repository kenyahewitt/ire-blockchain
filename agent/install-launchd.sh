#!/bin/zsh
set -euo pipefail

PROJECT_DIRECTORY="/Users/devonhewitt/Downloads/ire-blockchain/ire-blockchain"
LABEL="com.ire.sentinel"
TARGET_DIRECTORY="$HOME/Library/LaunchAgents"
TARGET_PLIST="$TARGET_DIRECTORY/$LABEL.plist"

mkdir -p "$TARGET_DIRECTORY" "$PROJECT_DIRECTORY/agent/logs" "$PROJECT_DIRECTORY/agent/reports"
launchctl bootout "gui/$(id -u)/$LABEL" 2>/dev/null || true
cp "$PROJECT_DIRECTORY/agent/launchd/$LABEL.plist" "$TARGET_PLIST"
launchctl bootstrap "gui/$(id -u)" "$TARGET_PLIST"
launchctl kickstart -k "gui/$(id -u)/$LABEL"
echo "IRE Sentinel installed and started: $LABEL"

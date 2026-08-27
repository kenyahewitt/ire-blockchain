# IRE Sentinel

IRE Sentinel monitors the local IRE node and creates timestamped reports. It reads only the local RPC and REST health endpoints. It can write only to `agent/reports`; it cannot sign or broadcast transactions, access node keys, change node configuration, or deploy contracts.

## Run a deterministic check

```sh
npm run sentinel:no-ai
```

This confirms the chain ID, sync state, fixed supply, zero inflation, and presence of a bonded validator without using any AI service.

## Enable AI analysis securely

Create a dedicated OpenAI project service account API key for IRE Sentinel, with a project budget and no broader access than needed. OpenAI shows the full value only once; do not place it in Git, `.env` files, the node configuration, or chat.

Store it in the logged-in macOS Keychain (this command prompts for the secret):

```sh
security add-generic-password -U -a "$USER" -s IRE_SENTINEL_OPENAI_API_KEY -w
```

Then run:

```sh
npm run sentinel:check
```

The default analysis model is `gpt-5.6-sol`. Override it for a run with `IRE_AGENT_MODEL=<model> npm run sentinel:check`.

## Keep it running on this Mac

```sh
zsh agent/install-launchd.sh
```

This installs a user-level LaunchAgent which runs once when loaded and every 30 minutes afterward. Check `agent/logs/sentinel.log` and `agent/reports/` for results. Unload it with:

```sh
launchctl bootout "gui/$(id -u)/com.ire.sentinel"
```

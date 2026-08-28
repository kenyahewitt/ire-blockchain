# IRE Explorer

Run a read-only local dashboard against the node:

```sh
npm run explorer
```

Open http://127.0.0.1:8080. It shows live blocks, mempool transaction count/bytes, fixed supply, inflation, bonded-validator stake distribution, and any account's `uire` balance.

For a public deployment, set `IRE_RPC_URL` and `IRE_API_URL` to loopback endpoints on the VPS and place this dashboard behind the read-only proxy described in `docs/PUBLIC-NODE.md`. Do not expose the node keyring or transaction endpoints.

Public protocol docs (not a node): https://illustrious-banoffee-92cafd.netlify.app/

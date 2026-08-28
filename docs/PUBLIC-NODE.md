# Public IRE node and explorer deployment

This package provisions a **non-validator** public full node. Your existing Mac validator remains private and no key file is copied to the VPS.

## What it exposes

| Service | Exposure | Purpose |
| --- | --- | --- |
| CometBFT P2P, TCP 26656 | Public | Peers and future validators |
| RPC, TCP 26657 | `127.0.0.1` only | Used by the proxy, never directly public |
| REST, TCP 1317 | `127.0.0.1` only | Local operations only |
| gRPC, TCP 9090 | `127.0.0.1` only | Local operations only |

## Provision a VPS

Use a fresh Ubuntu 24.04 VPS with a static IPv4 address, at least 2 vCPU, 4 GB RAM, and 100 GB SSD. Log in as a provider-created administrator, clone this repository, and run:

```sh
sudo IRE_REPOSITORY_REF=main bash deploy/vps/bootstrap.sh
```

Then check the service locally on the VPS:

```sh
curl -s http://127.0.0.1:26657/status
sudo journalctl -u ired -f
```

Set the VPS IP or DNS name in `networks/ire-1/README.md` only after the P2P port is reachable and the node is synced. Never copy `.ire/`, `priv_validator_key.json`, `node_key.json`, mnemonics, or API keys from the Mac.

## Add a read-only explorer endpoint

1. Point `rpc.example.org` at the VPS.
2. Install Nginx and Certbot on the VPS.
3. Copy `deploy/nginx/ire-explorer.conf` to the Nginx site directory and replace `rpc.example.org` with your hostname.
4. Obtain a TLS certificate with Certbot, validate the Nginx configuration, and reload it.
5. The public docs/explorer origin is already `https://illustrious-banoffee-92cafd.netlify.app`. Point `rpc.example.org` (or another hostname you control) at the VPS. Netlify cannot serve CometBFT P2P (`26656`) or RPC (`26657`).

The supplied proxy permits only GET requests to selected query paths, rate-limits callers, and permits browser requests only from `https://illustrious-banoffee-92cafd.netlify.app`. It does not relay transaction broadcasts, signing, or administrative RPC calls.

## Before allowing public validators

- Run the VPS node as a non-validator for a test period.
- Get at least two independently controlled operators to run their own nodes and validate genesis/checksums independently.
- Publish their peer IDs and the public seed hostname.
- Hold a documented genesis and validator-key ceremony. Each operator creates and retains their own keys.
- Complete an external security audit and testnet period before accepting real value.

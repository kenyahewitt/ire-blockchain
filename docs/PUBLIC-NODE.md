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

1. Point `rpc.boomer250.com` at the VPS.
2. Install Nginx and Certbot on the VPS, then obtain the first certificate before installing the TLS server block:

```sh
sudo apt-get update
sudo apt-get install -y nginx certbot
sudo systemctl stop nginx
sudo certbot certonly --standalone -d rpc.boomer250.com
```

3. Copy `deploy/nginx/ire-explorer.conf` to the Nginx site directory. It is deliberately pinned to `rpc.boomer250.com` and only exposes selected GET endpoints.

```sh
sudo install -m 0644 deploy/nginx/ire-explorer.conf /etc/nginx/sites-available/ire-explorer
sudo ln -s /etc/nginx/sites-available/ire-explorer /etc/nginx/sites-enabled/ire-explorer
sudo nginx -t
sudo systemctl enable --now nginx
```

Switch certificate renewal to the zero-downtime webroot challenge after Nginx is running:

```sh
sudo install -d -m 0755 /var/www/certbot/.well-known/acme-challenge
sudo certbot reconfigure --cert-name rpc.boomer250.com \
  --webroot -w /var/www/certbot --deploy-hook "systemctl reload nginx"
```

4. Do not deploy the Netlify redirect change until `https://rpc.boomer250.com/rpc/status` returns a valid certificate and `200`.
5. The public docs origin is `https://boomer250.com`; it proxies read-only requests to the TLS-only RPC hostname. Netlify cannot serve CometBFT P2P (`26656`) or RPC (`26657`).

The supplied proxy permits only GET requests to selected query paths and rate-limits callers. It does not relay transaction broadcasts, signing, or administrative RPC calls. CORS is intentionally absent: the public site uses a same-origin proxy, and CORS is not an authorization boundary.

## Before allowing public validators

- Run the VPS node as a non-validator for a test period.
- Get at least two independently controlled operators to run their own nodes and validate genesis/checksums independently.
- Publish their peer IDs and the public seed hostname.
- Hold a documented genesis and validator-key ceremony. Each operator creates and retains their own keys.
- Complete an external security audit and testnet period before accepting real value.

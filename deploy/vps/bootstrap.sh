#!/usr/bin/env bash
# Run as root on a fresh Ubuntu 24.04 VPS after setting IRE_REPOSITORY_REF.
# This provisions a non-validator public full node. It never copies your Mac's
# .ire directory, keys, or validator state.
set -euo pipefail

IRE_REPOSITORY="https://github.com/kenyahewitt/ire-blockchain.git"
IRE_REPOSITORY_REF="${IRE_REPOSITORY_REF:-main}"
IRE_HOME="/var/lib/ired"

apt-get update
apt-get install -y ca-certificates curl git make golang-go ufw

id -u ired >/dev/null 2>&1 || useradd --system --create-home --home-dir "$IRE_HOME" --shell /usr/sbin/nologin ired
git clone --depth 1 --branch "$IRE_REPOSITORY_REF" "$IRE_REPOSITORY" /opt/ire-blockchain
make -C /opt/ire-blockchain build
install -m 0755 /opt/ire-blockchain/build/ired /usr/local/bin/ired

runuser -u ired -- /usr/local/bin/ired init "ire-public-node" --chain-id ire-1 --home "$IRE_HOME"
install -o ired -g ired -m 0644 /opt/ire-blockchain/networks/ire-1/genesis.json "$IRE_HOME/config/genesis.json"

# P2P is reachable by peers. RPC, REST, and gRPC remain private to the VPS;
# a separate read-only proxy may be configured for an explorer.
sed -i 's|^laddr = "tcp://127.0.0.1:26657"|laddr = "tcp://127.0.0.1:26657"|' "$IRE_HOME/config/config.toml"
sed -i 's|^laddr = "tcp://0.0.0.0:26656"|laddr = "tcp://0.0.0.0:26656"|' "$IRE_HOME/config/config.toml"
sed -i 's|^unsafe = true|unsafe = false|' "$IRE_HOME/config/config.toml"
sed -i 's|^enable = false|enable = true|' "$IRE_HOME/config/app.toml"
sed -i 's|^address = "tcp://localhost:1317"|address = "tcp://127.0.0.1:1317"|' "$IRE_HOME/config/app.toml"
sed -i 's|^address = "localhost:9090"|address = "127.0.0.1:9090"|' "$IRE_HOME/config/app.toml"

install -m 0644 /opt/ire-blockchain/deploy/systemd/ired.service /etc/systemd/system/ired.service
systemctl daemon-reload
systemctl enable --now ired

# Keep SSH available for your provider/admin access; open only the public P2P port.
ufw allow OpenSSH
ufw allow 26656/tcp comment 'IRE P2P'
ufw --force enable

echo 'Public node installed. Confirm with: systemctl status ired --no-pager'
echo 'Do not make RPC/API public directly. Follow docs/PUBLIC-NODE.md for the read-only explorer proxy.'

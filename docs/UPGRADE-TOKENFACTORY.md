# ire-1 operator runbook: `v1-tokenfactory`

Software-upgrade name: **`v1-tokenfactory`**

This upgrade adds Osmosis-style `x/tokenfactory` (vendored from
`cosmos/tokenfactory` v0.53.5, compiled against Cosmos SDK v0.53.6). It does
**not** re-enable `uire` inflation (`noMint` stays). It does **not** add wasm.
It does **not** genesis-reset, copy validator keys, halt the chain now, or
deploy an EVM lock contract.

Factory denoms are namespaced: `create-denom uninj` produces
`factory/<creator-address>/uninj`, not a bare `uninj` bank denom. The NINJ
inscription mapping is **not** that denom. See [BRIDGE.md](BRIDGE.md).

Do **not** accept Robinhood (or any source-chain) deposits until this factory
denom exists **and** a later mint to a bridge account is wired. Mint is
allowed to a bridge account later; it is not part of this upgrade tx.

## 0. Do not touch the live binary yet

The Mac validator is launched from `./build/ired` (`start-local-ired.command`,
`--home .ire`). The VPS seed runs `/usr/local/bin/ired` as systemd unit `ired`
(`--home /var/lib/ired`).

Keep both nodes on the **current** `ired` until the chain **halts at
`UPGRADE_HEIGHT`**. Building a new binary is not installing it.

## 1. Build the new `ired` on the Mac

From `/Users/devonhewitt/Downloads/ire-blockchain/ire-blockchain`:

```sh
# Preserve the live validator binary so make build cannot become a restart.
cp -p build/ired build/ired-live

make build

# Keep the upgrade artifact under a distinct name, then restore the live binary.
cp -p build/ired build/ired-v1-tokenfactory
cp -p build/ired-live build/ired

# Confirm the live path is the old binary again (do not restart):
ls -l build/ired build/ired-v1-tokenfactory
```

`make build` writes `build/ired`. Restoring `build/ired-live` over it keeps the
running node on the current binary. Unix will keep the already-running process
on the old inode even if you forget the restore; a **restart** before halt
would load extra stores too early and can panic. Do not restart.

## 2. Copy ONLY the `ired` binary to the VPS

Never `scp` `.ire/`, `priv_validator_key.json`, `node_key.json`, mnemonics, or
anything under `/var/lib/ired` on the seed.

```sh
scp -p build/ired-v1-tokenfactory root@91.99.1.9:/tmp/ired-v1-tokenfactory
```

On the VPS, **place** the new binary next to the live one. Do not replace
`/usr/local/bin/ired` and do not `systemctl restart ired` until halt:

```sh
sudo install -o root -g root -m 0755 /tmp/ired-v1-tokenfactory /usr/local/bin/ired-v1-tokenfactory
# live unit still ExecStart=/usr/local/bin/ired — leave it
```

Both nodes must have the new binary **on disk** before `UPGRADE_HEIGHT`.

## 3. Pick `UPGRADE_HEIGHT` and submit the gov plan

Query height (Mac, against the live node):

```sh
curl -s http://127.0.0.1:26657/status | python3 -c 'import sys,json; print(json.load(sys.stdin)["result"]["sync_info"]["latest_block_height"])'
```

Genesis gov params: `min_deposit` `10000000uire`, `voting_period` `172800s`
(48h), expedited `86400s` / `50000000uire`. The upgrade height **must** be
after voting ends. With one validator, vote `yes` immediately, then set
`UPGRADE_HEIGHT` to current height plus enough blocks for the voting window
plus a buffer (do not use a height in the next few minutes).

Gov / upgrade authority for `MsgSoftwareUpgrade` (should be the gov module account):

```sh
./build/ired q upgrade authority --home .ire --chain-id ire-1
```

Write `v1-tokenfactory-proposal.json` (replace `GOV_MODULE_ADDR`,
`UPGRADE_HEIGHT`):

```json
{
  "messages": [
    {
      "@type": "/cosmos.upgrade.v1beta1.MsgSoftwareUpgrade",
      "authority": "GOV_MODULE_ADDR",
      "plan": {
        "name": "v1-tokenfactory",
        "height": "UPGRADE_HEIGHT",
        "info": "ired v1-tokenfactory: add x/tokenfactory store; noMint uire unchanged; no wasm"
      }
    }
  ],
  "metadata": "v1-tokenfactory",
  "deposit": "10000000uire",
  "title": "v1-tokenfactory",
  "summary": "Add x/tokenfactory so factory denoms such as uninj can be minted and burned. Does not inflate uire."
}
```

From the **sole validator** on the Mac (replace `VALIDATOR_KEY`):

```sh
./build/ired tx gov submit-proposal v1-tokenfactory-proposal.json \
  --from VALIDATOR_KEY \
  --chain-id ire-1 \
  --home .ire \
  --gas auto \
  --gas-adjustment 1.4 \
  --gas-prices 0.001uire \
  --yes
```

Vote (replace `PROPOSAL_ID`):

```sh
./build/ired tx gov vote PROPOSAL_ID yes \
  --from VALIDATOR_KEY \
  --chain-id ire-1 \
  --home .ire \
  --gas auto \
  --gas-adjustment 1.4 \
  --gas-prices 0.001uire \
  --yes
```

Confirm the plan once it passes:

```sh
./build/ired q upgrade plan --home .ire
```

## 4. At halt: swap binaries on **both** nodes, then start

When height `UPGRADE_HEIGHT` is committed, both nodes halt with an upgrade
needed error. Then, and only then:

Mac:

```sh
# stop the live ired process (however you started it). Do not genesis-reset.
cp -p build/ired-v1-tokenfactory build/ired
./build/ired start --home .ire
```

VPS:

```sh
sudo systemctl stop ired
sudo install -o root -g root -m 0755 /usr/local/bin/ired-v1-tokenfactory /usr/local/bin/ired
sudo systemctl start ired
sudo journalctl -u ired -f
```

One-sided upgrade will halt or split `ire-1`. Do not copy `.ire` keys. Do not
replace genesis.

## 5. After upgrade: create `uninj` (6 decimals)

The admin of the denom is the `--from` address. Subdenom `uninj` becomes
`factory/<that-address>/uninj`.

```sh
./build/ired tx tokenfactory create-denom uninj \
  --from VALIDATOR_KEY \
  --chain-id ire-1 \
  --home .ire \
  --gas auto \
  --gas-adjustment 1.4 \
  --gas-prices 0.001uire \
  --yes

CREATOR=$(./build/ired keys show VALIDATOR_KEY -a --home .ire)
DENOM="factory/${CREATOR}/uninj"

./build/ired tx tokenfactory modify-metadata \
  "$DENOM" UNINJ "IRE unit for Ninjaagent peg (6 decimals). Not the NINJ inscription." 6 \
  --from VALIDATOR_KEY \
  --chain-id ire-1 \
  --home .ire \
  --gas auto \
  --gas-adjustment 1.4 \
  --gas-prices 0.001uire \
  --yes

./build/ired q tokenfactory denom-authority-metadata "$DENOM" --home .ire
./build/ired q bank denom-metadata "$DENOM" --home .ire
```

Mint to a **bridge account** is allowed later (admin-only):

```sh
# later, not now:
# ./build/ired tx tokenfactory mint-to BRIDGE_ADDR 1000000${DENOM} --from VALIDATOR_KEY ...
```

Until `$DENOM` exists:

- Do **not** accept Robinhood-chain deposits.
- Do **not** treat tick `NINJ` as this denom ([BRIDGE.md](BRIDGE.md)).
- Do **not** deploy an EVM lock contract as if redemption existed.

`uire` supply is still not inflated by this module.

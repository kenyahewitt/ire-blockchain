# Run a node or validator on ire-1

Requirements: Go 1.21+, git, this repository.

## Full node

```sh
git clone https://github.com/kenyahewitt/ire-blockchain.git
cd ire-blockchain
git checkout a762557   # match the running seed binary; omit to build latest
make build

./build/ired init mymoniker --chain-id ire-1 --home "$HOME/.ire"
cp networks/ire-1/genesis.json "$HOME/.ire/config/genesis.json"
```

Set the seed peer in `$HOME/.ire/config/config.toml`:

```
persistent_peers = "63c21a2befb884a958cdc88a1c78788eae42bf5b@91.99.1.9:26656"
```

Optional: set your advertised P2P address if you are not on localhost:

```
external_address = "tcp://YOUR_PUBLIC_IP:26656"
```

Start:

```sh
./build/ired start --home "$HOME/.ire"
```

Wait until `/status` shows `"catching_up": false` before sending transactions.

```sh
curl -s http://127.0.0.1:26657/status | python3 -c 'import sys,json; s=json.load(sys.stdin)["result"]["sync_info"]; print(s["latest_block_height"], s["catching_up"])'
```

## Become a validator

You need `uire` in a local key for self-delegation and fees (`minimum-gas-prices` is `0.001uire`). After the node is synced:

```sh
./build/ired keys add myvalidator --home "$HOME/.ire"
./build/ired tendermint show-validator --home "$HOME/.ire"
```

Copy `networks/ire-1/validator.json.example` to `validator.json`, paste that pubkey, set `moniker` and `amount`, then:

```sh
./build/ired tx staking create-validator validator.json \
  --from myvalidator \
  --chain-id ire-1 \
  --home "$HOME/.ire" \
  --gas auto \
  --gas-adjustment 1.4 \
  --gas-prices 0.001uire \
  --yes
```

`create-validator` will fail until this account has a balance. Ask an existing token holder to send `uire` to the address from `ired keys show myvalidator -a --home "$HOME/.ire"`.

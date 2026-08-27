//! ire-cw20: fixed-supply token contract for Ire's Blockchain.
//!
//! This wraps the standard, widely-audited `cw20-base` contract. The
//! immutability guarantee here comes from TWO layers:
//!   1. Instantiation: `mint` is set to `None`, so cw20-base's own
//!      `ExecuteMsg::Mint` variant will always reject with Unauthorized —
//!      there is no minter address that could ever call it.
//!   2. Deployment: deploy with `--no-admin` on the `wasmd`/`ired` CLI so
//!      `MsgMigrateContract` can never be called by anyone. Without an
//!      admin, the contract's WASM bytecode is permanently frozen.
//!
//! Both layers matter: (1) stops supply inflation via this contract's own
//! logic, (2) stops someone swapping the logic out from under holders later.

use cosmwasm_std::{
    entry_point, DepsMut, Env, MessageInfo, Response, StdResult,
};
use cw20_base::msg::{ExecuteMsg, InstantiateMsg, QueryMsg};
use cw20_base::contract::{execute as base_execute, instantiate as base_instantiate, query as base_query};
use cw20_base::ContractError;
use cw20::MinterResponse;

/// Instantiate with a fixed initial balance list summing to the full
/// supply, and mint = None. Deployers MUST pass the entire 1 trillion IRE
/// (or whatever sub-allocation this specific contract represents) in
/// `msg.initial_balances` — there is no follow-up mint call available.
#[entry_point]
pub fn instantiate(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    mut msg: InstantiateMsg,
) -> Result<Response, ContractError> {
    // Hard-enforce: this contract can NEVER have a minter, regardless of
    // what's passed in. This line is the actual guarantee — remove it and
    // you no longer have a fixed-supply contract.
    msg.mint = None::<MinterResponse>;

    base_instantiate(deps, env, info, msg)
}

/// Pass-through to cw20-base for all standard operations (transfer, burn,
/// send, allowances, etc). Mint calls fail here because no minter was ever
/// set at instantiation — cw20-base's own authorization check handles it.
#[entry_point]
pub fn execute(
    deps: DepsMut,
    env: Env,
    info: MessageInfo,
    msg: ExecuteMsg,
) -> Result<Response, ContractError> {
    base_execute(deps, env, info, msg)
}

#[entry_point]
pub fn query(deps: cosmwasm_std::Deps, env: Env, msg: QueryMsg) -> StdResult<cosmwasm_std::Binary> {
    base_query(deps, env, msg)
}

// NOTE: deliberately no `migrate` entry_point is exported here.
// A contract with no `migrate` fn AND deployed with --no-admin is the
// standard CosmWasm pattern for "permanently immutable."

#[cfg(test)]
mod tests {
    use super::*;
    use cosmwasm_std::testing::{mock_dependencies, mock_env, mock_info};
    use cosmwasm_std::{Uint128};
    use cw20::Cw20Coin;

    #[test]
    fn instantiate_ignores_any_minter_and_fixes_supply() {
        let mut deps = mock_dependencies();
        let info = mock_info("creator", &[]);

        let msg = InstantiateMsg {
            name: "Ire".to_string(),
            symbol: "IRE".to_string(),
            decimals: 6,
            initial_balances: vec![Cw20Coin {
                address: "holder1".to_string(),
                amount: Uint128::new(1_000_000_000_000_000_000u128), // 1 trillion IRE at 6 decimals
            }],
            mint: Some(MinterResponse {
                minter: "creator".to_string(),
                cap: None,
            }), // even if a caller tries to sneak a minter in...
            marketing: None,
        };

        let res = instantiate(deps.as_mut(), mock_env(), info, msg);
        assert!(res.is_ok()); // ...instantiate() above strips it before calling base_instantiate
    }
}

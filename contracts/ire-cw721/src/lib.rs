//! ire-cw721: NFT contract for Ire's Blockchain, built on the standard,
//! widely-used cw721-base implementation.
//!
//! Immutability here is entirely a DEPLOYMENT property, not a code property:
//! cw721-base contracts are legitimately mutable by design at the source
//! level (an admin can normally migrate them to fix bugs or add features).
//! To get the "can never be changed" guarantee you asked for, you deploy
//! this contract with the CLI flag `--no-admin`:
//!
//!   ired tx wasm instantiate <code_id> '{...}' --no-admin --label "ire-nft-collection" ...
//!
//! With no admin address set, `MsgMigrateContract` has no authorized sender
//! and will always fail — the deployed bytecode is frozen forever. This is
//! the standard, audited path (rather than writing custom immutability logic,
//! which would be new, unaudited code for something the platform already
//! guarantees at the deployment layer).

use cosmwasm_std::Empty;

// Re-export cw721-base's entry points directly — no custom logic needed.
// Using the upstream implementation unmodified means you inherit its
// existing audit history rather than introducing new, unreviewed code.
pub use cw721_base::{
    entry::{execute as base_execute, instantiate as base_instantiate, query as base_query},
    ContractError, InstantiateMsg, MinterResponse,
};

pub type ExecuteMsg = cw721_base::ExecuteMsg<Option<Empty>, Empty>;
pub type QueryMsg = cw721_base::QueryMsg<Empty>;

#[cosmwasm_std::entry_point]
pub fn instantiate(
    deps: cosmwasm_std::DepsMut,
    env: cosmwasm_std::Env,
    info: cosmwasm_std::MessageInfo,
    msg: InstantiateMsg,
) -> cosmwasm_std::StdResult<cosmwasm_std::Response> {
    base_instantiate(deps, env, info, msg)
}

#[cosmwasm_std::entry_point]
pub fn execute(
    deps: cosmwasm_std::DepsMut,
    env: cosmwasm_std::Env,
    info: cosmwasm_std::MessageInfo,
    msg: ExecuteMsg,
) -> Result<cosmwasm_std::Response, ContractError> {
    base_execute(deps, env, info, msg)
}

#[cosmwasm_std::entry_point]
pub fn query(
    deps: cosmwasm_std::Deps,
    env: cosmwasm_std::Env,
    msg: QueryMsg,
) -> cosmwasm_std::StdResult<cosmwasm_std::Binary> {
    base_query(deps, env, msg)
}

// No `migrate` entry_point exported — combined with --no-admin deployment,
// this collection's contract logic cannot be altered post-deploy.
// NOTE: the minter address set at instantiation CAN still mint new tokens
// within the collection (that's normal NFT collection behavior — a
// "collection" grows over time). If you want a hard-capped NFT collection
// size too, that requires a small modification to check total supply
// against a max in the mint handler — ask if you want that variant.

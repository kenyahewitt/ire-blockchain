package app

import (
	"context"
	"fmt"

	storetypes "cosmossdk.io/store/types"
	upgradetypes "cosmossdk.io/x/upgrade/types"

	sdk "github.com/cosmos/cosmos-sdk/types"
	"github.com/cosmos/cosmos-sdk/types/module"

	tokenfactorytypes "github.com/kenyahewitt/ire-blockchain/x/tokenfactory/types"
)

// UpgradeNameV1TokenFactory is the software-upgrade plan name. The Mac
// validator and the VPS seed must halt on this name at the same height and
// restart with the new ired. Do not genesis-reset.
const UpgradeNameV1TokenFactory = "v1-tokenfactory"

// registerUpgradeHandlers installs the v1-tokenfactory handler and, when the
// node is restarting at the upgrade height, the store loader that adds the
// tokenfactory KV store. Call after all modules (including tokenfactory) are
// registered and before Load.
func (app *App) registerUpgradeHandlers() {
	app.UpgradeKeeper.SetUpgradeHandler(
		UpgradeNameV1TokenFactory,
		func(ctx context.Context, _ upgradetypes.Plan, fromVM module.VersionMap) (module.VersionMap, error) {
			// Ensure the module account exists with minter/burner perms from
			// this binary's moduleAccPerms. RunMigrations then InitGenesis
			// tokenfactory (params + empty denom set). uire noMint is unchanged.
			sdkCtx := sdk.UnwrapSDKContext(ctx)
			app.AuthKeeper.GetModuleAccount(sdkCtx, tokenfactorytypes.ModuleName)

			return app.ModuleManager.RunMigrations(ctx, app.Configurator(), fromVM)
		},
	)

	upgradeInfo, err := app.UpgradeKeeper.ReadUpgradeInfoFromDisk()
	if err != nil {
		panic(fmt.Sprintf("failed to read upgrade info from disk: %s", err))
	}

	if upgradeInfo.Name == UpgradeNameV1TokenFactory && !app.UpgradeKeeper.IsSkipHeight(upgradeInfo.Height) {
		storeUpgrades := storetypes.StoreUpgrades{
			Added: []string{tokenfactorytypes.StoreKey},
		}
		app.SetStoreLoader(upgradetypes.UpgradeStoreLoader(upgradeInfo.Height, &storeUpgrades))
	}
}

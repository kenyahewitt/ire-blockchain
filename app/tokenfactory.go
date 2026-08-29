package app

import (
	storetypes "cosmossdk.io/store/types"
	"github.com/cosmos/cosmos-sdk/codec"
	"github.com/cosmos/cosmos-sdk/types/module"
	authtypes "github.com/cosmos/cosmos-sdk/x/auth/types"
	govtypes "github.com/cosmos/cosmos-sdk/x/gov/types"

	"cosmossdk.io/core/appmodule"

	tokenfactory "github.com/kenyahewitt/ire-blockchain/x/tokenfactory"
	tokenfactorykeeper "github.com/kenyahewitt/ire-blockchain/x/tokenfactory/keeper"
	tokenfactorytypes "github.com/kenyahewitt/ire-blockchain/x/tokenfactory/types"
)

// tokenfactoryCapabilities are the Osmosis-style admin flags enabled for ire-1.
// Mint/burn to the admin's own account do not need a flag. Set-metadata is
// required so uninj can be given 6 decimals. Burn-from is required so a later
// bridge account can burn on redemption. Wasm bindings are intentionally omitted.
var tokenfactoryCapabilities = []string{
	tokenfactorytypes.EnableSetMetadata,
	tokenfactorytypes.EnableBurnFrom,
}

// registerTokenFactoryModule wires x/tokenfactory like IBC: it is not a
// depinject module, so the store key, keeper, and app module are registered
// after runtime.AppBuilder.Build.
func (app *App) registerTokenFactoryModule() error {
	if err := app.RegisterStores(
		storetypes.NewKVStoreKey(tokenfactorytypes.StoreKey),
	); err != nil {
		return err
	}

	app.ParamsKeeper.Subspace(tokenfactorytypes.ModuleName).WithKeyTable(tokenfactorytypes.ParamKeyTable())

	govModuleAddr, _ := app.AuthKeeper.AddressCodec().BytesToString(authtypes.NewModuleAddress(govtypes.ModuleName))

	app.TokenFactoryKeeper = tokenfactorykeeper.NewKeeper(
		app.appCodec,
		app.GetKey(tokenfactorytypes.StoreKey),
		GetMaccPerms(),
		app.AuthKeeper,
		app.BankKeeper,
		app.DistrKeeper,
		tokenfactoryCapabilities,
		govModuleAddr,
	)

	tfModule := tokenfactory.NewAppModule(
		app.TokenFactoryKeeper,
		app.AuthKeeper,
		app.BankKeeper,
		app.GetSubspace(tokenfactorytypes.ModuleName),
	)

	return app.RegisterModules(tfModule)
}

// RegisterTokenFactory registers tokenfactory interfaces and CLI on the client
// side. Same reason as RegisterIBC: the module is not depinject-wired.
func RegisterTokenFactory(cdc codec.Codec) map[string]appmodule.AppModule {
	tfBasic := tokenfactory.NewAppModuleBasic()
	tfBasic.RegisterInterfaces(cdc.InterfaceRegistry())

	modules := map[string]appmodule.AppModule{
		tokenfactorytypes.ModuleName: tokenfactory.NewAppModule(
			tokenfactorykeeper.Keeper{},
			nil,
			nil,
			nil,
		),
	}
	for _, m := range modules {
		if mr, ok := m.(module.AppModuleBasic); ok {
			mr.RegisterInterfaces(cdc.InterfaceRegistry())
		}
	}
	return modules
}

#pragma once

#include "CoreMinimal.h"
#include "Engine/DeveloperSettings.h"
#include "ArchVizSettings.generated.h"

class UArchVizProjectAsset;

/** Project Settings > Plugins > ArchViz Kit. Points the app at the active project asset. */
UCLASS(Config = Game, DefaultConfig, meta = (DisplayName = "ArchViz Kit"))
class ARCHVIZKIT_API UArchVizSettings : public UDeveloperSettings
{
	GENERATED_BODY()

public:
	UPROPERTY(Config, EditAnywhere, Category = "Project")
	TSoftObjectPtr<UArchVizProjectAsset> ProjectAsset;

	/** Custom-depth stencil written on highlighted units, per status. Read these in your outline post-process material. */
	UPROPERTY(Config, EditAnywhere, Category = "Highlight")
	int32 StencilAvailable = 1;

	UPROPERTY(Config, EditAnywhere, Category = "Highlight")
	int32 StencilReserved = 2;

	UPROPERTY(Config, EditAnywhere, Category = "Highlight")
	int32 StencilSold = 3;

	/** Stencil for the selected unit; usually drawn brighter / animated. */
	UPROPERTY(Config, EditAnywhere, Category = "Highlight")
	int32 StencilSelected = 10;

	virtual FName GetCategoryName() const override { return TEXT("Plugins"); }

	static const UArchVizSettings* Get() { return GetDefault<UArchVizSettings>(); }
};

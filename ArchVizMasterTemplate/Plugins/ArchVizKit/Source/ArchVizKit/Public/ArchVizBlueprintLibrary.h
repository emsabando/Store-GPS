#pragma once

#include "CoreMinimal.h"
#include "Kismet/BlueprintFunctionLibrary.h"
#include "ArchVizTypes.h"
#include "ArchVizBlueprintLibrary.generated.h"

class UArchVizProjectAsset;

/** Settings, formatting and theme helpers shared by UMG widgets and the command bridge. */
UCLASS()
class ARCHVIZKIT_API UArchVizBlueprintLibrary : public UBlueprintFunctionLibrary
{
	GENERATED_BODY()

public:
	/** Quality switcher (Performance / Balanced / High / Cinematic): scalability + resolution, saved. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Settings")
	static void ApplyQualityPreset(EArchVizQuality Quality);

	UFUNCTION(BlueprintPure, Category = "ArchViz|Settings")
	static EArchVizQuality GetQualityPreset();

	/** Switch UI language, e.g. "en", "ru", "uz", "pl". Saved to config. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Settings")
	static bool SetLanguage(const FString& Culture);

	/** Saved to Saved/Screenshots. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Settings")
	static void TakeScreenshot(bool bWithUI = false);

	/** Culture-aware grouping: "1 600 000 PLN", "1,600,000 USD". */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Format")
	static FText FormatPrice(int64 Price, const FString& CurrencyCode);

	/** "53,75 m2" / "53.75 m2" (superscript 2) depending on culture. */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Format")
	static FText FormatArea(float SquareMetres, int32 Decimals = 2);

	/** "13:27" */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Format")
	static FText FormatTimeOfDay(float Hours);

	UFUNCTION(BlueprintPure, Category = "ArchViz|Format")
	static FText GetStatusText(EArchVizUnitStatus Status);

	/** Theme colour for a status badge, from the active project asset. */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Theme")
	static FLinearColor GetStatusColor(EArchVizUnitStatus Status);

	/** Display name from the project asset's BuildingNames, or the id itself. */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Format")
	static FText GetBuildingName(FName Building);

	/** Active project asset from Project Settings > Plugins > ArchViz Kit. */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Theme")
	static UArchVizProjectAsset* GetProjectAsset();
};

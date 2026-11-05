#pragma once

#include "CoreMinimal.h"
#include "Engine/DataAsset.h"
#include "ArchVizTypes.h"
#include "ArchVizProjectAsset.generated.h"

class UDataTable;
class APawn;

/** "5 / minutes to the metro" style facts on the home screen. */
USTRUCT(BlueprintType)
struct ARCHVIZKIT_API FArchVizLocationFact
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FText Value;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FText Label;
};

/**
 * Brand tokens read by every widget. Re-skinning a project for a new client
 * (navy + green, terracotta, minimal glass) is a change here, not in the widgets.
 */
USTRUCT(BlueprintType)
struct ARCHVIZKIT_API FArchVizTheme
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme")
	FLinearColor Surface = FLinearColor(0.02f, 0.02f, 0.025f, 0.72f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme")
	FLinearColor SurfaceRaised = FLinearColor(1.f, 1.f, 1.f, 0.08f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme")
	FLinearColor Primary = FLinearColor(0.9f, 0.9f, 0.9f, 1.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme")
	FLinearColor Accent = FLinearColor(0.75f, 0.6f, 0.4f, 1.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme")
	FLinearColor Text = FLinearColor::White;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme")
	FLinearColor TextMuted = FLinearColor(1.f, 1.f, 1.f, 0.6f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme|Status")
	FLinearColor Available = FLinearColor(0.35f, 0.8f, 0.5f, 1.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme|Status")
	FLinearColor Reserved = FLinearColor(0.95f, 0.7f, 0.25f, 1.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme|Status")
	FLinearColor Sold = FLinearColor(0.85f, 0.3f, 0.3f, 1.f);

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme")
	float CornerRadius = 4.f;

	/** Background blur strength behind panels (0 disables). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "Theme")
	float PanelBlur = 12.f;

	FLinearColor GetStatusColor(EArchVizUnitStatus Status) const
	{
		switch (Status)
		{
		case EArchVizUnitStatus::Available: return Available;
		case EArchVizUnitStatus::Reserved:  return Reserved;
		default:                            return Sold;
		}
	}
};

/**
 * Everything that changes between client projects. Duplicate this asset per project;
 * code and widgets stay the same.
 */
UCLASS(BlueprintType)
class ARCHVIZKIT_API UArchVizProjectAsset : public UPrimaryDataAsset
{
	GENERATED_BODY()

public:
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Brand")
	FText ProjectName;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Brand", meta = (MultiLine = true))
	FText Tagline;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Brand")
	FText Address;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Brand")
	TArray<FArchVizLocationFact> LocationFacts;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Brand")
	FArchVizTheme Theme;

	/** Display names for the lot / building picker, e.g. B1 -> "Mirabad Towers". */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Brand")
	TMap<FName, FText> BuildingNames;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Inventory", meta = (RequiredAssetDataTags = "RowStructure=/Script/ArchVizKit.ArchVizUnitRow"))
	TSoftObjectPtr<UDataTable> UnitsTable;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Inventory", meta = (RequiredAssetDataTags = "RowStructure=/Script/ArchVizKit.ArchVizUnitTypeRow"))
	TSoftObjectPtr<UDataTable> UnitTypesTable;

	/** ISO code shown next to prices, e.g. PLN, USD, UZS. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Inventory")
	FString CurrencyCode = TEXT("USD");

	/**
	 * Optional JSON endpoint returning live prices/statuses (array of unit rows).
	 * Lets the sales team update availability without repackaging the app.
	 */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Inventory")
	FString InventorySyncUrl;

	/** Optional endpoint that receives lead / enquiry forms as JSON POST. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Sales")
	FString LeadWebhookUrl;

	/** Real site location for a physically correct sun. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Site", meta = (ClampMin = -90, ClampMax = 90))
	float Latitude = 52.23f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Site", meta = (ClampMin = -180, ClampMax = 180))
	float Longitude = 21.01f;

	/** Hours from UTC (no DST handling; set the value valid for your presentation season). */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Site")
	float UtcOffsetHours = 1.f;

	/** World yaw (degrees) of true north. 0 = north along +X. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Site")
	float NorthYaw = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Experience")
	TSoftClassPtr<APawn> FirstPersonPawnClass;

	/** Seconds without input before the kiosk attract loop starts. 0 disables. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Experience", meta = (ClampMin = 0))
	float IdleTimeoutSeconds = 120.f;

	/** Cultures offered in the language switcher, e.g. en, ru, uz, pl. */
	UPROPERTY(EditAnywhere, BlueprintReadOnly, Category = "Experience")
	TArray<FString> Cultures = { TEXT("en") };

	virtual FPrimaryAssetId GetPrimaryAssetId() const override
	{
		return FPrimaryAssetId(TEXT("ArchVizProject"), GetFName());
	}
};

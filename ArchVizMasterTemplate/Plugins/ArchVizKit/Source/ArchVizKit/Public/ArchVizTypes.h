#pragma once

#include "CoreMinimal.h"
#include "Engine/DataTable.h"
#include "ArchVizTypes.generated.h"

class UTexture2D;
class UWorld;

/** Sales status of a unit. Drives facade colour, filtering and the UI badge. */
UENUM(BlueprintType)
enum class EArchVizUnitStatus : uint8
{
	Available,
	Reserved,
	Sold,
	NotForSale
};

/**
 * Where the user is in the drill-down. Every screen of the app maps to one mode;
 * the app subsystem keeps a history stack so "Back" always works.
 */
UENUM(BlueprintType)
enum class EArchVizMode : uint8
{
	Masterplan,   // whole site, lots / buildings selectable
	Building,     // one building, facade + amenities
	Floor,        // section cut: floors above the selected one hidden
	Unit,         // one apartment highlighted + its card / plan
	Interior,     // inside the show-flat, plan viewpoints
	Amenity,      // a point of interest (padel court, rooftop garden...)
	FirstPerson   // walk mode
};

UENUM(BlueprintType)
enum class EArchVizWeather : uint8
{
	Clear,
	PartlyCloudy,
	Overcast,
	Fog,
	Rain,
	Snow
};

UENUM(BlueprintType)
enum class EArchVizSeason : uint8
{
	Spring,
	Summer,
	Autumn,
	Winter
};

UENUM(BlueprintType)
enum class EArchVizQuality : uint8
{
	Performance,
	Balanced,
	High,
	Cinematic
};

UENUM(BlueprintType)
enum class EArchVizSortKey : uint8
{
	Price,
	Area,
	Floor,
	Rooms,
	Id
};

/** A clickable camera position on a floor plan ("Choose view on plan"). */
USTRUCT(BlueprintType)
struct ARCHVIZKIT_API FArchVizViewpoint
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FText Label;

	/** ShotId of an AArchVizCameraShot placed in the show-flat. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FName ShotId;

	/** Hotspot position on the plan image, normalised 0..1 (top-left origin). */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FVector2D PlanPosition = FVector2D(0.5, 0.5);

	/** Direction the camera looks, in degrees on the plan (0 = up). Used to draw the view cone. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	float PlanYaw = 0.f;
};

/**
 * One row per apartment layout (A1, B2...). Many units share a type, so 85 apartments
 * usually need only a handful of furnished show-flats and plans.
 */
USTRUCT(BlueprintType)
struct ARCHVIZKIT_API FArchVizUnitTypeRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FText DisplayName;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	TSoftObjectPtr<UTexture2D> FloorPlan;

	/** Optional rendered 3D (cutaway) plan, as in the reference "Apartment plan" panel. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	TSoftObjectPtr<UTexture2D> FloorPlan3D;

	/** Same plan as a web image, for Pixel Streaming / web UIs that cannot use UE textures. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FString FloorPlanUrl;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	TArray<FArchVizViewpoint> Viewpoints;

	/** Optional level streamed in for the furnished interior of this type. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	TSoftObjectPtr<UWorld> InteriorLevel;
};

/** One row per sellable unit. The row name must equal UnitId. */
USTRUCT(BlueprintType)
struct ARCHVIZKIT_API FArchVizUnitRow : public FTableRowBase
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FName UnitId;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FName Building;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	int32 Floor = 0;

	/** Row name in the unit-type table. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FName UnitType;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	int32 Rooms = 1;

	/** Square metres. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	float Area = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	float BalconyArea = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	float TerraceArea = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	bool bWhiteBox = false;

	/** Whole currency units. int64 so currencies with large nominal prices fit. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	int64 Price = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	EArchVizUnitStatus Status = EArchVizUnitStatus::Available;

	/** Free tags for filters and badges: SeaView, Corner, Duplex, Penthouse... */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	TArray<FName> Tags;

	/** PDF brochure / sales sheet. Opened on desktop, shown as a link or QR on web and kiosk. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	FString BrochureUrl;

	bool HasTerrace() const { return TerraceArea > 0.f; }
};

/**
 * Filter used by the apartment search panel. Empty arrays and zero limits mean
 * "no constraint", so a default-constructed filter matches every unit.
 */
USTRUCT(BlueprintType)
struct ARCHVIZKIT_API FArchVizUnitFilter
{
	GENERATED_BODY()

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	TArray<FName> Buildings;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	TArray<int32> Rooms;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	float MinArea = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	float MaxArea = 0.f;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	int64 MinPrice = 0;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	int64 MaxPrice = 0;

	/** Empty = any floor. A list (not min/max) so "ground floor only" (0) is expressible. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	TArray<int32> Floors;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	bool bRequireTerrace = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	bool bRequireWhiteBox = false;

	/** Empty = every status. The reference "Reserved" toggle adds Reserved to {Available}. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	TArray<EArchVizUnitStatus> Statuses;

	/** Unit must carry all of these tags. */
	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	TArray<FName> RequiredTags;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	bool bFavoritesOnly = false;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	EArchVizSortKey SortBy = EArchVizSortKey::Price;

	UPROPERTY(EditAnywhere, BlueprintReadWrite, Category = "ArchViz")
	bool bSortDescending = false;
};

/** Min/max values across the whole inventory, used to set up the range sliders. */
USTRUCT(BlueprintType)
struct ARCHVIZKIT_API FArchVizInventoryRanges
{
	GENERATED_BODY()

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	float MinArea = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	float MaxArea = 0.f;

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	int64 MinPrice = 0;

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	int64 MaxPrice = 0;

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	int32 MinFloor = 0;

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	int32 MaxFloor = 0;

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	TArray<FName> Buildings;

	UPROPERTY(BlueprintReadOnly, Category = "ArchViz")
	TArray<int32> RoomCounts;
};

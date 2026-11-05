#pragma once

#include "CoreMinimal.h"
#include "Subsystems/GameInstanceSubsystem.h"
#include "ArchVizTypes.h"
#include "ArchVizInventorySubsystem.generated.h"

class UDataTable;
class UArchVizProjectAsset;

DECLARE_DYNAMIC_MULTICAST_DELEGATE(FArchVizInventoryChanged);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FArchVizResultsChanged, const TArray<FName>&, UnitIds);
DECLARE_DYNAMIC_MULTICAST_DELEGATE(FArchVizFavoritesChanged);

/**
 * Owns the sellable inventory: loads the unit tables, answers filter queries, keeps the
 * active search (whose results the scene highlights on the facade) and the favourites list.
 * Lives on the GameInstance so it survives travelling between masterplan and interior levels.
 */
UCLASS()
class ARCHVIZKIT_API UArchVizInventorySubsystem : public UGameInstanceSubsystem
{
	GENERATED_BODY()

public:
	virtual void Initialize(FSubsystemCollectionBase& Collection) override;

	/** Project asset from Project Settings > ArchViz Kit (may be null if not configured). */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Inventory")
	UArchVizProjectAsset* GetProject() const { return Project; }

	/** Replace the inventory with these tables (called automatically from the project asset). */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Inventory")
	void LoadInventory(UDataTable* UnitsTable, UDataTable* UnitTypesTable);

	UFUNCTION(BlueprintPure, Category = "ArchViz|Inventory")
	bool GetUnit(FName UnitId, FArchVizUnitRow& OutUnit) const;

	UFUNCTION(BlueprintPure, Category = "ArchViz|Inventory")
	bool GetUnitType(FName UnitTypeId, FArchVizUnitTypeRow& OutUnitType) const;

	UFUNCTION(BlueprintPure, Category = "ArchViz|Inventory")
	TArray<FArchVizUnitRow> GetAllUnits() const;

	/** Stateless query: units matching the filter, sorted as the filter asks. Exec node: run it once, cache the array. */
	UFUNCTION(BlueprintCallable, BlueprintPure = false, Category = "ArchViz|Inventory")
	TArray<FArchVizUnitRow> QueryUnits(const FArchVizUnitFilter& Filter) const;

	UFUNCTION(BlueprintPure, Category = "ArchViz|Inventory")
	bool MatchesFilter(const FArchVizUnitRow& Unit, const FArchVizUnitFilter& Filter) const;

	/** Set the search the UI is showing. Broadcasts OnResultsChanged; the scene highlights the results. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Inventory")
	void SetActiveFilter(const FArchVizUnitFilter& Filter);

	UFUNCTION(BlueprintCallable, Category = "ArchViz|Inventory")
	void ClearActiveFilter();

	UFUNCTION(BlueprintPure, Category = "ArchViz|Inventory")
	FArchVizUnitFilter GetActiveFilter() const { return ActiveFilter; }

	UFUNCTION(BlueprintPure, Category = "ArchViz|Inventory")
	bool IsFilterActive() const { return bFilterActive; }

	UFUNCTION(BlueprintPure, Category = "ArchViz|Inventory")
	TArray<FName> GetActiveResults() const { return ActiveResults; }

	/** Slider bounds and available buildings / room counts across the whole inventory. */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Inventory")
	FArchVizInventoryRanges GetRanges() const;

	/**
	 * Merge a JSON array of (partial) unit objects into the inventory, keyed by "UnitId".
	 * Only fields present are overwritten, so a CRM can send just {"UnitId":"345","Status":"Sold"}.
	 * Returns the number of units updated or added.
	 */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Inventory")
	int32 ApplyJsonUpdate(const FString& JsonArray);

	/** GET the project's InventorySyncUrl and merge the result. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Inventory")
	void RefreshFromUrl();

	UFUNCTION(BlueprintCallable, Category = "ArchViz|Favorites")
	void SetFavorite(FName UnitId, bool bFavorite);

	UFUNCTION(BlueprintCallable, Category = "ArchViz|Favorites")
	bool ToggleFavorite(FName UnitId);

	UFUNCTION(BlueprintPure, Category = "ArchViz|Favorites")
	bool IsFavorite(FName UnitId) const { return Favorites.Contains(UnitId); }

	UFUNCTION(BlueprintPure, Category = "ArchViz|Favorites")
	TArray<FName> GetFavorites() const { return Favorites.Array(); }

	UFUNCTION(BlueprintCallable, Category = "ArchViz|Favorites")
	void ClearFavorites();

	/** Fired when unit data changes (load, JSON update, CRM refresh). */
	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Inventory")
	FArchVizInventoryChanged OnInventoryChanged;

	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Inventory")
	FArchVizResultsChanged OnResultsChanged;

	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Favorites")
	FArchVizFavoritesChanged OnFavoritesChanged;

private:
	void SortUnits(TArray<FArchVizUnitRow>& InOut, EArchVizSortKey Key, bool bDescending) const;
	void RecomputeActiveResults();
	void LoadFavorites();
	void SaveFavorites() const;

	UPROPERTY(Transient)
	TObjectPtr<UArchVizProjectAsset> Project;

	/** Insertion order kept for stable "Id" sorting and listing. */
	TArray<FName> UnitOrder;
	TMap<FName, FArchVizUnitRow> Units;
	TMap<FName, FArchVizUnitTypeRow> UnitTypes;

	FArchVizUnitFilter ActiveFilter;
	bool bFilterActive = false;
	TArray<FName> ActiveResults;

	TSet<FName> Favorites;

	static const FString SaveSlotName;
};

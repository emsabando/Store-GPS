#pragma once

#include "CoreMinimal.h"
#include "Subsystems/WorldSubsystem.h"
#include "ArchVizTypes.h"
#include "ArchVizSceneSubsystem.generated.h"

class UArchVizUnitComponent;
class UArchVizFloorComponent;
class UArchVizInventorySubsystem;
class AArchVizCameraShot;
class AArchVizPOI;

DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FArchVizUnitEvent, FName, UnitId);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_OneParam(FArchVizPOIEvent, AArchVizPOI*, POI);
DECLARE_DYNAMIC_MULTICAST_DELEGATE_ThreeParams(FArchVizSectionChanged, bool, bActive, FName, Building, int32, Floor);

/**
 * Per-level registry of everything placed in the scene (units, floors, camera shots, POIs)
 * and owner of the visual state: which units glow (search results, hover, selection,
 * "colour all by status"), and the section cut.
 */
UCLASS()
class ARCHVIZKIT_API UArchVizSceneSubsystem : public UWorldSubsystem
{
	GENERATED_BODY()

public:
	virtual bool DoesSupportWorldType(const EWorldType::Type WorldType) const override;
	virtual void OnWorldBeginPlay(UWorld& InWorld) override;
	virtual void Deinitialize() override;

	// --- Registration (called by the components / actors themselves) ---
	void RegisterUnit(UArchVizUnitComponent* Unit);
	void UnregisterUnit(UArchVizUnitComponent* Unit);
	void RegisterFloor(UArchVizFloorComponent* Floor);
	void UnregisterFloor(UArchVizFloorComponent* Floor);
	void RegisterShot(AArchVizCameraShot* Shot);
	void UnregisterShot(AArchVizCameraShot* Shot);
	void RegisterPOI(AArchVizPOI* POI);
	void UnregisterPOI(AArchVizPOI* POI);

	// --- Scene input ---
	void NotifyUnitClicked(FName UnitId);
	void NotifyUnitHovered(FName UnitId, bool bHovered);
	void NotifyPOIClicked(AArchVizPOI* POI);

	// --- Lookups ---
	UFUNCTION(BlueprintPure, Category = "ArchViz|Scene")
	AArchVizCameraShot* FindShot(FName ShotId) const;

	/** Shots sharing a Group, ordered by their Order field (for tours / attract loops). */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Scene")
	TArray<AArchVizCameraShot*> GetShotsInGroup(FName Group) const;

	UFUNCTION(BlueprintPure, Category = "ArchViz|Scene")
	AArchVizPOI* FindPOI(FName PoiId) const;

	/** Category None returns every POI. */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Scene")
	TArray<AArchVizPOI*> GetPOIs(FName Category) const;

	UFUNCTION(BlueprintPure, Category = "ArchViz|Scene")
	bool GetUnitBounds(FName UnitId, FBox& OutBounds) const;

	/** Floors that have Structure geometry in this building, ascending. Feeds the floor picker. */
	UFUNCTION(BlueprintPure, Category = "ArchViz|Scene")
	TArray<int32> GetFloors(FName Building) const;

	// --- Section cut ---
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Scene")
	void SetSection(FName Building, int32 Floor);

	UFUNCTION(BlueprintCallable, Category = "ArchViz|Scene")
	void ClearSection();

	UFUNCTION(BlueprintPure, Category = "ArchViz|Scene")
	bool GetSection(FName& OutBuilding, int32& OutFloor) const;

	// --- Highlight ---
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Scene")
	void SetSelectedUnit(FName UnitId);

	UFUNCTION(BlueprintPure, Category = "ArchViz|Scene")
	FName GetSelectedUnit() const { return SelectedUnit; }

	/** Light a unit from the UI (hovering its row in the apartment list). None clears. */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Scene")
	void SetHoveredUnit(FName UnitId);

	/** Colour every unit by status (the "chessboard" availability view). */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Scene")
	void SetShowAllStatuses(bool bShow);

	UFUNCTION(BlueprintPure, Category = "ArchViz|Scene")
	bool GetShowAllStatuses() const { return bShowAllStatuses; }

	/** Show/hide every POI label (HIDE button, clean screenshots). */
	UFUNCTION(BlueprintCallable, Category = "ArchViz|Scene")
	void SetPOIsVisible(bool bVisible);

	UFUNCTION(BlueprintCallable, Category = "ArchViz|Scene")
	void RefreshUnitVisuals();

	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Scene")
	FArchVizUnitEvent OnUnitClicked;

	/** UnitId is None when the cursor leaves all units. */
	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Scene")
	FArchVizUnitEvent OnUnitHovered;

	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Scene")
	FArchVizPOIEvent OnPOIClicked;

	UPROPERTY(BlueprintAssignable, Category = "ArchViz|Scene")
	FArchVizSectionChanged OnSectionChanged;

private:
	UFUNCTION()
	void HandleResultsChanged(const TArray<FName>& UnitIds);

	UFUNCTION()
	void HandleInventoryChanged();

	UArchVizInventorySubsystem* GetInventory() const;
	void RefreshUnit(UArchVizUnitComponent* Unit) const;
	void RefreshUnitsWithId(FName UnitId) const;
	void ApplySectionToFloors() const;

	TArray<TWeakObjectPtr<UArchVizUnitComponent>> Units;
	TArray<TWeakObjectPtr<UArchVizFloorComponent>> Floors;
	TMap<FName, TWeakObjectPtr<AArchVizCameraShot>> Shots;
	TArray<TWeakObjectPtr<AArchVizPOI>> POIs;

	TSet<FName> ResultSet;
	FName SelectedUnit;
	FName HoveredUnit;
	bool bShowAllStatuses = false;
	bool bPOIsVisible = true;

	bool bSectionActive = false;
	FName SectionBuilding;
	int32 SectionFloor = 0;
};
